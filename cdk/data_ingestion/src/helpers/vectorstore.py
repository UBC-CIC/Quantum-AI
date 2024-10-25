from typing import Dict

from helpers.helper import store_topic_data

def update_vectorstore(
    bucket: str,
    topic: str,
    vectorstore_config_dict: Dict[str, str],
    embeddings#: BedrockEmbeddings
) -> None:
    """
    Update the vectorstore with embeddings for all documents and images in the S3 bucket.

    Args:
    bucket (str): The name of the S3 bucket containing the topic folders.
    topic (str): The name of the topic folder within the S3 bucket.
    vectorstore_config_dict (Dict[str, str]): The configuration dictionary for the vectorstore, including parameters like collection name, database name, user, password, host, and port.
    embeddings (BedrockEmbeddings): The embeddings instance used to process the documents and images.

    Returns:
    None
    """
    store_topic_data(
        bucket=bucket,
        topic=topic,
        vectorstore_config_dict=vectorstore_config_dict,
        embeddings=embeddings
    )