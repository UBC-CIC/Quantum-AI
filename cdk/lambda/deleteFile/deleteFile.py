import os
import json
import boto3
import psycopg2
from aws_lambda_powertools import Logger

logger = Logger()

s3 = boto3.client('s3')
BUCKET = os.environ["BUCKET"]
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]

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
            'host': RDS_PROXY_ENDPOINT,
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

def delete_file_from_db(topic_id, file_name, file_type):
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return {
            "statusCode": 500,
            "body": json.dumps("Database connection failed.")
        }
    
    try:
        cur = connection.cursor()

        delete_query = """
            DELETE FROM "Documents" 
            WHERE topic_id = %s AND filename = %s AND filetype = %s;
        """
        cur.execute(delete_query, (topic_id, file_name, file_type))

        connection.commit()
        logger.info(f"Successfully deleted file {file_name}.{file_type} for topic {topic_id}.")

        cur.close()
        connection.close()
    except Exception as e:
        if cur:
            cur.close()
        if connection:
            connection.rollback()
            connection.close()
        logger.error(f"Error deleting file {file_name}.{file_type} from database: {e}")
        raise

@logger.inject_lambda_context
def lambda_handler(event, context):
    query_params = event.get("queryStringParameters", {})

    topic_id = query_params.get("topic_id", "")
    file_name = query_params.get("file_name", "")
    file_type = query_params.get("file_type", "")

    if not topic_id or not file_name or not file_type:
        logger.error("Missing required parameters", extra={
            "topic_id": topic_id,
            "file_name": file_name,
            "file_type": file_type
        })
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Missing required parameters: topic_id, file_name, or file_type')
        }

    try:
        # Allowed file types for documents
        allowed_document_types = {"pdf", "docx", "pptx", "txt", "xlsx", "xps", "mobi", "cbz", "qasm"}

        folder = None
        objects_to_delete = []

        # Determine the folder based on the file type
        if file_type in allowed_document_types:
            folder = "documents"
            objects_to_delete.append({"Key": f"{topic_id}/{folder}/{file_name}.{file_type}"})
        else:
            return {
                'statusCode': 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps('Unsupported file type')
            }

        # Delete the file from S3
        response = s3.delete_objects(
            Bucket=BUCKET,
            Delete={
                "Objects": objects_to_delete,
                "Quiet": True,
            },
        )
        
        logger.info(f"S3 Response: {response}")
        logger.info(f"File {file_name}.{file_type} and any associated files deleted successfully from S3.")

        # Delete the file from the database
        try:
            delete_file_from_db(topic_id, file_name, file_type)
            logger.info(f"File {file_name}.{file_type} deleted from the database.")
        except Exception as e:
            logger.error(f"Error deleting file {file_name}.{file_type} from the database: {e}")
            return {
                'statusCode': 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps(f"Error deleting file {file_name}.{file_type} from the database")
            }

        return {
            'statusCode': 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('File deleted successfully')
        }
        
    except Exception as e:
        logger.exception(f"Error deleting file: {e}")
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