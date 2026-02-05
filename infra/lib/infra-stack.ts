import * as cdk from 'aws-cdk-lib/core';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';

export class InfraStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository;
  public readonly runtime: agentcore.Runtime;
  public readonly memory: agentcore.Memory;
  public readonly nflAgentSecrets: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ECR Repository for sports Agent
    this.ecrRepository = new ecr.Repository(this, 'NflAgentRepo', {
      repositoryName: 'nfl-agent',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 most recent images',
        },
      ],
    });

    // Secrets Manager for sensitive credentials
    // Secret is created empty - populate via AWS CLI after deployment:
    // aws secretsmanager put-secret-value --secret-id nfl-agent/credentials --secret-string '{"TIDB_HOST":"...","TIDB_PORT":"4000","TIDB_USERNAME":"...","TIDB_PASSWORD":"...","TIDB_DATABASE":"test"}'
    this.nflAgentSecrets = new secretsmanager.Secret(this, 'NflAgentSecrets', {
      secretName: 'nfl-agent/credentials',
      description: 'Credentials for sports Agent (TiDB, etc.) - populate after deployment',
    });

    // AgentCore Memory for conversation history and user preferences
    this.memory = new agentcore.Memory(this, 'NflAgentMemory', {
      memoryName: 'nfl_agent_memory',
      description: 'Memory for sports Agent - stores conversation history and user preferences',
      expirationDuration: cdk.Duration.days(90),
      memoryStrategies: [
        // Summarization - compresses conversations into concise overviews
        agentcore.MemoryStrategy.usingSummarization({
          name: 'ConversationSummary',
          namespaces: ['nfl/sessions/{actorId}/{sessionId}/summary'],
        }),
        // Semantic - extracts facts and concepts
        agentcore.MemoryStrategy.usingSemantic({
          name: 'NFLFacts',
          namespaces: ['nfl/facts/{actorId}'],
        }),
        // User Preference - captures individual preferences
        agentcore.MemoryStrategy.usingUserPreference({
          name: 'UserPreferences',
          namespaces: ['nfl/users/{actorId}/preferences'],
        }),
      ],
    });

    // Create AgentCore Runtime using the L2 construct
    this.runtime = new agentcore.Runtime(this, 'NflAgentRuntime', {
      runtimeName: 'nfl_agent',
      description: 'sports Agent Runtime for sports analytics',
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromEcrRepository(
        this.ecrRepository,
        'latest'
      ),
      networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
      environmentVariables: {
        AWS_DEFAULT_REGION: this.region,
        // Reference to secrets - app fetches at runtime
        SECRETS_ARN: this.nflAgentSecrets.secretArn,
        // Memory ID for the agent to use
        MEMORY_ID: this.memory.memoryId,
      },
    });

    // Grant Bedrock model invocation permissions
    this.runtime.addToRolePolicy(new iam.PolicyStatement({
      sid: 'BedrockModelAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        `arn:aws:bedrock:${this.region}:${this.account}:*`,
      ],
    }));

    // Grant AgentCore Memory permissions
    this.runtime.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AgentCoreMemoryAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock-agentcore:CreateEvent',
        'bedrock-agentcore:GetEvent',
        'bedrock-agentcore:ListEvents',
        'bedrock-agentcore:RetrieveMemoryRecords',
        'bedrock-agentcore:GetMemory',
      ],
      resources: [
        this.memory.memoryArn,
        `${this.memory.memoryArn}/*`,
      ],
    }));

    // Grant Secrets Manager read access
    this.nflAgentSecrets.grantRead(this.runtime.role);

    // Output the repository URI
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR Repository URI for NFL Agent',
      exportName: 'NflAgentEcrUri',
    });

    // Output the runtime ID
    new cdk.CfnOutput(this, 'AgentRuntimeId', {
      value: this.runtime.agentRuntimeId,
      description: 'ID of the NFL Agent Runtime',
      exportName: 'NflAgentRuntimeId',
    });

    // Output the runtime ARN
    new cdk.CfnOutput(this, 'AgentRuntimeArn', {
      value: this.runtime.agentRuntimeArn,
      description: 'ARN of the NFL Agent Runtime',
      exportName: 'NflAgentRuntimeArn',
    });

    // Output the execution role ARN
    new cdk.CfnOutput(this, 'AgentCoreRoleArn', {
      value: this.runtime.role.roleArn,
      description: 'ARN of the Bedrock AgentCore Runtime Role',
      exportName: 'BedrockAgentCoreRuntimeRoleArn',
    });

    // Output the secrets ARN
    new cdk.CfnOutput(this, 'SecretsArn', {
      value: this.nflAgentSecrets.secretArn,
      description: 'ARN of the NFL Agent Secrets',
      exportName: 'NflAgentSecretsArn',
    });

    // Output the memory ID
    new cdk.CfnOutput(this, 'MemoryId', {
      value: this.memory.memoryId,
      description: 'ID of the NFL Agent Memory',
      exportName: 'NflAgentMemoryId',
    });

    // Output the memory ARN
    new cdk.CfnOutput(this, 'MemoryArn', {
      value: this.memory.memoryArn,
      description: 'ARN of the NFL Agent Memory',
      exportName: 'NflAgentMemoryArn',
    });
  }
}
