import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { createRawConnection } from '../db';
import { getEmbedding } from './embedding';
import { debugLog } from './debug';
import type { EmbeddingResult } from '../types';

export const ragSearch = tool({
  name: 'rag_search',
  description: 'Search the NFL knowledge base for information about teams, players, matchups, injuries, odds, and stats.',
  inputSchema: z.object({
    query: z.string().describe('The search query about NFL teams, players, or matchups'),
    topK: z.number().optional().describe('Number of results to return (default 8)'),
  }),
  callback: async (input) => {
    debugLog('rag_search', 'INPUT', input);
    const { query, topK = 8 } = input;
    
    const connection = await createRawConnection();
    const queryEmbedding = await getEmbedding(query);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const [results] = await connection.execute(`
      SELECT team_name, chunk_text, 
             VEC_COSINE_DISTANCE(embedding, ?) as distance
      FROM nfl_embeddings
      ORDER BY distance ASC
      LIMIT ${topK}
    `, [vectorStr]);

    await connection.end();
    
    const typedResults = results as EmbeddingResult[];
    const chunks = typedResults.map((r, i) => 
      `[${i + 1}] (${r.team_name}, dist: ${parseFloat(String(r.distance)).toFixed(3)}) ${r.chunk_text}`
    ).join('\n\n');
    
    const output = `Found ${typedResults.length} relevant results:\n\n${chunks}`;
    debugLog('rag_search', 'OUTPUT', output);
    return output;
  },
});
