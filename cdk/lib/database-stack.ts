import { Stack, StackProps, RemovalPolicy, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

import { VpcStack } from './vpc-stack';

export class DatabaseStack extends Stack {
    public readonly dbInstance: rds.DatabaseInstance;
    public readonly secretPathAdminName: string;
    public readonly secretPathUser: secretsmanager.Secret;
    public readonly secretPathTableCreator: secretsmanager.Secret;
    public readonly rdsProxyEndpoint: string;
    public readonly rdsProxyEndpointTableCreator: string;
    public readonly rdsProxyEndpointAdmin: string;
    constructor(scope: Construct, id: string, vpcStack: VpcStack, props?: StackProps) {
        super(scope, id, props);

        const resourcePrefix = this.node.tryGetContext('prefix');

        /**
         * 
         * Retrive a secrete from Secret Manager
         * aws secretsmanager create-secret --name QuantumAISecrets --secret-string '{\"DB_Username\":\"DB-USERNAME\"}' --profile <your-profile-name>
         */
        const secret = secretmanager.Secret.fromSecretNameV2(this, "ImportedSecrets", "QuantumAISecrets");
        /**
         * 
         * Create Empty Secret Manager
         * Secrets will be populate at initalization of data
         */
        this.secretPathAdminName = `${id}-QuantumAI/credentials/rdsDbCredential`; // Name in the Secret Manager to store DB credentials        
        const secretPathUserName = `${id}-QuantumAI/userCredentials/rdsDbCredential`;
        this.secretPathUser = new secretsmanager.Secret(this, secretPathUserName, {
            secretName: secretPathUserName,
            description: "Secrets for clients to connect to RDS",
            removalPolicy: RemovalPolicy.DESTROY,
            secretObjectValue: {
                username: SecretValue.unsafePlainText("applicationUsername"),   // this will change later at runtime
                password: SecretValue.unsafePlainText("applicationPassword")    // in the initializer
            }
        })

        const secretPathTableCreator = "QuantumAI/userCredentials/TableCreator";
        this.secretPathTableCreator = new secretsmanager.Secret(this, secretPathTableCreator, {
            secretName: secretPathTableCreator,
            description: "Secrets for TableCreator to connect to RDS",
            removalPolicy: RemovalPolicy.DESTROY,
            secretObjectValue: {
                username: SecretValue.unsafePlainText("applicationUsername"),   // this will change later at runtime
                password: SecretValue.unsafePlainText("applicationPassword")    // in the initializer
            }
        })
        const parameterGroup = new rds.ParameterGroup(this, "rdsParameterGroup2", {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_16_3,
            }),
            description: "Empty parameter group", // Might need to change this later
            parameters: {
                'rds.force_ssl': '0'
            }
        });

        /**
         * 
         * Create an RDS with Postgres database in an isolated subnet
         */
        this.dbInstance = new rds.DatabaseInstance(this, "QuantumAI", {
            vpc: vpcStack.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_16_3,
            }),
            instanceType: ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE4_GRAVITON,
                ec2.InstanceSize.MEDIUM
            ),
            credentials: rds.Credentials.fromUsername(secret.secretValueFromJson("DB_Username").unsafeUnwrap(), {
                secretName: this.secretPathAdminName,
            }),
            multiAz: true,
            allocatedStorage: 100,
            maxAllocatedStorage: 115,
            allowMajorVersionUpgrade: false,
            autoMinorVersionUpgrade: true,
            backupRetention: Duration.days(7),
            deleteAutomatedBackups: true,
            deletionProtection: true,/// To be changed
            databaseName: "QuantumAIDatabase",
            publiclyAccessible: false,
            cloudwatchLogsRetention: logs.RetentionDays.INFINITE,
            storageEncrypted: true, // storage encryption at rest
            monitoringInterval: Duration.seconds(60), // enhanced monitoring interval
            parameterGroup: parameterGroup
        });

        // Add CIDR ranges of private subnets to inbound rules of RDS
        const dbSecurityGroup = this.dbInstance.connections.securityGroups[0];
        vpcStack.privateSubnetsCidrStrings.forEach((cidr) => {
            dbSecurityGroup.addIngressRule(
                ec2.Peer.ipv4(cidr),
                ec2.Port.tcp(5432),
                `Allow PostgreSQL traffic from private subnet CIDR range ${cidr}`
            );
        });

        // Add CIDR ranges of public subnets to inbound rules of RDS
        this.dbInstance.connections.securityGroups.forEach(function (securityGroup) {
            // Allow Postgres access in VPC
            securityGroup.addIngressRule(
                ec2.Peer.ipv4(vpcStack.vpcCidrString),
                ec2.Port.tcp(5432),
                "Allow PostgreSQL traffic from public subnets"
            );
        });


        const rdsProxyRole = new iam.Role(this, "RDSProxyRole", {
            assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
            roleName: `${resourcePrefix}-RDSProxyRole`
        });

        rdsProxyRole.addToPolicy(new iam.PolicyStatement({
            resources: ['*'],
            actions: [
                'rds-db:connect',
            ],
        }));

        // /**
        //  * 
        //  * Create an RDS proxy that sit between lambda and RDS
        //  */
        const rdsProxy = this.dbInstance.addProxy(id + '-proxy', {
            secrets: [this.secretPathUser!],
            vpc: vpcStack.vpc,
            role: rdsProxyRole,
            securityGroups: this.dbInstance.connections.securityGroups,
            requireTLS: false,
            dbProxyName: `${resourcePrefix}-${id}-proxy`
        });
        const rdsProxyTableCreator = this.dbInstance.addProxy(id + '+proxy', {
            secrets: [this.secretPathTableCreator!],
            vpc: vpcStack.vpc,
            role: rdsProxyRole,
            securityGroups: this.dbInstance.connections.securityGroups,
            requireTLS: false
        });

        const secretPathAdmin = secretmanager.Secret.fromSecretNameV2(this, 'AdminSecret', this.secretPathAdminName);

        const rdsProxyAdmin = this.dbInstance.addProxy(id + '-proxy-admin', {
            secrets: [secretPathAdmin],
            vpc: vpcStack.vpc,
            role: rdsProxyRole,
            securityGroups: this.dbInstance.connections.securityGroups,
            requireTLS: false
        });

        // Workaround for bug where TargetGroupName is not set but required
        let targetGroup = rdsProxy.node.children.find((child: any) => {
            return child instanceof rds.CfnDBProxyTargetGroup
        }) as rds.CfnDBProxyTargetGroup

        targetGroup.addPropertyOverride('TargetGroupName', 'default');

        let targetGroupTableCreator = rdsProxyTableCreator.node.children.find((child: any) => {
            return child instanceof rds.CfnDBProxyTargetGroup
        }) as rds.CfnDBProxyTargetGroup

        targetGroup.addPropertyOverride('TargetGroupName', 'default');
        targetGroupTableCreator.addPropertyOverride('TargetGroupName', 'default');

        this.dbInstance.grantConnect(rdsProxyRole);
        this.rdsProxyEndpoint = rdsProxy.endpoint;
        this.rdsProxyEndpointTableCreator = rdsProxyTableCreator.endpoint;
        this.rdsProxyEndpointAdmin = rdsProxyAdmin.endpoint;

    }
}