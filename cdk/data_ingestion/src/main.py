import os
import json
import boto3
import psycopg2
from datetime import datetime, timezone
import logging
from collections import namedtuple

from helpers.vectorstore import update_vectorstore
from langchain_aws import BedrockEmbeddings

# Set up basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
REGION = os.environ["REGION"]
QUANTUMAI_DATA_INGESTION_BUCKET = os.environ["BUCKET"]
EMBEDDING_BUCKET_NAME = os.environ["EMBEDDING_BUCKET_NAME"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]
EMBEDDING_MODEL_PARAM = os.environ["EMBEDDING_MODEL_PARAM"]

# AWS Clients
secrets_manager_client = boto3.client("secretsmanager")
ssm_client = boto3.client("ssm")
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)
s3_resource = boto3.resource("s3")
s3_client = boto3.client("s3")

# Cached resources
connection = None
db_secret = None
EMBEDDING_MODEL_ID = None

def get_secret():
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager_client.get_secret_value(SecretId=DB_SECRET_NAME)["SecretString"]
            db_secret = json.loads(response)
        except Exception as e:
            logger.error(f"Error fetching secret {DB_SECRET_NAME}: {e}")
            raise
    return db_secret
 
def get_parameter():
    """
    Fetch a parameter value from Systems Manager Parameter Store.
    """
    global EMBEDDING_MODEL_ID
    if EMBEDDING_MODEL_ID is None:
        try:
            response = ssm_client.get_parameter(Name=EMBEDDING_MODEL_PARAM, WithDecryption=True)
            EMBEDDING_MODEL_ID = response["Parameter"]["Value"]
        except Exception as e:
            logger.error(f"Error fetching parameter {EMBEDDING_MODEL_PARAM}: {e}")
            raise
    return EMBEDDING_MODEL_ID


def connect_to_db():
    global connection
    if connection is None or connection.closed:
        try:
            secret = get_secret()
            connection_params = {
                'dbname': secret["dbname"],
                'user': secret["username"],
                'password': secret["password"],
                'host': RDS_PROXY_ENDPOINT,
                'port': secret["port"]
            }
            connection_string = " ".join([f"{key}={value}" for key, value in connection_params.items()])
            connection = psycopg2.connect(connection_string)
            logger.info("Connected to the database!")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            if connection:
                connection.rollback()
                connection.close()
            raise
    return connection

S3FilePath = namedtuple("S3FilePath", ["topic_id", "file_category", "file_name", "file_type"])

def parse_s3_file_path(file_key):
    # Assuming the file path is of the format: {topic_id}/{documents}/{file_name}.{file_type}
    try:
        topic_id, file_category, filename_with_ext = file_key.split("/")
        file_name, file_type = filename_with_ext.rsplit(".", 1)  # Split on the last period
        return S3FilePath(topic_id=topic_id, file_category=file_category, file_name=file_name, file_type=file_type)
    except Exception as e:
        logger.error(f"Error parsing S3 file path: {e}")
         
         
        return {"statusCode": 400, "body": json.dumps("Error parsing S3 file path.")}


 
def insert_file_into_db(topic_id, file_name, file_type, file_path, bucket_name):
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return {"statusCode": 500, "body": json.dumps("Database connection failed.")}

    try:
        cur = connection.cursor()

        # Check if a record already exists
        select_query = """
        SELECT * FROM "Documents"
        WHERE topic_id = %s
        AND filename = %s
        AND filetype = %s;
        """
        cur.execute(select_query, (topic_id, file_name, file_type))

        existing_file = cur.fetchone()

        if existing_file:
            # Update the existing record
            update_query = """
                UPDATE "Documents"
                SET filepath = %s,
                time_uploaded = %s
                WHERE topic_id = %s
                AND filename = %s
                AND filetype = %s;
            """
            timestamp = datetime.now(timezone.utc)
            cur.execute(
                update_query,
                (
                    file_path,  # filepath
                    timestamp,  # time_uploaded
                    topic_id,  # topic_id
                    file_name,  # filename
                    file_type,  # filetype
                ),
            )
            logger.info(
                f"Successfully updated file {file_name}.{file_type} in database for topic {topic_id}."
            )
        else:
            # Insert a new record
            insert_query = """
                INSERT INTO "Documents" 
                (topic_id, filetype, filepath, filename, time_uploaded, metadata)
                VALUES (%s, %s, %s, %s, %s, %s);
            """
            timestamp = datetime.now(timezone.utc)
            cur.execute(
                insert_query,
                (
                    topic_id,  # topic_id
                    file_type,  # filetype
                    file_path,  # filepath
                    file_name,  # filename
                    timestamp,  # time_uploaded
                    "",  # metadata
                ),
            )
        logger.info(
            f"Successfully inserted file {file_name}.{file_type} into database for topic {topic_id}."
        )

        connection.commit()
        cur.close()
    except Exception as e:
        if cur:
            cur.close()
        if connection:
            connection.rollback()
        logger.error(f"Error inserting file {file_name}.{file_type} into database: {e}")
        raise


 
def update_vectorstore_from_s3(bucket, topic_id):

    embeddings = BedrockEmbeddings(
        model_id=get_parameter(), 
        client=bedrock_runtime,
        region_name=REGION
    )

    db_secret = get_secret()

    vectorstore_config_dict = {
        "collection_name": f"{topic_id}",
        "dbname": db_secret["dbname"],
        "user": db_secret["username"],
        "password": db_secret["password"],
        "host": RDS_PROXY_ENDPOINT,
        "port": db_secret["port"],
    }

    try:
        update_vectorstore(
            bucket=bucket,
            topic=topic_id,
            vectorstore_config_dict=vectorstore_config_dict,
            embeddings=embeddings,
        )
     
    except Exception as e:
        logger.error(f"Error updating vectorstore for topic {topic_id}: {e}")
        raise

 
def handle_object_created(topic_id, general_topic_id, bucket_name, file_key, file_category, file_name, file_type):
    """
    Handles the logic when the event is 'ObjectCreated:' and topic_id is not equal to general_topic_id.
    """
    if topic_id != general_topic_id:
        try:
            copy_source = {
                "Bucket": bucket_name,
                "Key": file_key,
            }
            copy_dest_key = f"{general_topic_id}/{file_category}/{file_name}.{file_type}"
            s3_resource.meta.client.copy(copy_source, bucket_name, copy_dest_key)
         
         
        except Exception as e:
            logger.error(f"Error copying file {file_name}.{file_type} to general topic: {e}")

    # Insert the file into the PostgreSQL database
    try:
        insert_file_into_db(
            topic_id=topic_id,
            file_name=file_name,
            file_type=file_type,
            file_path=file_key,
            bucket_name=bucket_name,
        )
        logger.info(f"File {file_name}.{file_type} inserted successfully.")
    except Exception as e:
        logger.error(
            f"Error inserting file {file_name}.{file_type} into database: {e}"
        )
        return {
            "statusCode": 500,
            "body": json.dumps(
                f"Error inserting file {file_name}.{file_type}: {e}"
            ),
        }

 
def handle_else_branch(topic_id, general_topic_id, bucket_name, file_category, file_name, file_type):
    """
    Handles the logic when the event is not 'ObjectCreated:'.
    """
    logger.info(
        f"File {file_name}.{file_type} is being deleted. Deleting files from database does not occur here."
    )
    if topic_id != general_topic_id:
        try:
            file_key = f"{general_topic_id}/{file_category}/{file_name}.{file_type}"
            s3_client.delete_object(Bucket=bucket_name, Key=file_key)
        except Exception as e:
            logger.error(f"Error deleting file {file_name}.{file_type}: {e}")

 
def fetch_general_topic_id():
    try:
        connection = connect_to_db()
        cur = connection.cursor()

        select_query = """
        SELECT topic_id FROM "Topics"
        WHERE topic_name = %s;
        """

        cur.execute(select_query, ("General",))
        general_topic_id = cur.fetchone()[0]
        connection.commit()
        cur.close()
        return general_topic_id
    except Exception as e:
        cur.close()
        connection.rollback()
        logger.error(f"Error fetching general topic id: {e}")
        raise

def handler(event, context):
    records = event.get("Records", [])
    if not records:
        return {"statusCode": 400, "body": json.dumps("No valid S3 event found.")}

    general_topic_id = fetch_general_topic_id()
     
    for record in records:
        try:
            event_name = record["eventName"]
            bucket_name = record["s3"]["bucket"]["name"]

            # Only process files from the QUANTUMAI_DATA_INGESTION_BUCKET
            if bucket_name != QUANTUMAI_DATA_INGESTION_BUCKET:
                continue  # Ignore this event and move to the next one
            file_key = record["s3"]["object"]["key"]

            # if event_name.startswith('ObjectCreated:'):
            # Parse the file path
            result = parse_s3_file_path(file_key)

            # Access the parsed components from the named tuple
            topic_id, file_category, file_name, file_type = result.topic_id, result.file_category, result.file_name, result.file_type

            if not topic_id or not file_name or not file_type:
                return {
                    "statusCode": 400,
                    "body": json.dumps("Error parsing S3 file path."),
                }
            
            if event_name.startswith("ObjectCreated:"):
                handle_object_created(topic_id, general_topic_id, bucket_name, file_key, file_category, file_name, file_type)
            else:
                handle_else_branch(topic_id, general_topic_id, bucket_name, file_category, file_name, file_type)

            # Update embeddings for topic after the file is successfully inserted into the database
            try:
                update_vectorstore_from_s3(bucket_name, topic_id)
                logger.info(f"Vectorstore updated successfully for topic {topic_id}.")
            except Exception as e:
                logger.error(f"Error updating vectorstore for topic {topic_id}: {e}")
                return {
                    "statusCode": 500,
                    "body": json.dumps(
                        f"File inserted, but error updating vectorstore: {e}"
                    ),
                }

            return {
                "statusCode": 200,
                "body": json.dumps(
                    {
                        "message": "New file inserted into database.",
                        "location": f"s3://{bucket_name}/{file_key}",
                    }
                ),
            }
        except Exception as e:
            logger.error(f"Error processing record: {e}")

    return {
        "statusCode": 400,
        "body": json.dumps("No new file upload or deletion event found."),
    }
