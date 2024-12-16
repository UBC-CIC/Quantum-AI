# Deployment Guide

## Table of Contents
- [Deployment Guide](#deployment-guide)
  - [Table of Contents](#table-of-contents)
  - [Requirements](#requirements)
  - [Pre-Deployment](#pre-deployment)
    - [Create GitHub Personal Access Token](#create-github-personal-access-token)
    - [Enable Models in Bedrock](#enable-models-in-bedrock)
  - [Deployment](#deployment)
    - [Step 1: Fork \& Clone The Repository](#step-1-fork--clone-the-repository)
    - [Step 2: Upload Secrets and Parameters](#step-2-upload-secrets-and-parameters)
    - [Step 3: CDK Deployment](#step-3-cdk-deployment)
  - [Post-Deployment](#post-deployment)
    - [Step 1: Build AWS Amplify App](#step-1-build-aws-amplify-app)
    - [Step 2: Change Redirects](#step-2-change-redirects)
    - [Step 3: Visit Web App](#step-3-visit-web-app)
  - [Creating a User](#creating-a-user)
  - [Disabling Self Sign-up](#disabling-self-sign-up)
  - [Cleanup](#cleanup)
    - [Taking down the deployed stack](#taking-down-the-deployed-stack)

## Requirements
Before you deploy, you must have the following installed on your device:
- [git](https://git-scm.com/downloads)
- [AWS Account](https://aws.amazon.com/account/)
- [GitHub Account](https://github.com/)
- [AWS CLI](https://aws.amazon.com/cli/)
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/cli.html) *(v2.122.0 > required)*
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [node](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs) *(v20.0.0 > required)*
- [docker](https://www.docker.com/products/docker-desktop/)

## Pre-Deployment
### Create GitHub Personal Access Token
To deploy this solution, you will need to generate a GitHub personal access token. Please visit [here](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic) for detailed instruction to create a personal access token.

*Note: when selecting the scopes to grant the token (step 8 of the instruction), make sure you select `repo` scope.*

**Once you create a token, please note down its value as you will use it later in the deployment process.**

Docker must also be running for the deployment to work.

### Enable Models in Bedrock

First, navigate to Amazon Bedrock in the AWS Console. From the home page, click on model access under Bedrock configurations:
![](./images/bedrockhome.png)

Then click on "Modify model access":
![](./images/modifymodels.png)

Finally, enable the relevant models, click next and on the next page click submit. Amazon Titan Embeddings V2 and Meta Llama 3 70B Instruct are required for this project.
![](./images/enablemodels.png)

The relevant models are now enabled in Bedrock.

## Deployment
### Step 1: Fork & Clone The Repository
First, you need to fork the repository. To create a fork, navigate to the [main branch](https://github.com/UBC-CIC/AI-Learning-Assistant) of this repository. Then, in the top-right corner, click `Fork`.

![](./images/fork.jpeg)

You will be directed to the page where you can customize owner, repository name, etc, but you do not have to change any option. Simply click `Create fork` in the bottom right corner.

Now let's clone the GitHub repository onto your machine. To do this:
1. Create a folder on your computer to contain the project code.
2. For an Apple computer, open Terminal. If on a Windows machine, open Command Prompt or Windows Terminal. Enter into the folder you made using the command `cd path/to/folder`. To find the path to a folder on a Mac, right click on the folder and press `Get Info`, then select the whole text found under `Where:` and copy with ⌘C. On Windows (not WSL), enter into the folder on File Explorer and click on the path box (located to the left of the search bar), then copy the whole text that shows up.
3. Clone the GitHub repository by entering the following command. Be sure to replace `<YOUR-GITHUB-USERNAME>` with your own username.
```
git clone https://github.com/<YOUR-GITHUB-USERNAME>/Quantum-AI.git
```
The code should now be in the folder you created. Navigate into the root folder containing the entire codebase by running the command:
```
cd Quantum-AI
```

### Step 2: Upload Secrets and Parameters
You would have to supply your GitHub personal access token you created eariler when dpeloying the solution. Run the following command and ensure you replace `<YOUR-GITHUB-TOKEN>` and `<YOUR-PROFILE-NAME>` with your actual GitHub token and the appropriate AWS profile name.
```
aws secretsmanager create-secret \
    --name github-quantumAI-personal-access-token \
    --secret-string '{\"my-github-token\":\"<YOUR-GITHUB-TOKEN>\"}'\
    --profile <YOUR-PROFILE-NAME>
```

Moreover, you will need to upload your github username to Amazon SSM Parameter Store. You can do so by running the following command. Make sure you replace `<YOUR-GITHUB-USERNAME>` and `<YOUR-PROFILE-NAME>` with your actual username and the appropriate AWS profile name.

```
aws ssm put-parameter \
    --name "quantumAI-owner-name" \
    --value "<YOUR-GITHUB-USERNAME>" \
    --type String \
    --profile <YOUR-PROFILE-NAME>
```

You would have to supply a custom database username when deploying the solution to increase security. Run the following command and ensure you replace `<YOUR-DB-USERNAME>` with the custom name of your choice.

```
aws secretsmanager create-secret \
    --name QuantumAISecrets \
    --secret-string '{\"DB_Username\":\"<YOUR-DB-USERNAME>\"}'\
    --profile <your-profile-name>
```

For example,

```
aws secretsmanager create-secret \
    --name QuantumAISecrets \
    --secret-string '{\"DB_Username\":\"QuantumAISecrets\"}'\
    --profile <your-profile-name>
```

Finally, in order to restrict user sign up to specific email domains, you will need to upload a comma separated list of allowed email domains to Amazon SSM Parameter Store. You can do so by running the following command. Make sure you replace `<YOUR-ALLOWED-EMAIL-DOMAIN-LIST>` and `<YOUR-PROFILE-NAME>` with your actual list and the appropriate AWS profile name.

```
aws ssm put-parameter \
    --name "/QuantumAI/AllowedEmailDomains" \
    --value "<YOUR-ALLOWED-EMAIL-DOMAIN-LIST>" \
    --type SecureString \
    --profile <YOUR-PROFILE-NAME>
```

For example,

```
aws ssm put-parameter \
    --name "/QuantumAI/AllowedEmailDomains" \
    --value "gmail.com,ubc.ca" \
    --type SecureString \
    --profile <YOUR-PROFILE-NAME>
```

### Step 3: CDK Deployment
It's time to set up everything that goes on behind the scenes! For more information on how the backend works, feel free to refer to the Architecture Deep Dive, but an understanding of the backend is not necessary for deployment.

Open a terminal in the `/cdk` directory.

**Download Requirements**: Install requirements with npm by running `npm install` command.


**Initialize the CDK stack**(required only if you have not deployed any resources with CDK in this region before). You can replace`<prefix` with the prefix you want to be added to the names of all the AWS resources that are deployed. Please replace `<your-profile-name>` with the appropriate AWS profile used earlier.
```
cdk synth --context prefix=<prefix> --profile <your-profile-name>
cdk bootstrap aws://<YOUR_AWS_ACCOUNT_ID>/<YOUR_ACCOUNT_REGION> --profile <your-profile-name>
```

**Deploy CDK stack**
You may run the following command to deploy the stacks all at once. Again, replace `<your-profile-name>` with the appropriate AWS profile used earlier.

```
cdk deploy --all --context prefix=<prefix> --profile <your-profile-name>
```

For example,

```
cdk deploy --all --context prefix=QuantumAI-production --profile <your-profile-name>
```

## Post-Deployment
### Step 1: Build AWS Amplify App

1. Log in to AWS console, and navigate to **AWS Amplify**. You can do so by typing `Amplify` in the search bar at the top.
2. From `All apps`, click `quantumAI-amplify`.
3. Then click `main` under `branches`
4. Click `run job` and wait for the build to complete.
5. You now have access to the `Amplify App ID` and the public domain name to use the web app.

### Step 2: Change Redirects

1. Click back to navigate to `quamtumAI-amplify/Overview`
2. In the left side bar click   `Rewrites and Redirects` under `Hosting`
3. Click `manage redirects` on the top right
4. Click `add rewrite`
5. For `Source address` type `</^[^.]+$|.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>`
6. For `Target address` type `/`
7. For `Type` select `404 (Redirect)`
8. Click `Save`

### Step 3: Visit Web App
You can now navigate to the web app URL to see your application in action.

### Step 4 (Optional): Change Application Logo
In order to change the logo that appears in multiple places in the application, you can replace the `logo.png` file in the `frontend/src/assets`directory with your own file but keep the same name. This will replace the current application logo with your own.

## Creating a User

To set up a user account on the app, you will need to do the following steps:

1. At the [AWS online console](https://console.aws.amazon.com/console/home), enter `Cognito` in the search bar.
   ![alt text](images/cognito_search.png)
2. Click `User Pools` from the left hand sidebar and select the user pool with QuantumAI.
   ![alt text](images/cognito_user_pool.png)
3. Click the `Users` tab, then click `Create User`.
   ![alt text](images/cognito_create_user.png)
4. For Invitation message, select `Send an email invitation`. Then fill in the user's email address in the Email address text field below and select the `Mark email address as verified`. For Temporary password, select `Generate a password`. Then click `Create User`.
   ![alt text](images/cognito_new_user.png)
5. Once you have an account you need to be added to either the "admin" or "user" user group. First, find your email and click on the user. Next, here is an example with a user being added to the admin user group:
![image](./images/select-admin.png)
![image](./images/add-user-group.png)

6. The user will receive an email to the email address that was previously entered containing their temporary password.
   ![alt text](images/signupcode.png)
7. When the user enters their email and temporary password on the sign in page of the app, they will then be prompted to replace their temporary password by setting a new password for the account.
8. The new user account has been created!

## Disabling Self Sign-up
**This will not allow users to create their own accounts through the application.**

1. Navigate back to same user pool in the previous step on the Cognito Console, click on `Sign-up` and scroll down until `Self-service sign-up`.
 ![alt text](images/cognito_signup.png)
1. In order to disable self sign up, the `Self-registration` option must be disabled. If it is not, simply click the `Edit` button and disable the feature.
 ![alt text](images/cognito_disable_signup.png)

## Cleanup
### Taking down the deployed stack
To take down the deployed stack for a fresh redeployment in the future, navigate to AWS Cloudformation on the AWS Console, click on the stack and hit Delete.

Please wait for the stacks in each step to be properly deleted before deleting the stack downstream.

Also make sure to delete secrets in Secrets Manager and the S3 buckets which are not automatically deleted with the stacks.
