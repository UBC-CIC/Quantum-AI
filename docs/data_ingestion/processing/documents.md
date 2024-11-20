# documents.py

## Table of Contents <a name="table-of-contents"></a>
- [documents.py](#documentspy)
  - [Table of Contents ](#table-of-contents-)
  - [Script Overview ](#script-overview-)
    - [Import Libraries ](#import-libraries-)
    - [AWS Configuration and Setup ](#aws-configuration-and-setup-)
    - [Helper Functions ](#helper-functions-)
    - [Main Functions ](#main-functions-)
    - [Execution Flow ](#execution-flow-)
  - [Detailed Function Descriptions ](#detailed-function-descriptions-)
    - [Function: `extract_txt` ](#function-extract_txt-)
      - [Purpose](#purpose)
      - [Process Flow](#process-flow)
      - [Inputs and Outputs](#inputs-and-outputs)
    - [Function: `store_doc_texts` ](#function-store_doc_texts-)
      - [Purpose](#purpose-1)
      - [Process Flow](#process-flow-1)
      - [Inputs and Outputs](#inputs-and-outputs-1)
    - [Function: `add_document` ](#function-add_document-)
      - [Purpose](#purpose-2)
      - [Process Flow](#process-flow-2)
      - [Inputs and Outputs](#inputs-and-outputs-2)
    - [Function: `store_doc_chunks` ](#function-store_doc_chunks-)
      - [Purpose](#purpose-3)
      - [Process Flow](#process-flow-3)
      - [Inputs and Outputs](#inputs-and-outputs-3)
    - [Function: `process_documents` ](#function-process_documents-)
      - [Purpose](#purpose-4)
      - [Process Flow](#process-flow-4)
      - [Inputs and Outputs](#inputs-and-outputs-4)

## Script Overview <a name="script-overview"></a>
This script automates the process of extracting text from files stored in an AWS S3 bucket, chunking the text semantically, and storing the processed chunks in a vector store. It supports interaction with AWS S3, PGVector for vectorized document storage, and semantic chunking using LangChain's text splitting methods.

### Import Libraries <a name="import-libraries"></a>
- **os, tempfile**: For creating and handling temporary files.
- **logging**: For logging script activities and errors.
- **uuid**: For generating unique identifiers for documents and chunks.
- **BytesIO**: To handle in-memory byte buffers.
- **boto3**: AWS SDK for Python, for interacting with S3.
- **pymupdf**: For reading PDF files.
- **tqdm**: For progress bars during processing.
- **langchain_postgres.PGVector**: Vector store for document storage.
- **langchain_core.documents.Document**: Data structure for document objects.
- **langchain_community.embeddings.BedrockEmbeddings**: Handles the embedding process for text data. This project uses the Amazon Titan Text Embeddings V2 model to generate embeddings.
- **langchain_experimental.text_splitter.SemanticChunker**: Splits text semantically.

### AWS Configuration and Setup <a name="aws-configuration-and-setup"></a>
- **boto3.client('s3')**: Initializes the AWS S3 client for interacting with the S3 buckets, such as downloading documents and uploading processed files.

### Helper Functions <a name="helper-functions"></a>
- **extract_txt**: Extracts text from a file stored in an S3 bucket.
- **store_doc_texts**: Extracts and stores each page of a document in an S3 bucket as individual text files.

### Main Functions <a name="main-functions"></a>
- **add_document**: Handles the complete workflow for processing and adding a document to the vector store, including text extraction, chunking, and storing chunks.
- **store_doc_chunks**: Handles the creation and storage of document chunks in the vector store.
- **process_documents**: Loops through documents in the S3 bucket and processes each one, adding them to the vector store.

### Execution Flow <a name="execution-flow"></a>
The script first sets up AWS credentials using `boto3` and initializes various helper functions to download, extract, and process text from documents in the S3 bucket. The main function processes documents and stores semantic chunks in a vector store, allowing for efficient retrieval and embedding-based search capabilities.

## Detailed Function Descriptions <a name="detailed-function-descriptions"></a>

### Function: `extract_txt` <a name="extract_txt"></a>
```python
def extract_txt(
    bucket: str, 
    file_key: str
) -> str:
    with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
        s3.download_fileobj(bucket, file_key, tmp_file)
        tmp_file_path = tmp_file.name

    try:
        with open(tmp_file_path, 'r', encoding='utf-8') as file:
            text = file.read()
    finally:
        os.remove(tmp_file_path)

    return text
```
#### Purpose
Extract text from a file in an S3 bucket and return it as a string.

#### Process Flow
1. Downloads the specified file from the S3 bucket to a temporary file.
2. Opens and reads the file content.
3. Removes the temporary file after extraction.

#### Inputs and Outputs
- **Inputs**:
  - `bucket`: Name of the S3 bucket.
  - `file_key`: Key of the file in the S3 bucket.
- **Outputs**: 
  - Returns the extracted text from the file.

### Function: `store_doc_texts` <a name="store_doc_texts"></a>
```python
def store_doc_texts(
    bucket: str, 
    topic: str, 
    filename: str, 
    output_bucket: str
) -> List[str]:
    with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
        s3.download_file(bucket, f"{topic}/documents/{filename}", tmp_file.name)
        doc = pymupdf.open(tmp_file.name)
        output_buffer = BytesIO()

        for page_num, page in enumerate(doc, start=1):
            text = page.get_text().encode("utf8")
            output_buffer.write(text)
            output_buffer.write(bytes((12,)))

            page_output_key = f'{topic}/documents/{filename}_page_{page_num}.txt'
            page_output_buffer = BytesIO(text)
            s3.upload_fileobj(page_output_buffer, output_bucket, page_output_key)

        os.remove(tmp_file.name)

    return [f'{topic}/documents/{filename}_page_{page_num}.txt' for page_num in range(1, len(doc) + 1)]
```
#### Purpose
Extract and store each page of a document as a separate text file in an S3 bucket.

#### Process Flow
1. Downloads the document from S3.
2. Iterates through the pages of the document and extracts the text.
3. Uploads each page's text to the specified output S3 bucket.

#### Inputs and Outputs
- **Inputs**:
  - `bucket`: Name of the input S3 bucket containing the document.
  - `topic`: Name of the topic folder in the S3 bucket.
  - `filename`: Name of the document file.
  - `output_bucket`: S3 bucket to store extracted text files.
- **Outputs**: 
  - Returns a list of keys for the stored text files.

### Function: `add_document` <a name="add_document"></a>
```python
def add_document(
    bucket: str, 
    topic: str, 
    filename: str, 
    vectorstore: PGVector, 
    embeddings: BedrockEmbeddings,
    output_bucket: str = 'temp-extracted-data'
) -> List[Document]:
    output_filenames = store_doc_texts(
        bucket=bucket,
        topic=topic,
        filename=filename,
        output_bucket=output_bucket
    )
    this_doc_chunks = store_doc_chunks(
        bucket=output_bucket,
        filenames=output_filenames,
        vectorstore=vectorstore,
        embeddings=embeddings
    )
    
    return this_doc_chunks
```
#### Purpose
Processes and adds a document's chunks to the vector store.

#### Process Flow
1. Extracts text from the document using `store_doc_texts`.
2. Chunks the text using the `SemanticChunker`.
3. Stores the chunks in the vector store with the appropriate metadata.

#### Inputs and Outputs
- **Inputs**:
  - `bucket`: Input S3 bucket containing the document.
  - `topic`: Name of the topic folder in the S3 bucket.
  - `filename`: Name of the document file.
  - `vectorstore`: PGVector instance for storing document chunks.
  - `embeddings`: Embeddings instance to generate chunk embeddings.
  - `output_bucket`: S3 bucket for storing processed text (default is 'temp-extracted-data').
- **Outputs**: 
  - Returns a list of document chunks added to the vector store.

### Function: `store_doc_chunks` <a name="store_doc_chunks"></a>
```python
def store_doc_chunks(
    bucket: str, 
    filenames: List[str],
    vectorstore: PGVector, 
    embeddings: BedrockEmbeddings
) -> List[Document]:
    text_splitter = SemanticChunker(embeddings)
    this_doc_chunks = []

    # Without tqdm: for filename in filenames:
    for filename in tqdm(filenames, desc="Processing pages"):
        this_uuid = str(uuid.uuid4()) # Generating one UUID for all chunks of from a specific page in the document
        output_buffer = BytesIO()
        s3.download_fileobj(bucket, filename, output_buffer)
        output_buffer.seek(0)
        doc_texts = output_buffer.read().decode('utf-8')
        doc_chunks = text_splitter.create_documents([doc_texts])
        
        head, _, _ = filename.partition("_page")
        true_filename = head
        
        doc_chunks = [x for x in doc_chunks if x.page_content]
        
        for doc_chunk in tqdm(doc_chunks, desc=f"Storing chunks for {filename}"):
            if doc_chunk:
                doc_chunk.metadata["source"] = f"s3://{bucket}/{true_filename}"
                doc_chunk.metadata["doc_id"] = this_uuid
                    
                vectorstore.add_documents(
                    documents=[doc_chunk]
                )
                
            else:
                logger.warning(f"Empty chunk for {filename}")
        
        this_doc_chunks.extend(doc_chunks)
       
    return this_doc_chunks
```
#### Purpose
Processes and stores document chunks in the vector store.

#### Process Flow
1. Downloads text files from S3.
2. Splits the text into semantic chunks.
3. Adds each chunk to the vector store with its metadata.

#### Inputs and Outputs
- **Inputs**:
  - `bucket`: S3 bucket containing text files.
  - `filenames`: List of text file keys.
  - `vectorstore`: PGVector instance for storing chunks.
  - `embeddings`: Embeddings instance for creating embeddings.
- **Outputs**: 
  - Returns a list of document chunks stored in the vector store.

### Function: `process_documents` <a name="process_documents"></a>
```python
def process_documents(
    bucket: str, 
    topic: str, 
    vectorstore: PGVector, 
    embeddings: BedrockEmbeddings,
    record_manager: SQLRecordManager
) -> None:
    paginator = s3.get_paginator('list_objects_v2')
    page_iterator = paginator.paginate(Bucket=bucket, Prefix=f"{topic}/")
    all_doc_chunks = []
    
    for page in page_iterator:
        if "Contents" not in page:
            continue  # Skip pages without any content (e.g., if the bucket is empty)
        for file in page['Contents']:
            filename = file['Key']
            print(f"Processing {filename}")
            if filename.split('/')[-2] == "documents": # Ensures that only files in the 'documents' folder are processed
                    this_doc_chunks = add_document(
                        bucket=bucket,
                        topic=topic,
                        filename=os.path.basename(filename),
                        vectorstore=vectorstore,
                        embeddings=embeddings
                    )

                    all_doc_chunks.extend(this_doc_chunks)
    
    if all_doc_chunks:  # Check if there are any documents to index
        idx = index(
            all_doc_chunks, 
            record_manager, 
            vectorstore, 
            cleanup="incremental",
            source_id_key="source"
        )
        logger.info(f"Indexing updates: \n {idx}")
    else:
        logger.info("No documents found for indexing.")
```
#### Purpose
Processes and indexes documents from an S3 bucket, adding them to the vector store.

#### Process Flow
1. Paginates through the contents of the S3 bucket.
2. Identifies relevant documents in the "documents" folder.
3. Adds each document's chunks to the vector store and updates the index.

#### Inputs and Outputs
- **Inputs**:
  - `bucket`: S3 bucket containing the documents.
  - `topic`: Topic folder in the S3 bucket.
  - `vectorstore`: PGVector instance for storing document chunks.
  - `embeddings`: BedrockEmbeddings instance.
  - `record_manager`: SQLRecordManager instance for managing indexing.
- **Outputs**: 
  - No return value, but the documents are processed and indexed.

[🔼 Back to top](#table-of-contents)
