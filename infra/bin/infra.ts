#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();
new InfraStack(app, 'AgentTiDBCoreStack', {
  
  env: {region: 'us-east-1' },

  


  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
