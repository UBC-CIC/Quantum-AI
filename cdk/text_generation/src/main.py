import os
import json
import boto3
import logging
import psycopg2
import langchain
from langchain_aws import BedrockEmbeddings
from helpers.vectorstore import get_vectorstore_retriever
from helpers.chat import get_bedrock_llm, get_initial_user_query, get_user_query, create_dynamodb_history_table, get_response, update_session_name
langchain.debug = True
langchain.verbose = True

# Set up basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
REGION = os.environ["REGION"]

def get_secret(secret_name, expect_json=True):
    try:
        # secretsmanager client to get db credentials
        sm_client = boto3.client("secretsmanager")
        response = sm_client.get_secret_value(SecretId=secret_name)["SecretString"]
        
        if expect_json:
            return json.loads(response)
        else:
            
            return response

    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode JSON for secret {secret_name}: {e}")
        raise ValueError(f"Secret {secret_name} is not properly formatted as JSON.")
    except Exception as e:
        logger.error(f"Error fetching secret {secret_name}: {e}")
        raise

def get_parameter(param_name):
    """
    Fetch a parameter value from Systems Manager Parameter Store.
    """
    try:
        ssm_client = boto3.client("ssm", region_name=REGION)
        response = ssm_client.get_parameter(Name=param_name, WithDecryption=True)
        return response["Parameter"]["Value"]
    except Exception as e:
        logger.error(f"Error fetching parameter {param_name}: {e}")
        raise
    
## GET PARAMETER VALUES FOR CONSTANTS
BEDROCK_LLM_ID = get_parameter(os.environ["BEDROCK_LLM_PARAM"])
EMBEDDING_MODEL_ID = get_parameter(os.environ["EMBEDDING_MODEL_PARAM"])
TABLE_NAME = get_parameter(os.environ["TABLE_NAME_PARAM"])

## GETTING AMAZON TITAN EMBEDDINGS MODEL
bedrock_runtime = boto3.client(
    service_name="bedrock-runtime",
    region_name=REGION,
)

embeddings = BedrockEmbeddings(
    model_id=EMBEDDING_MODEL_ID, 
    client=bedrock_runtime,
    region_name=REGION
)

create_dynamodb_history_table(TABLE_NAME)

def get_topic_name(topic_id):
    connection = None
    cur = None
    try:
        logger.info(f"Fetching topic name for topic_id: {topic_id}")
        db_secret = get_secret(DB_SECRET_NAME)

        connection_params = {
            'dbname': db_secret["dbname"],
            'user': db_secret["username"],
            'password': db_secret["password"],
            'host': db_secret["host"],
            'port': db_secret["port"]
        }

        connection_string = " ".join([f"{key}={value}" for key, value in connection_params.items()])

        connection = psycopg2.connect(connection_string)
        cur = connection.cursor()
        logger.info("Connected to RDS instance!")

        cur.execute("""
            SELECT topic_name 
            FROM "Topics" 
            WHERE topic_id = %s;
        """, (topic_id,))
        
        result = cur.fetchone()
        logger.info(f"Query result: {result}")
        topic_name = result[0] if result else None
        
        cur.close()
        connection.close()
        
        if topic_name:
            logger.info(f"Topic name for topic_id {topic_id} found: {topic_name}")
        else:
            logger.warning(f"No topic name found for topic_id {topic_id}")
        
        return topic_name

    except Exception as e:
        logger.error(f"Error fetching topic name: {e}")
        if connection:
            connection.rollback()
        return None
    finally:
        if cur:
            cur.close()
        if connection:
            connection.close()
        logger.info("Connection closed.")

def get_system_prompt(topic_id):
    connection = None
    cur = None
    try:
        logger.info(f"Fetching system prompt for topic_id: {topic_id}")
        db_secret = get_secret(DB_SECRET_NAME)

        connection_params = {
            'dbname': db_secret["dbname"],
            'user': db_secret["username"],
            'password': db_secret["password"],
            'host': db_secret["host"],
            'port': db_secret["port"]
        }

        connection_string = " ".join([f"{key}={value}" for key, value in connection_params.items()])

        connection = psycopg2.connect(connection_string)
        cur = connection.cursor()
        logger.info("Connected to RDS instance!")

        cur.execute("""
            SELECT system_prompt 
            FROM "Topics" 
            WHERE topic_id = %s;
        """, (topic_id,))
        
        result = cur.fetchone()
        logger.info(f"Query result: {result}")
        system_prompt = result[0] if result else None
        
        cur.close()
        connection.close()
        
        if system_prompt:
            logger.info(f"System prompt for topic_id {topic_id} found: {system_prompt}")
        else:
            logger.warning(f"No system prompt found for topic_id {topic_id}")
        
        return system_prompt

    except Exception as e:
        logger.error(f"Error fetching system prompt: {e}")
        if connection:
            connection.rollback()
        return None
    finally:
        if cur:
            cur.close()
        if connection:
            connection.close()
        logger.info("Connection closed.")

def handler(event, context):
    logger.info("Text Generation Lambda function is called!")

    query_params = event.get("queryStringParameters", {})

    topic_id = query_params.get("topic_id", "")
    topic = get_topic_name(topic_id)
    session_id = query_params.get("session_id", "")
    session_name = query_params.get("session_name") or f"New Chat - {topic}"

    if not topic_id:
        logger.error("Missing required parameter: topic_id")
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Missing required parameter: topic_id')
        }

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

    system_prompt = get_system_prompt(topic_id)

    if system_prompt is None:
        logger.error(f"Error fetching system prompt for topic_id: {topic_id}")
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error fetching system prompt')
        }

    if topic is None:
        logger.error(f"Invalid topic_id: {topic_id}")
        return {
            'statusCode': 400,
            'body': json.dumps('Invalid topic_id')
        }
    
    body = {} if event.get("body") is None else json.loads(event.get("body"))
    question = body.get("message_content", "")
    
    if not question:
        logger.error(f"No message content found in the request body.")
        return {
            'statusCode': 400,
            'body': json.dumps('No message content found in the request body')
        }
    else:
        logger.info(f"Processing user question: {question}")
        user_query = get_user_query(question)
    
    try:
        logger.info("Creating Bedrock LLM instance.")
        llm = get_bedrock_llm(BEDROCK_LLM_ID)
    except Exception as e:
        logger.error(f"Error getting LLM from Bedrock: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error getting LLM from Bedrock')
        }
    
    try:
        logger.info("Retrieving vectorstore config.")
        db_secret = get_secret(DB_SECRET_NAME)
        vectorstore_config_dict = {
            'collection_name': topic_id,
            'dbname': db_secret["dbname"],
            'user': db_secret["username"],
            'password': db_secret["password"],
            'host': db_secret["host"],
            'port': db_secret["port"]
        }
    except Exception as e:
        logger.error(f"Error retrieving vectorstore config: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error retrieving vectorstore config')
        }
    
    try:
        logger.info("Creating history-aware retriever.")
        history_aware_retriever = get_vectorstore_retriever(
            llm=llm,
            vectorstore_config_dict=vectorstore_config_dict,
            embeddings=embeddings
        )
    except Exception as e:
        logger.error(f"Error creating history-aware retriever: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error creating history-aware retriever')
        }
    
    try:
        logger.info("Generating response from the LLM.")
        response = get_response(
            query=user_query,
            llm=llm,
            history_aware_retriever=history_aware_retriever,
            table_name=TABLE_NAME,
            session_id=session_id,
            topic_system_prompt=system_prompt
        )
    except Exception as e:
        logger.error(f"Error getting response: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error getting response')
        }
    
    try:
        logger.info("Updating session name if this is the first exchange between the LLM and user.")
        potential_session_name = update_session_name(TABLE_NAME, session_id, BEDROCK_LLM_ID, topic)
        if potential_session_name:
            logger.info("This is the first exchange between the LLM and user. Updating session name.")
            session_name = potential_session_name
        else:
            logger.info("Not the first exchange between the LLM and user. Session name remains the same.")
    except Exception as e:
        logger.error(f"Error updating session name: {e}")
        session_name = f"New Chat - {topic}"
    
    logger.info("Returning the generated response.")
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
        },
        "body": json.dumps({
            "session_name": session_name,
            "llm_output": response.get("llm_output", "LLM failed to create response"),
        })
    }
