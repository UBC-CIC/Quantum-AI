import os
import json
import boto3
import psycopg2
from datetime import datetime, timezone
import logging

from helpers.vectorstore import update_vectorstore
from langchain_community.embeddings import BedrockEmbeddings

# Set up basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
REGION = os.environ["REGION"]

def get_secret():
    # secretsmanager client to get db credentials
    sm_client = boto3.client("secretsmanager")
    response = sm_client.get_secret_value(SecretId=DB_SECRET_NAME)["SecretString"]
    secret = json.loads(response)
    return secret

def connect_to_db():
    try:
        db_secret = get_secret()
        connection_params = {
            'dbname': db_secret["dbname"],
            'user': db_secret["username"],
            'password': db_secret["password"],
            'host': db_secret["host"],
            'port': db_secret["port"]
        }
        connection_string = " ".join([f"{key}={value}" for key, value in connection_params.items()])
        connection = psycopg2.connect(connection_string)
        logger.info("Connected to the database!")
        return connection
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        if connection:
            connection.rollback()
            connection.close()
        return None

def parse_s3_file_path(file_key):
    # Assuming the file path is of the format: {course_id}/{module_id}/{documents}/{file_name}.{file_type}
    try:
        course_id, module_id, file_category, filename_with_ext = file_key.split('/')
        file_name, file_type = filename_with_ext.split('.')
        return course_id, module_id, file_category, file_name, file_type
    except Exception as e:
        logger.error(f"Error parsing S3 file path: {e}")
        return {
                    "statusCode": 400,
                    "body": json.dumps("Error parsing S3 file path.")
                }

def insert_file_into_db(module_id, file_name, file_type, file_path, bucket_name):    
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return {
            "statusCode": 500,
            "body": json.dumps("Database connection failed.")
        }
    
    try:
        cur = connection.cursor()

        # Check if a record already exists
        select_query = """
        SELECT * FROM "Module_Files"
        WHERE module_id = %s
        AND filename = %s
        AND filetype = %s;
        """
        cur.execute(select_query, (module_id, file_name, file_type))

        existing_file = cur.fetchone()

        if existing_file:
            # Update the existing record
            update_query = """
                UPDATE "Module_Files"
                SET filepath = %s,
                time_uploaded = %s
                WHERE module_id = %s
                AND filename = %s
                AND filetype = %s;
            """
            timestamp = datetime.now(timezone.utc)
            cur.execute(update_query, (
                file_path,  # filepath
                timestamp,  # time_uploaded
                module_id,  # module_id
                file_name,  # filename
                file_type  # filetype
            ))
            logger.info(f"Successfully updated file {file_name}.{file_type} in database for module {module_id}.")
        else:
            # Insert a new record
            insert_query = """
                INSERT INTO "Module_Files" 
                (module_id, filetype, filepath, filename, time_uploaded, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
            """
            timestamp = datetime.now(timezone.utc)
            cur.execute(insert_query, (
                module_id,  # module_id
                file_type,  # filetype
                file_path,  # filepath
                file_name,  # filename
                timestamp,  # time_uploaded
                ""  # metadata
        ))
        logger.info(f"Successfully inserted file {file_name}.{file_type} into database for module {module_id}.")

        connection.commit()
        cur.close()
        connection.close()
    except Exception as e:
        if cur:
            cur.close()
        if connection:
            connection.rollback()
            connection.close()
        logger.error(f"Error inserting file {file_name}.{file_type} into database: {e}")
        raise

def update_vectorstore_from_s3(bucket, course_id):
    
    bedrock_runtime = boto3.client(
        service_name="bedrock-runtime",
        region_name=REGION
    )
    
    embeddings = BedrockEmbeddings(
        model_id='amazon.titan-embed-text-v2:0', 
        client=bedrock_runtime,
        region_name=REGION
    )
    
    db_secret = get_secret()

    vectorstore_config_dict = {
        'collection_name': f'{course_id}',
        'dbname': db_secret["dbname"],
        'user': db_secret["username"],
        'password': db_secret["password"],
        'host': db_secret["host"],
        'port': db_secret["port"]
    }

    try:
        update_vectorstore(
            bucket=bucket,
            course=course_id,
            vectorstore_config_dict=vectorstore_config_dict,
            embeddings=embeddings
        )
    except Exception as e:
        logger.error(f"Error updating vectorstore for course {course_id}: {e}")
        raise

def handler(event, context):
    records = event.get('Records', [])
    if not records:
        return {
            "statusCode": 400,
            "body": json.dumps("No valid S3 event found.")
        }

    for record in records:
        if record['eventName'].startswith('ObjectCreated:'):
            bucket_name = record['s3']['bucket']['name']
            file_key = record['s3']['object']['key']

            # Parse the file path
            course_id, module_id, file_category, file_name, file_type = parse_s3_file_path(file_key)
            if not course_id or not module_id or not file_name or not file_type:
                return {
                    "statusCode": 400,
                    "body": json.dumps("Error parsing S3 file path.")
                }

            # Insert the file into the PostgreSQL database
            try:
                insert_file_into_db(
                    module_id=module_id,
                    file_name=file_name,
                    file_type=file_type,
                    file_path=file_key,
                    bucket_name=bucket_name
                )
                logger.info(f"File {file_name}.{file_type} inserted successfully.")
            except Exception as e:
                logger.error(f"Error inserting file {file_name}.{file_type} into database: {e}")
                return {
                    "statusCode": 500,
                    "body": json.dumps(f"Error inserting file {file_name}.{file_type}: {e}")
                }
            
            # Update embeddings for course after the file is successfully inserted into the database
            try:
                update_vectorstore_from_s3(bucket_name, course_id)
                logger.info(f"Vectorstore updated successfully for course {course_id}.")
            except Exception as e:
                logger.error(f"Error updating vectorstore for course {course_id}: {e}")
                return {
                    "statusCode": 500,
                    "body": json.dumps(f"File inserted, but error updating vectorstore: {e}")
                }

            return {
                "statusCode": 200,
                "body": json.dumps({
                    "message": "New file inserted into database.",
                    "location": f"s3://{bucket_name}/{file_key}"
                })
            }

    return {
        "statusCode": 400,
        "body": json.dumps("No new file upload event found.")
    }