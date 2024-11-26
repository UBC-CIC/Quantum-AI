import {Stack, StackProps, triggers } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';

// Service files import
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

// Stack import
import { VpcStack } from './vpc-stack';
import {DatabaseStack} from './database-stack';
import { ApiGatewayStack } from './api-gateway-stack';

export class DBFlowStack extends Stack {
    constructor(scope: Construct, id: string, vpcStack: VpcStack, db: DatabaseStack, apiStack: ApiGatewayStack, props?: StackProps){
        super(scope, id, props);

        const resourcePrefix = this.node.tryGetContext('prefix');

        /**
         * 
         * Create an database initializer using lambda
         */

        const psycopgLambdaLayer = apiStack.getLayers()['psycopg2'];   
        const lambdaRole = new iam.Role(this, "lambda-vpc-role", {
          assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
          description: "Role for all Lambda function inside VPC",
        });
        lambdaRole.addToPolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              // Secrets Manager
              "secretsmanager:GetSecretValue",
              "secretsmanager:PutSecretValue"
            ],
            resources: [
              `arn:aws:secretsmanager:${this.region}:${this.account}:secret:QuantumAI/*`,
            ],
          })
        );
        lambdaRole.addToPolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              // CloudWatch Logs
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents",
            ],
            resources: ["arn:aws:logs:*:*:*"],
          })
        );
        lambdaRole.addToPolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              "ec2:CreateNetworkInterface",
              "ec2:DeleteNetworkInterface",
              "ec2:DescribeNetworkInterfaces",
            ],
            resources: ["*"],
          })
        );
        lambdaRole.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMReadOnlyAccess")
        );
        lambdaRole.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess")
        );
        // Create an initilizer for the RDS instance, only invoke during deployment
        const initializerLambda = new triggers.TriggerFunction(this, "quantumAI-triggerLambda", {
            functionName: `${resourcePrefix}-initializerFunction`,
            runtime: lambda.Runtime.PYTHON_3_9,
            handler: "initializer.handler",
            timeout: Duration.seconds(300),
            memorySize: 512,
            environment: {
              DB_SECRET_NAME: db.secretPathAdminName,     // Admin Secret Manager name that only use once here.
              DB_USER_SECRET_NAME: db.secretPathUser.secretName,
              DB_PROXY: db.secretPathTableCreator.secretName,
            },
            vpc: db.dbInstance.vpc,
            code: lambda.Code.fromAsset("lambda/initializer"),
            layers: [psycopgLambdaLayer],
            role: lambdaRole,
        });
    }
}