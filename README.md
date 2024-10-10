# Quantum AI

This prototype explores how Large Language Models (LLMs) can enhance education by offering a personalized and adaptive learning experience. The LLM complements an instructor's role by providing tailored feedback, identifying knowledge gaps, and recommending targeted resources to students. This approach resonates with the core principles of personalized education, transforming the learning experience into a journey of self-discovery and growth.


| Index                                               | Description                                             |
| :-------------------------------------------------- | :------------------------------------------------------ |
| [High Level Architecture](#high-level-architecture) | High level overview illustrating component interactions |
| [Deployment](#deployment-guide)                     | How to deploy the project                               |
| [User Guide](#user-guide)                           | The working solution                                    |
| [Directories](#directories)                         | General project directory structure                     |
| [RAG Documentation](#rag-documentation)             | Documentation on how the project uses RAG               |
| [API Documentation](#api-documentation)             | Documentation on the API the project uses               |
| [Changelog](#changelog)                             | Any changes post publish                                |
| [Credits](#credits)                                 | Meet the team behind the solution                       |
| [License](#license)                                 | License details                                         |

## High-Level Architecture

The following architecture diagram illustrates the various AWS components utilized to deliver the solution. For an in-depth explanation of the frontend and backend stacks, please look at the [Architecture Guide](docs/architectureDeepDive.md).

![Alt text](docs/images/architecture.png)

## Deployment Guide

To deploy this solution, please follow the steps laid out in the [Deployment Guide](./docs/deploymentGuide.md)

## User Guide

Please refer to the [Web App User Guide](./docs/userGuide.md) for instructions on navigating the web app interface.

## Directories

```
├── cdk
│   ├── bin
│   ├── data_ingestion
│   ├── lambda
│   ├── layers
│   ├── lib
│   ├── text_generation
├── docs
└── frontend
    ├── public
    └── src
        ├── assets
        ├── components
        ├── functions
        └── pages
            ├── admin
            ├── instructor
            └── student
```

1. `/cdk`: Contains the deployment code for the app's AWS infrastructure
    - `/bin`: Contains the instantiation of CDK stack
    - `/data_ingestion`: Contains the code required for the Data Ingestion step in retrieval-augmented generation. This folder is used by a Lambda function that runs a container which updates the vectorstore for a course when files are uploaded or deleted.
    - `/lambda`: Contains the lambda functions for the project
    - `/layers`: Contains the required layers for lambda functions
    - `/lib`: Contains the deployment code for all infrastructure stacks
    - `/text_generation`: Contains the code required for the Text Generation step in retrieval-augmented generation. This folder is used by a Lambda function that runs a container which retrieves specific documents and invokes the LLM to generate appropriate responses during a conversation.
2. `/docs`: Contains documentation for the application
3. `/frontend`: Contains the user interface of the application
    - `/public`: public assets used in the application
    - `/src`: contains the frontend code of the application
        - `/assets`: Contains assets used in the application
        - `/components`: Contains components used in the application
        - `/functions`: Contains utility functions used in the application
        - `/pages`: Contains pages used in the application
            - `/admin`: Contains admin pages used in the application
            - `/instructor`: Contains instructor pages used in the application
            - `/student`: Contains student pages used in the application

## RAG Documentation

Here you can learn about how this project performs retrieval-augmented generation (RAG). For a deeper dive into how we use Large Language Models (LLMs) to generate text, please refer to the [Text Generation](./docs/text_generation) folder. For more knowledge on how data is consumed and interpreted for the LLM, please refer to the [Data Ingestion](./docs/data_ingestion) folder.

## API Documentation

Here you can learn about the API the project uses: [API Documentation](./docs/api-documentation.pdf).

## Optional Modifications

Steps to implement optional modifications such as restricting sign-up to certain email domains and allowing instructors to create courses can be found [here](./docs/optionalModifications.md)

## Changelog
N/A

## Credits

This application was architected and developed by [Sean Woo](https://www.linkedin.com/in/seanwoo4/), [Aurora Cheng](https://www.linkedin.com/in/aurora-cheng04/), [Harshinee Sriram](https://www.linkedin.com/in/harshineesriram/), and [Aman Prakash](https://www.linkedin.com/in/aman-prakash-aa48b421b/), with project assistance by [Miranda Newell](https://www.linkedin.com/in/miranda-newell-7669b01b2/). Thanks to the UBC Cloud Innovation Centre Technical and Project Management teams for their guidance and support.

## License

This project is distributed under the [MIT License](LICENSE).

Licenses of libraries and tools used by the system are listed below:

[PostgreSQL license](https://www.postgresql.org/about/licence/)
- For PostgreSQL and pgvector
- "a liberal Open Source license, similar to the BSD or MIT licenses."

[LLaMa 3 Community License Agreement](https://llama.meta.com/llama3/license/)
- For Llama 3 70B Instruct model
