import { Agent } from '@strands-agents/sdk';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { serve } from '@hono/node-server';
import { initDb } from './db';
import {
  ragSearch,
  espnPlayerStats,
  espnMatchup,
  wikipediaSearch,
  teamComparison,
  resetDebug,
  getDebugLogs,
} from './tools';
import {
  storeConversation,
  buildMemoryContext,
  isMemoryEnabled,
} from './memory';
import type { InvocationRequest } from './types';

// =============================================================================
// CREATE THE AGENT
// =============================================================================
const BASE_SYSTEM_PROMPT = `You are an expert NFL analyst assistant with access to multiple data sources. You help users analyze NFL playoff matchups, player statistics, and make informed predictions.

Your available tools:
1. rag_search - Search the NFL knowledge base (injuries, odds, team info, player stats)
2. espn_player_stats - Get live player stats from ESPN
3. espn_matchup - Get current matchup details and odds
4. wikipedia_search - Get background/historical info on players and teams
5. team_comparison - Compare two teams head-to-head

When answering questions:
- Use multiple tools when needed to get comprehensive information
- Always cite your sources (which tool provided the data)
- Provide analysis and insights, not just raw data
- For betting/prediction questions, consider injuries, recent performance, and matchup advantages
- Be concise but thorough

Current season: 2025-26 NFL Playoffs`;

// =============================================================================
// HONO SERVER
// =============================================================================
const app = new Hono();

app.get('/ping', (c) => {
  return c.json({
    status: 'Healthy',
    time_of_last_update: Math.floor(Date.now() / 1000),
  });
});

app.post('/invocations', async (c) => {
  try {
    const body = await c.req.json<InvocationRequest>();
    const { prompt, debug = false, stream = false, actorId, sessionId } = body;
    
    if (!prompt) {
      return c.json({ success: false, error: 'Missing prompt in request body' }, 400);
    }
    
    resetDebug(debug);
    
    // Generate default actor/session IDs if not provided
    const actor = actorId || 'default-user';
    const session = sessionId || `session-${Date.now()}`;
    
    console.log(`[${new Date().toISOString()}] Invocation: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
    
    // Build memory context if memory is enabled
    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (isMemoryEnabled()) {
      try {
        const memoryContext = await buildMemoryContext(actor, session, prompt);
        if (memoryContext) {
          systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n--- Memory Context ---\n${memoryContext}`;
          console.log(`[Memory] Added context for actor=${actor}, session=${session}`);
        }
      } catch (err) {
        console.error('[Memory] Error building context:', err);
      }
    }
    
    // Create agent instance per request to include memory context
    const agentWithMemory = new Agent({
      tools: [ragSearch, espnPlayerStats, espnMatchup, wikipediaSearch, teamComparison],
      systemPrompt,
    });
    
    // Streaming response
    if (stream) {
      return streamSSE(c, async (sseStream) => {
        let fullText = '';
        
        for await (const event of agentWithMemory.stream(prompt)) {
          // Stream text deltas
          if (event.type === 'modelContentBlockDeltaEvent' && event.delta.type === 'textDelta') {
            fullText += event.delta.text;
            await sseStream.writeSSE({
              event: 'delta',
              data: JSON.stringify({ text: event.delta.text }),
            });
          }
          
          // Stop event
          if (event.type === 'modelMessageStopEvent') {
            // Store conversation in memory
            if (isMemoryEnabled()) {
              storeConversation(actor, session, [
                { role: 'USER', content: prompt },
                { role: 'ASSISTANT', content: fullText },
              ]).catch((err) => console.error('[Memory] Store error:', err));
            }
            
            await sseStream.writeSSE({
              event: 'done',
              data: JSON.stringify({ 
                stopReason: event.stopReason,
                fullText,
                ...(debug && { debug: getDebugLogs() }),
              }),
            });
          }
        }
      });
    }
    
    // Non-streaming response
    const result = await agentWithMemory.invoke(prompt);
    const lastMessage = result.lastMessage;
    let responseText = '';
    if (lastMessage?.content?.[0]) {
      const firstContent = lastMessage.content[0];
      if ('text' in firstContent) {
        responseText = firstContent.text as string;
      }
    }
    
    // Store conversation in memory
    if (isMemoryEnabled()) {
      storeConversation(actor, session, [
        { role: 'USER', content: prompt },
        { role: 'ASSISTANT', content: responseText },
      ]).catch((err) => console.error('[Memory] Store error:', err));
    }
    
    const response = {
      success: true,
      prompt,
      response: result.lastMessage,
      timestamp: Math.floor(Date.now() / 1000),
      ...(debug && { debug: getDebugLogs() }),
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Agent error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// =============================================================================
// START SERVER
// =============================================================================
const PORT = parseInt(process.env.PORT || '8080');

async function main() {
  // Initialize database connection (fetches secrets if in production)
  await initDb();

  console.log(`🏈 NFL Agent Server starting on port ${PORT}`);
  console.log(`  POST /invocations - Invoke the agent (add "debug": true for debug info)`);
  console.log(`  GET  /ping        - Health check`);

  serve({
    fetch: app.fetch,
    port: PORT,
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
