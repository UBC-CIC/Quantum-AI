import os
import boto3
import json
import logging
import psycopg2

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS Clients
dynamodb_client = boto3.client('dynamodb')
secrets_manager_client = boto3.client('secretsmanager')
ssm_client = boto3.client("ssm")

# Global variables for caching
connection = None
db_secret = None
TABLE_NAME = None

DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]

def get_secret(secret_name, expect_json=True):
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager_client.get_secret_value(SecretId=secret_name)["SecretString"]
            db_secret = json.loads(response) if expect_json else response
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON for secret {secret_name}: {e}")
            raise ValueError(f"Secret {secret_name} is not properly formatted as JSON.")
        except Exception as e:
            logger.error(f"Error fetching secret {secret_name}: {e}")
            raise
    return db_secret

def get_parameter(param_name):
    """
    Fetch a parameter value from Systems Manager Parameter Store.
    """
    global TABLE_NAME
    if TABLE_NAME is None:
        try:
            response = ssm_client.get_parameter(Name=param_name, WithDecryption=True)
            TABLE_NAME = response["Parameter"]["Value"]
        except Exception as e:
            logger.error(f"Error fetching parameter {param_name}: {e}")
            raise
    return TABLE_NAME

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

def delete_last_two_db_messages(session_id):
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return None
    try:
        cur = connection.cursor()

        cur.execute("""
            SELECT message_id 
            FROM "Messages" 
            WHERE session_id = %s
            ORDER BY time_sent DESC
            LIMIT 2;
        """, (session_id,))
        
        messages = cur.fetchall()

        if len(messages) < 2:
            logger.info(f"Not enough messages to delete for session_id: {session_id}")
            return False
        
        message_ids = tuple([msg[0] for msg in messages])
        
        cur.execute("""
            DELETE FROM "Messages"
            WHERE message_id IN %s;
        """, (message_ids,))
        
        connection.commit()
        cur.close()
        logger.info(f"Successfully deleted the last two messages for session_id: {session_id}")
        return True

    except Exception as e:
        logger.error(f"Error deleting messages from database: {e}")
        if cur:
            cur.close()
        connection.rollback()
        return False

def lambda_handler(event, context):
    query_params = event.get("queryStringParameters", {})

    session_id = query_params.get("session_id", "")

    if not session_id:
        logger.error("Missing required parameter: session_id")
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Missing required parameter: session_id')
        }
    
    try:
        # Fetch the conversation history from DynamoDB
        table_name = get_parameter(os.environ["TABLE_NAME_PARAM"])
        response = dynamodb_client.get_item(
            TableName=table_name,
            Key={
                'SessionId': {
                    'S': session_id
                }
            }
        )

        if 'Item' not in response or 'History' not in response['Item']:
            logger.error(f"No conversation history found for session_id: {session_id}")
            return {
                'statusCode': 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps(f"No conversation history found for session_id: {session_id}")
            }

        history = response['Item']['History']['L']
        
        # There must be 2 messages in the history, 1 from AI and 1 from user
        if len(history) < 2:
            logger.info("Not enough messages to delete.")
            return {
                'statusCode': 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps(f"Not enough messages to delete for session_id: {session_id}")
            }

        # Remove the last AI and human messages by popping the last two elements
        history.pop()
        history.pop()

        # Update the conversation history in DynamoDB
        dynamodb_client.update_item(
            TableName=table_name,
            Key={
                'SessionId': {
                    'S': session_id
                }
            },
            UpdateExpression="SET History = :history",
            ExpressionAttributeValues={
                ":history": {"L": history}
            }
        )

        logger.info(f"Successfully deleted the last human and AI messages in DynamoDB for session_id: {session_id}")

        if delete_last_two_db_messages(session_id):
            logger.info(f"Successfully deleted the last human and AI messages in RDS for session_id: {session_id}")
            return {
                'statusCode': 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps(f"Successfully deleted the last human and AI messages for session_id: {session_id}")
            }
        else:
            logger.error(f"Failed to delete the last human and AI messages in RDS for session_id: {session_id}")
            return {
                'statusCode': 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps(f"Error deleting last messages from the database for session_id: {session_id}")
            }

    except Exception as e:
        logger.error(f"Error deleting last message: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps(f"Error deleting last message: {e}")
        }