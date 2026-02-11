#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

const secretsArn = app.node.tryGetContext('secretsArn');
if (!secretsArn) {
  throw new Error('Missing required context: secretsArn. Deploy with: npx cdk deploy -c secretsArn=arn:aws:secretsmanager:...');
}

new InfraStack(app, 'AgentTiDBCoreStack', {
  env: { region: 'us-east-1' },
  secretsArn,
});
