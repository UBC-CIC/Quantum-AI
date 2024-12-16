import os
import json
import boto3
from botocore.config import Config
import psycopg2
from aws_lambda_powertools import Logger

logger = Logger()

# Environment variables
REGION = os.environ["REGION"]
BUCKET = os.environ["BUCKET"]
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]

# AWS Clients
secrets_manager_client = boto3.client('secretsmanager')

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://s3.{REGION}.amazonaws.com",
    config=Config(
        s3={"addressing_style": "virtual"}, region_name=REGION, signature_version="s3v4"
    ),
)

# Global variables for caching
connection = None
db_secret = None

def get_secret(secret_name):
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager_client.get_secret_value(SecretId=secret_name)["SecretString"]
            db_secret = json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON for secret {secret_name}: {e}")
            raise ValueError(f"Secret {secret_name} is not properly formatted as JSON.")
        except Exception as e:
            logger.error(f"Error fetching secret {secret_name}: {e}")
            raise
    return db_secret

def connect_to_db():
    global connection
    if connection is None or connection.closed:
        try:
            secret = get_secret(DB_SECRET_NAME)
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

def list_files_in_s3_prefix(bucket, prefix):
    files = []
    continuation_token = None

    # Fetch all objects in the module directory, handling pagination
    while True:
        if continuation_token:
            result = s3.list_objects_v2(
                Bucket=bucket, 
                Prefix=prefix, 
                ContinuationToken=continuation_token
            )
        else:
            result = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)

        if 'Contents' in result:
            for obj in result['Contents']:
                files.append(obj['Key'].replace(prefix, ''))

        # Check if there's more data to fetch
        if result.get('IsTruncated'):
            continuation_token = result.get('NextContinuationToken')
        else:
            break

    return files

def generate_presigned_url(bucket, key):
    try:
        return s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=300,
            HttpMethod="GET",
        )
    except Exception as e:
        logger.exception(f"Error generating presigned URL for {key}: {e}")
        return None

def get_file_metadata_from_db(topic_id, file_name, file_type):
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return None

    try:
        cur = connection.cursor()

        query = """
            SELECT metadata 
            FROM "Documents" 
            WHERE topic_id = %s AND filename = %s AND filetype = %s;
        """
        cur.execute(query, (topic_id, file_name, file_type))
        result = cur.fetchone()
        cur.close()

        if result:
            return result[0]
        else:
            logger.warning(f"No metadata found for {file_name}.{file_type} in topic {topic_id}")
            return None

    except Exception as e:
        logger.error(f"Error retrieving metadata for {file_name}.{file_type}: {e}")
        if cur:
            cur.close()
        if connection:
            connection.rollback()
        return None

@logger.inject_lambda_context
def lambda_handler(event, context):
    query_params = event.get("queryStringParameters", {})

    topic_id = query_params.get("topic_id", "")

    if not topic_id:
        logger.error("Missing required parameters", extra={
            "topic_id": topic_id,
        })
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Missing required parameters: topic_id')
        }

    try:
        document_prefix = f"{topic_id}/documents/"

        document_files = list_files_in_s3_prefix(BUCKET, document_prefix)

        # Retrieve metadata and generate presigned URLs for documents
        document_files_urls = {}

        for file_name in document_files:
            file_type = file_name.split('.')[-1]  # Get the file extension
            presigned_url = generate_presigned_url(BUCKET, f"{document_prefix}{file_name}")
            metadata = get_file_metadata_from_db(topic_id, file_name.split('.')[0], file_type)
            document_files_urls[f"{file_name}"] = {
                "url": presigned_url,
                "metadata": metadata
            }

        logger.info("Presigned URLs and metadata generated successfully", extra={
            "document_files": document_files_urls,
        })

        return {
            'statusCode': 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps({
                'document_files': document_files_urls
            })
        }
    except Exception as e:
        logger.exception(f"Error generating presigned URLs or retrieving metadata: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Internal server error')
        }