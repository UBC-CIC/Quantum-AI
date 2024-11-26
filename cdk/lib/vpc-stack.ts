import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export class VpcStack extends Stack {
  public readonly vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const resourcePrefix = this.node.tryGetContext('prefix');

    const natGatewayProvider = ec2.NatProvider.gateway();

    // VPC for application
    this.vpc = new ec2.Vpc(this, `${resourcePrefix}-VPC`, {
      //cidr: "10.0.0.0/16",
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGatewayProvider: natGatewayProvider,
      natGateways: 1,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public-subnet-1",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: "private-subnet-1",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
            name: "isolated-subnet-1",
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ]
    });

    this.vpc.addFlowLog("quantumAI-vpcFlowLog");

    // Get default security group for VPC
    const defaultSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      id,
      this.vpc.vpcDefaultSecurityGroup
    );

    // Add secrets manager endpoint to VPC
    this.vpc.addInterfaceEndpoint("Secrets Manager Endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // Add RDS endpoint to VPC
    this.vpc.addInterfaceEndpoint("RDS Endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.RDS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });
  }
}