# chat.py

## Table of Contents <a name="table-of-contents"></a>
- [chat.py](#chatpy)
  - [Table of Contents ](#table-of-contents-)
  - [Script Overview ](#script-overview-)
    - [Import Libraries ](#import-libraries-)
    - [AWS and LLM Integration ](#aws-and-llm-integration-)
    - [Helper Functions ](#helper-functions-)
    - [Execution Flow ](#execution-flow-)
  - [Detailed Function Descriptions ](#detailed-function-descriptions-)
    - [Function: `create_dynamodb_history_table` ](#function-create_dynamodb_history_table-)
      - [Purpose](#purpose)
      - [Process Flow](#process-flow)
      - [Inputs and Outputs](#inputs-and-outputs)
    - [Function: `get_bedrock_llm` ](#function-get_bedrock_llm-)
      - [Purpose](#purpose-1)
      - [Process Flow](#process-flow-1)
      - [Inputs and Outputs](#inputs-and-outputs-1)
    - [Function: `get_user_query` ](#function-get_user_query-)
      - [Purpose](#purpose-2)
      - [Process Flow](#process-flow-2)
      - [Inputs and Outputs](#inputs-and-outputs-2)
    - [Function: `get_initial_user_query` ](#function-get_initial_user_query-)
      - [Purpose](#purpose-3)
      - [Process Flow](#process-flow-3)
      - [Inputs and Outputs](#inputs-and-outputs-3)
    - [Function: `get_response` ](#function-get_response-)
      - [Purpose](#purpose-4)
      - [Process Flow](#process-flow-4)
      - [Inputs and Outputs](#inputs-and-outputs-4)
    - [Function: `split_into_sentences` ](#function-split_into_sentences-)
      - [Purpose](#purpose-5)
      - [Process Flow](#process-flow-5)
      - [Inputs and Outputs](#inputs-and-outputs-5)
    - [Function: `get_llm_output` ](#function-get_llm_output-)
      - [Purpose](#purpose-6)
      - [Process Flow](#process-flow-6)
      - [Inputs and Outputs](#inputs-and-outputs-6)

## Script Overview <a name="script-overview"></a>
This script integrates AWS services like DynamoDB and Bedrock LLM with LangChain to create an chatbot that can answer user queries related to a specified topic . It also includes history-aware functionality, which uses chat history to provide relevant context during conversations.

### Import Libraries <a name="import-libraries"></a>
- **boto3**: AWS SDK to interact with services like DynamoDB and manage resources.
- **re**: The re library in Python is used for working with regular expressions, which are sequences of characters that form search patterns.
- **ChatBedrock**: Interface for interacting with AWS Bedrock LLM.
- **ChatPromptTemplate, MessagesPlaceholder**: Templates for setting up prompts in LangChain with chat history awareness.
- **create_stuff_documents_chain, create_retrieval_chain**: LangChain utilities to combine document chains and retrieval chains for context-aware question-answering.
- **RunnableWithMessageHistory**: Allows the inclusion of chat history in the reasoning chain.
- **DynamoDBChatMessageHistory**: Stores chat history in DynamoDB.

### AWS and LLM Integration <a name="aws-and-llm-integration"></a>
- **DynamoDB**: Used to store and retrieve session history for conversations between the user and the chatbot.
- **ChatBedrock**: Used to interact with AWS Bedrock LLM for generating responses and engaging with the user.

### Helper Functions <a name="helper-functions"></a>
- **create_dynamodb_history_table**: Creates a DynamoDB table to store chat session history if it doesn't already exist.
- **get_bedrock_llm**: Retrieves an instance of the Bedrock LLM based on a provided model ID.
- **get_user_query**: Formats a user's query into a structured template suitable for processing.
- **get_response**: Manages the interaction between the user query, the Bedrock LLM, and the history-aware retriever to generate responses.
- **get_llm_output**: Processes the output from the LLM and checks if the user's competency has been achieved.

### Execution Flow <a name="execution-flow"></a>
1. **DynamoDB Table Creation**: The `create_dynamodb_history_table` function ensures that a DynamoDB table is available to store session history.
2. **Query Processing**: The `get_user_query` function formats user queries for processing.
3. **Response Generation**: The `get_response` function uses the Bedrock LLM and chat history to generate responses to user queries and evaluates the user's progress toward mastering the topic.

## Detailed Function Descriptions <a name="detailed-function-descriptions"></a>

### Function: `create_dynamodb_history_table` <a name="create_dynamodb_history_table"></a>
```python
def create_dynamodb_history_table(table_name: str) -> None:
    # Get the service resource and client.
    dynamodb_resource = boto3.resource("dynamodb")
    dynamodb_client = boto3.client("dynamodb")
    
    # Retrieve the list of tables that currently exist.
    existing_tables = dynamodb_client.list_tables()['TableNames']
    
    if table_name not in existing_tables:  # Create a new table if it doesn't exist.
        # Create the DynamoDB table.
        table = dynamodb_resource.create_table(
            TableName=table_name,
            KeySchema=[{"AttributeName": "SessionId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "SessionId", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        # Wait until the table exists.
        table.meta.client.get_waiter("table_exists").wait(TableName=table_name)
```
#### Purpose
Creates a DynamoDB table to store the chat session history if the table doesn't already exist.

#### Process Flow
1. **Check Existing Tables**: Retrieves the list of existing DynamoDB tables.
2. **Table Creation**: If the specified table does not exist, creates it with a `SessionId` key schema and sets up pay-per-request billing mode.
3. **Wait for Table**: Waits for the table creation to complete before returning.

#### Inputs and Outputs
- **Inputs**:
  - `table_name`: The name of the DynamoDB table to create.
  
- **Outputs**:
  - No return value. The function ensures that the specified table exists.

---

### Function: `get_bedrock_llm` <a name="get_bedrock_llm"></a>
```python
def get_bedrock_llm(
    bedrock_llm_id: str,
    temperature: float = 0
) -> ChatBedrock:
    return ChatBedrock(
        model_id=bedrock_llm_id,
        model_kwargs=dict(temperature=temperature),
    )
```
#### Purpose
Retrieves a Bedrock LLM instance based on the provided model ID, with optional control over response randomness through the `temperature` parameter.

#### Process Flow
1. **Create LLM Instance**: Initializes a `ChatBedrock` instance with the specified model ID and temperature setting.
2. **Return LLM**: Returns the initialized LLM instance.

#### Inputs and Outputs
- **Inputs**:
  - `bedrock_llm_id`: The model ID for the Bedrock LLM.
  - `temperature`: Controls the randomness of the LLM's responses (default is 0 for deterministic outputs).
  
- **Outputs**:
  - Returns a `ChatBedrock` instance.

---

### Function: `get_user_query` <a name="get_user_query"></a>
```python
def get_user_query(raw_query: str) -> str:
    user_query = f"""
    user
    {raw_query}
    
    """
    return user_query
```
#### Purpose
Formats a raw user query into a structured template suitable for further processing by the LLM.

#### Process Flow
1. **Format Query**: Wraps the user's query with the `user` label to structure it for the LLM.
2. **Return Formatted Query**: Returns the structured query.

#### Inputs and Outputs
- **Inputs**:
  - `raw_query`: The raw query input from the user.
  
- **Outputs**:
  - Returns the formatted query string.

---

### Function: `get_initial_user_query` <a name="get_initial_user_query"></a>
```python
def get_initial_user_query(topic: str) -> str:
    user_query = f"""
    user
    Greet me and then ask me a question related to the topic: {topic}. 
    """
    return user_query
```
#### Purpose
Generates an initial prompt asking the user to greet the system and pose a question related to a specific topic.

#### Process Flow
1. **Generate Initial Query**: Constructs a query asking the user to greet the system and inquire about a specific topic.
2. **Return Query**: Returns the generated query.

#### Inputs and Outputs
- **Inputs**:
  - `topic`: The topic for which the initial question should be generated.
  
- **Outputs**:
  - Returns the formatted initial query string.

---

### Function: `get_response` <a name="get_response"></a>
```python
def get_response(
    query: str,
    topic: str,
    llm: ChatBedrock,
    history_aware_retriever,
    table_name: str,
    session_id: str
) -> dict:
    # Create a system prompt for the question answering
    system_prompt = (
        ""
        "system"
        "You are an instructor for a course. "
        f"Your job is to help the user master the topic: {topic}. \n"        
        "Engage with the user by asking questions and conversing with them to identify any gaps in their understanding of the topic. If you identify gaps, address these gaps by providing explanations, answering the user's questions, and referring to the relevant context to help the user gain a comprehensive understanding of the topic. "
        "Continue this process until you determine that the user has mastered the topic. \nOnce mastery is achieved, include COMPETENCY ACHIEVED in your response and do not ask any further questions about the topic. "
        "Use the following pieces of retrieved context to answer "
        "a question asked by the user. Use three sentences maximum and keep the "
        "answer concise. End each answer with a question that tests the user's knowledge about the topic."
        ""
        "documents"
        "{context}"
        ""
        "assistant"
    )
    
    qa_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ]
    )
    question_answer_chain = create_stuff_documents_chain(llm, qa_prompt)
    rag_chain = create_retrieval_chain(history_aware_retriever, question_answer_chain)

    conversational_rag_chain = RunnableWithMessageHistory(
        rag_chain,
        lambda session_id: DynamoDBChatMessageHistory(
            table_name=table_name, 
            session_id=session_id
        ),
        input_messages_key="input",
        history_messages_key="chat_history",
        output_messages_key="answer",
    )
    
    # Generate the response
    response = conversational_rag_chain.invoke(
        {
            "input": query
        },
        config={
            "configurable": {"session_id": session_id}
        },  # constructs a key "session_id" in `store`.
    )["answer"]
    
    return get_llm_output(response)
```
#### Purpose
Generates a response to the user's query using the LLM and a history-aware retriever, incorporating context from previous conversations stored in DynamoDB.

#### Process Flow
1. **Prompt Setup**: Creates a system prompt instructing the LLM to help the user master a specific topic, engaging them in conversation and filling gaps in their understanding.
2. **Contextual Question Answering**: Uses a retrieval chain to fetch relevant documents based on the user's query and chat history.
3. **Chat History Handling**: The conversation history is managed using `DynamoDBChatMessageHistory` for the specific session.
4. **Generate Response**: Generates the response using the LLM and returns the result.

#### Inputs and Outputs
- **Inputs**:
  - `query`: The user's query string.
  - `topic`: The topic the user is learning about.
  - `llm`: The Bedrock LLM instance.
  - `history_aware_retriever`: The retriever providing relevant documents for the query.
  - `table_name`: DynamoDB table name used to store the chat history.
  - `session_id`: Unique identifier for the chat session.
  
- **Outputs**:
  - Returns a dictionary containing the response and the source documents used for retrieval.

---

### Function: `split_into_sentences` <a name="split_into_sentences"></a>
```python
def split_into_sentences(paragraph: str) -> list[str]:
    # Regular expression pattern
    sentence_endings = r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s'
    sentences = re.split(sentence_endings, paragraph)
    return sentences
```
#### Purpose
Splits a given paragraph into individual sentences using a regular expression to detect sentence boundaries while avoiding incorrect splits at abbreviations and edge cases.

#### Process Flow
1. **Regular Expression Pattern**: The pattern `sentence_endings` is designed to identify sentence boundaries marked by periods (`.`), question marks (`?`), or exclamation marks (`!`) followed by a whitespace character. Negative lookbehind assertions are used to prevent splitting on common abbreviations (e.g., "Dr.", "U.S."). Here is a breakdown of the regular expression pattern:
    - `(?<!\w\.\w.)`: Negative lookbehind to avoid splitting within abbreviations like "e.g." or "U.S."
    - `(?<![A-Z][a-z]\.)`: Negative lookbehind to avoid splitting after titles like "Dr." or "Mrs."
    - `(?<=\.|\?|\!)`: Positive lookbehind to ensure the split occurs after a period (.), question mark (?), or exclamation mark (!).
    - `\s`: Matches a whitespace character where the actual split will occur.
3. **Split a paragraph into sentences**: The `re.split()` function uses the `sentence_endings` pattern to split the input paragraph into a list of sentences. This results in a list where each element is a sentence extracted from the paragraph. 
4. **Return sentences list**: The function returns the list of sentences for further processing.

#### Inputs and Outputs
- **Inputs**:
  - `paragraph` (*str*): The input text paragraph to be split into sentences.
  
- **Outputs**:
  - Returns a `list[str]`: A list where each element is a sentence from the input paragraph.

---

### Function: `get_llm_output` <a name="get_llm_output"></a>
```python
def get_llm_output(response: str) -> dict:
    if "COMPETENCY ACHIEVED" not in response:
        return dict(
            llm_output=response,
            llm_verdict=False
        )
    
    elif "COMPETENCY ACHIEVED" in response:
        sentences = split_into_sentences(response)
        
        for i in range(len(sentences)):
            if "COMPETENCY ACHIEVED" in sentences[i]:
                llm_response = ' '.join(sentences[0:i-1])
                
                if sentences[i-1][-1] == '?':
                    return dict(
                        llm_output=llm_response,
                        llm_verdict=False
                    )
                else:
                    return dict(
                        llm_output=llm_response,
                        llm_verdict=True
                    )
    elif "compet" in response.lower() or "master" in response.lower():
        return dict(
            llm_output=response,
            llm_verdict=True
        )
```
#### Purpose
Processes the response from the LLM to determine if competency in the topic has been achieved by the user, and extracts the relevant output.

#### Process Flow
1. **Check for "COMPETENCY ACHIEVED" Absence**: If **"COMPETENCY ACHIEVED"** is **not** in the response, return the original response with `llm_verdict` set to `False`.
2. **Check for "COMPETENCY ACHIEVED" Presence**: If **"COMPETENCY ACHIEVED"** is in the response:
  - Splits the response into sentences using `split_into_sentences(response)`.
  - Iterates through the sentences to find the one containing **"COMPETENCY ACHIEVED"**.
  - Extracts all sentences before **"COMPETENCY ACHIEVED"** and joins them into `llm_response`.
  - Checks the punctuation of the sentence immediately before **"COMPETENCY ACHIEVED"**:
    - If the preceding sentence ends with a question mark (`?`):
      - Sets `llm_verdict` to `False` (indicating competency not achieved).
    - Else:
      - Sets `llm_verdict` to `True` (indicating competency achieved).
  - Returns `llm_response` and `llm_verdict`.
3. **Check for Keywords "compet" or "master"**: If the **"compet"** or **"master"** word stems are in the response, return the original response with `llm_verdict` set to `True`.

#### Inputs and Outputs
- **Inputs**:
  - `response`: The response generated by the LLM.
  
- **Outputs**:
  - Returns a dictionary with the LLM's output and a boolean indicating whether competency has been achieved.

[🔼 Back to top](#table-of-contents)
