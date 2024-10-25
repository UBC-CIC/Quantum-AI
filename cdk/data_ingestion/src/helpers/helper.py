import logging
import boto3
from typing import Dict, Optional
import psycopg2

from langchain_aws import BedrockEmbeddings
from langchain_postgres import PGVector
from langchain.indexes import SQLRecordManager

from processing.documents import process_documents
s3 = boto3.client('s3')

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_vectorstore(
    collection_name: str, 
    embeddings: BedrockEmbeddings, 
    dbname: str, 
    user: str, 
    password: str, 
    host: str, 
    port: int
) -> Optional[PGVector]:
    """
    Initialize and return a PGVector instance.
    
    Args:
    collection_name (str): The name of the collection.
    embeddings (BedrockEmbeddings): The embeddings instance.
    dbname (str): The name of the database.
    user (str): The database user.
    password (str): The database password.
    host (str): The database host.
    port (int): The database port.
    
    Returns:
    Optional[PGVector]: The initialized PGVector instance, or None if an error occurred.
    """
    try:
        connection_string = (
            f"postgresql+psycopg://{user}:{password}@{host}:{port}/{dbname}"
        )

        logger.info("Initializing the VectorStore")
        vectorstore = PGVector(
            embeddings=embeddings,
            collection_name=collection_name,
            connection=connection_string,
            use_jsonb=True
        )

        logger.info("VectorStore initialized")
        return vectorstore, connection_string

    except Exception as e:
        logger.error(f"Error initializing vector store: {e}")
        return None
    
def store_topic_data(
    bucket: str, 
    topic: str, 
    vectorstore_config_dict: Dict[str, str], 
    embeddings: BedrockEmbeddings
) -> None:
    """
    Store topic data from an S3 bucket into the vectorstore.
    
    Args:
    bucket (str): The name of the S3 bucket.
    topic (str): The topic name/folder in the S3 bucket.
    vectorstore_config_dict (Dict[str, str]): The configuration dictionary for the vectorstore.
    embeddings (BedrockEmbeddings): The embeddings instance.
    """
    vectorstore, connection_string = get_vectorstore(
        collection_name=vectorstore_config_dict['collection_name'],
        embeddings=embeddings,
        dbname=vectorstore_config_dict['dbname'],
        user=vectorstore_config_dict['user'],
        password=vectorstore_config_dict['password'],
        host=vectorstore_config_dict['host'],
        port=int(vectorstore_config_dict['port'])
    )
    
    print("vector_store",vectorstore)
    
    if vectorstore:
        # define record manager
        namespace = f"pgvector/{vectorstore_config_dict['collection_name']}"
        record_manager = SQLRecordManager(
            namespace, db_url=connection_string
        )
        record_manager.create_schema()

    if not vectorstore:
        logger.error("VectorStore could not be initialized")
        return

    # Process all files in the "documents" folder
    process_documents(
        bucket=bucket,
        topic=topic,
        vectorstore=vectorstore,
        embeddings=embeddings,
        record_manager=record_manager
    )
