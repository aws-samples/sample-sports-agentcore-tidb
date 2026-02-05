import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

let client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (!client) {
    if (!REGION) {
      throw new Error('AWS_REGION or AWS_DEFAULT_REGION must be set');
    }
    client = new BedrockRuntimeClient({ region: REGION });
  }
  return client;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }),
  });

  const response = await getClient().send(command);
  const data = JSON.parse(new TextDecoder().decode(response.body));
  return data.embedding;
}
