import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Fn } from 'aws-cdk-lib';

export class VpcStack extends Stack {
  public readonly vpc: ec2.Vpc;
  public readonly vpcCidrString: string;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const existingVpcId: string = ''; //CHANGE IF DEPLOYING WITH EXISTING VPC

    if (existingVpcId != '') {
      //const publicSubnetCIDR = cdk.aws_ssm.StringParameter.valueFromLookup(this, 'public-subnet-cidr');
      //const AWSControlTowerStackSet = cdk.aws_ssm.StringParameter.valueFromLookup(this, 'ControlTowerStackSet');
      
      const AWSControlTowerStackSet = ""; //CHANGE TO YOUR CONTROL TOWER STACK SET
      const prefix = "QuantumAI-production";

      this.vpcCidrString = "172.31.96.0/20";

      // VPC for application
      this.vpc = ec2.Vpc.fromVpcAttributes(this, `${id}-Vpc`, {
        vpcId: existingVpcId,
        availabilityZones: ["ca-central-1a", "ca-central-1b", "ca-central-1d"],
        privateSubnetIds: [
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet1AID`), 
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet2AID`), 
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet3AID`)
        ],
        privateSubnetRouteTableIds: [
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet1ARouteTable`), 
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet2ARouteTable`), 
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet3ARouteTable`)
        ],
        isolatedSubnetIds: [
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet1AID`), 
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet2AID`), 
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet3AID`)
        ],
        isolatedSubnetRouteTableIds: [
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet1ARouteTable`), 
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet2ARouteTable`), 
            Fn.importValue(`${AWSControlTowerStackSet}-PrivateSubnet3ARouteTable`)
        ],
        vpcCidrBlock: Fn.importValue(`${AWSControlTowerStackSet}-VPCCIDR`),
      }) as ec2.Vpc;

      // Create a public subnet
      const publicSubnet = new ec2.Subnet(this, `PublicSubnet`, {
          vpcId: this.vpc.vpcId,
          availabilityZone: this.vpc.availabilityZones[0],
          cidrBlock: this.vpcCidrString,
          mapPublicIpOnLaunch: true,
      });

      // Create an Internet Gateway and attach it to the VPC
      const internetGateway = new ec2.CfnInternetGateway(this, `InternetGateway`, {});
      new ec2.CfnVPCGatewayAttachment(this, 'VPCGatewayAttachment', {
          vpcId: this.vpc.vpcId,
          internetGatewayId: internetGateway.ref,
      });

      // Create a route table for the public subnet
      const publicRouteTable = new ec2.CfnRouteTable(this, `PublicRouteTable`, {
          vpcId: this.vpc.vpcId,
      });

      // Associate the public subnet with the new route table
      new ec2.CfnSubnetRouteTableAssociation(this, `PublicSubnetAssociation`, {
          subnetId: publicSubnet.subnetId,
          routeTableId: publicRouteTable.ref,
      });

      // Add a NAT Gateway in the public subnet
      const natGateway = new ec2.CfnNatGateway(this, `NatGateway`, {
          subnetId: publicSubnet.subnetId,
          allocationId: new ec2.CfnEIP(this, 'EIP', {}).attrAllocationId,
      });

      // Create a route to the Internet Gateway
      new ec2.CfnRoute(this, `PublicRoute`, {
          routeTableId: publicRouteTable.ref,
          destinationCidrBlock: '0.0.0.0/0',
          gatewayId: internetGateway.ref,
      });

      // Update route table for private subnets
      new ec2.CfnRoute(this, `${prefix}PrivateSubnetRoute1`, {
          routeTableId: this.vpc.privateSubnets[0].routeTable.routeTableId,
          destinationCidrBlock: '0.0.0.0/0',
          natGatewayId: natGateway.ref,
      });

      new ec2.CfnRoute(this, `${prefix}PrivateSubnetRoute2`, {
          routeTableId: this.vpc.privateSubnets[1].routeTable.routeTableId,
          destinationCidrBlock: '0.0.0.0/0',
          natGatewayId: natGateway.ref,
      });

      new ec2.CfnRoute(this, `${prefix}PrivateSubnetRoute3`, {
          routeTableId: this.vpc.privateSubnets[2].routeTable.routeTableId,
          destinationCidrBlock: '0.0.0.0/0',
          natGatewayId: natGateway.ref,
      });

      // Add interface endpoints for private isolated subnets
      this.vpc.addInterfaceEndpoint('SSM Endpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });

      this.vpc.addInterfaceEndpoint('Secrets Manager Endpoint', {
          service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
          subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });

      this.vpc.addInterfaceEndpoint('RDS Endpoint', {
          service: ec2.InterfaceVpcEndpointAwsService.RDS,
          subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });

      this.vpc.addInterfaceEndpoint('Glue Endpoint', {
          service: ec2.InterfaceVpcEndpointAwsService.GLUE,
          subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });

      this.vpc.addFlowLog(`${id}-vpcFlowLog`);

      // Get default security group for VPC
      const defaultSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
        this,
        id,
        this.vpc.vpcDefaultSecurityGroup
      );

    } else {

      this.vpcCidrString = '10.0.0.0/16';

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
}