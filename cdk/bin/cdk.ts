#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AmplifyStack } from '../lib/amplify-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { DatabaseStack } from '../lib/database-stack';
import { DBFlowStack } from '../lib/dbFlow-stack';
import { VpcStack } from '../lib/vpc-stack';
const app = new cdk.App();

const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION 
};

const vpcStack = new VpcStack(app, 'QuantumAIVpcStack', { env });
const dbStack = new DatabaseStack(app, 'QuantumAIDatabaseStack', vpcStack, { env });
const apiStack = new ApiGatewayStack(app, 'QuantumAIApiGatewayStack', dbStack, vpcStack,  { env });
const dbFlowStack = new DBFlowStack(app, 'QuantumAIDBFlowStack', vpcStack, dbStack, apiStack, { env });
const amplifyStack = new AmplifyStack(app, 'QuantumAIAmplifyStack',apiStack, { env });