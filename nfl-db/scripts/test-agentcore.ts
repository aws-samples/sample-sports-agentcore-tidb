/**
 * Test script for invoking the NFL Agent deployed on AgentCore Runtime
 * 
 * Usage:
 *   npx tsx scripts/test-agentcore.ts "Who will win the Super Bowl?"
 *   npx tsx scripts/test-agentcore.ts --session mysession "My name is Bob"
 *   
 * Environment:
 *   AGENT_RUNTIME_ARN - The ARN of your deployed AgentCore runtime
 *   AWS_REGION - AWS region (default: us-east-1)
 */

import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';

const REGION = process.env.AWS_REGION || 'us-east-1';
const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN;

async function invokeAgent(prompt: string, sessionName?: string, rawJson: boolean = false) {
  if (!AGENT_RUNTIME_ARN) {
    console.error('❌ AGENT_RUNTIME_ARN environment variable is required');
    process.exit(1);
  }

  const client = new BedrockAgentCoreClient({ region: REGION });
  
  // Session ID must be >= 33 characters
  const runtimeSessionId = sessionName 
    ? `session-${sessionName}-00000000000000000000`
    : `session-${Date.now()}-${crypto.randomUUID()}`;
  
  const actorId = 'test-user';
  const memorySessionId = sessionName || `session-${Date.now()}`;
  
  if (!rawJson) {
    console.log('🏈 Sports Agent Test');
    console.log('─'.repeat(50));
    console.log(`Prompt:  ${prompt}`);
    console.log(`Session: ${memorySessionId}`);
    console.log('─'.repeat(50));
    console.log('');
  }

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: AGENT_RUNTIME_ARN,
    runtimeSessionId,
    qualifier: 'DEFAULT',
    payload: new TextEncoder().encode(JSON.stringify({ 
      prompt,
      actorId,
      sessionId: memorySessionId,
    })),
  });

  try {
    const response = await client.send(command);
    const textResponse = await response.response?.transformToString();
    
    if (textResponse) {
      if (rawJson) {
        // Output raw JSON for piping to jq
        console.log(textResponse);
      } else {
        try {
          const parsed = JSON.parse(textResponse);
          if (parsed.success && parsed.response?.content?.[0]?.text) {
            console.log(parsed.response.content[0].text);
          } else if (parsed.error) {
            console.error('Error:', parsed.error);
          } else {
            console.log(JSON.stringify(parsed, null, 2));
          }
        } catch {
          console.log(textResponse);
        }
        console.log('\n' + '─'.repeat(50));
        console.log('✅ Complete');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Parse args
const args = process.argv.slice(2);
const rawJson = args.includes('--json');
const sessionIdx = args.indexOf('--session');
const sessionName = sessionIdx !== -1 ? args[sessionIdx + 1] : undefined;
const prompt = args
  .filter((a, i) => a !== '--session' && a !== '--json' && (sessionIdx === -1 || i !== sessionIdx + 1))
  .join(' ') || 'Who are the favorites to win the Super Bowl?';

invokeAgent(prompt, sessionName, rawJson);
