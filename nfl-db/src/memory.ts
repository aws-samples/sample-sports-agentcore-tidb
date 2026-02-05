/**
 * AgentCore Memory integration for NFL Agent
 * 
 * Provides short-term memory (conversation history) and long-term memory
 * (extracted facts, preferences, summaries) for the agent.
 */

import {
  BedrockAgentCoreClient,
  CreateEventCommand,
  ListEventsCommand,
  RetrieveMemoryRecordsCommand,
} from '@aws-sdk/client-bedrock-agentcore';

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const MEMORY_ID = process.env.MEMORY_ID;

// Lazy-initialized client
let client: BedrockAgentCoreClient | null = null;

function getClient(): BedrockAgentCoreClient {
  if (!client) {
    client = new BedrockAgentCoreClient({ region: REGION });
  }
  return client;
}

export interface ConversationMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

/**
 * Store a conversation event in short-term memory
 */
export async function storeConversation(
  actorId: string,
  sessionId: string,
  messages: ConversationMessage[]
): Promise<string | null> {
  if (!MEMORY_ID) {
    console.log('[Memory] MEMORY_ID not set, skipping store');
    return null;
  }

  try {
    const payload = messages.map((msg) => ({
      conversational: {
        content: { text: msg.content },
        role: msg.role,
      },
    }));

    const command = new CreateEventCommand({
      memoryId: MEMORY_ID,
      actorId,
      sessionId,
      eventTimestamp: new Date(),
      payload,
    });

    const response = await getClient().send(command);
    const eventId = response.event?.eventId;
    console.log(`[Memory] Stored conversation event: ${eventId}`);
    return eventId || null;
  } catch (error) {
    console.error('[Memory] Error storing conversation:', error);
    return null;
  }
}

/**
 * Get recent conversation history from short-term memory
 */
export async function getRecentConversations(
  actorId: string,
  sessionId: string,
  maxEvents: number = 5
): Promise<ConversationMessage[]> {
  if (!MEMORY_ID) {
    return [];
  }

  try {
    const command = new ListEventsCommand({
      memoryId: MEMORY_ID,
      actorId,
      sessionId,
      maxResults: maxEvents,
    });

    const response = await getClient().send(command);
    const messages: ConversationMessage[] = [];

    for (const event of response.events || []) {
      for (const item of event.payload || []) {
        if (item.conversational) {
          messages.push({
            role: item.conversational.role as 'USER' | 'ASSISTANT',
            content: item.conversational.content?.text || '',
          });
        }
      }
    }

    console.log(`[Memory] Retrieved ${messages.length} messages from STM`);
    return messages;
  } catch (error) {
    console.error('[Memory] Error getting conversations:', error);
    return [];
  }
}

/**
 * Search long-term memory for relevant information
 */
export async function searchMemory(
  query: string,
  namespace: string,
  topK: number = 5
): Promise<string[]> {
  if (!MEMORY_ID) {
    return [];
  }

  try {
    const command = new RetrieveMemoryRecordsCommand({
      memoryId: MEMORY_ID,
      namespace,
      searchCriteria: {
        searchQuery: query,
        topK,
      },
    });

    const response = await getClient().send(command);
    const records: string[] = [];

    for (const summary of response.memoryRecordSummaries || []) {
      // The summary contains the extracted memory content
      if (summary.memoryRecordId) {
        // relevanceScore may not be in the type but is returned by the API
        const score = (summary as { relevanceScore?: number }).relevanceScore;
        records.push(`[Score: ${score?.toFixed(2) || 'N/A'}] ${summary.memoryRecordId}`);
      }
    }

    console.log(`[Memory] Found ${records.length} LTM records for query: "${query.substring(0, 50)}..."`);
    return records;
  } catch (error) {
    console.error('[Memory] Error searching memory:', error);
    return [];
  }
}

/**
 * Get user preferences from long-term memory
 */
export async function getUserPreferences(actorId: string): Promise<string[]> {
  return searchMemory(
    'What are the user preferences?',
    `nfl/users/${actorId}/preferences`,
    3
  );
}

/**
 * Get relevant facts from long-term memory
 */
export async function getRelevantFacts(actorId: string, query: string): Promise<string[]> {
  return searchMemory(query, `nfl/facts/${actorId}`, 5);
}

/**
 * Build context from memory for the agent
 */
export async function buildMemoryContext(
  actorId: string,
  sessionId: string,
  currentQuery: string
): Promise<string> {
  const contextParts: string[] = [];

  // Get recent conversation history
  const recentMessages = await getRecentConversations(actorId, sessionId, 3);
  if (recentMessages.length > 0) {
    const history = recentMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    contextParts.push(`Recent conversation:\n${history}`);
  }

  // Get user preferences
  const preferences = await getUserPreferences(actorId);
  if (preferences.length > 0) {
    contextParts.push(`User preferences:\n${preferences.join('\n')}`);
  }

  // Get relevant facts based on current query
  const facts = await getRelevantFacts(actorId, currentQuery);
  if (facts.length > 0) {
    contextParts.push(`Relevant facts:\n${facts.join('\n')}`);
  }

  return contextParts.join('\n\n');
}

export function isMemoryEnabled(): boolean {
  return !!MEMORY_ID;
}
