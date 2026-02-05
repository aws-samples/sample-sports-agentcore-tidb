import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { debugLog } from './debug';
import type { WikiSearchResult, WikiPage } from '../types';

export const wikipediaSearch = tool({
  name: 'wikipedia_search',
  description: 'Search Wikipedia for background information about NFL players, teams, or football concepts.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  callback: async (input) => {
    debugLog('wikipedia_search', 'INPUT', input);
    const { query } = input;
    
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' NFL')}&format=json&srlimit=3`;
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json() as { query?: { search?: WikiSearchResult[] } };
    
    const results = searchData.query?.search || [];
    if (results.length === 0) {
      const output = `No Wikipedia articles found for "${query}".`;
      debugLog('wikipedia_search', 'OUTPUT', output);
      return output;
    }
    
    const title = results[0].title;
    const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=true&explaintext=true&format=json`;
    const contentResp = await fetch(contentUrl);
    const contentData = await contentResp.json() as { query?: { pages?: Record<string, WikiPage> } };
    
    const pages = contentData.query?.pages || {};
    const page = Object.values(pages)[0];
    const extract = page?.extract || 'No content available.';
    
    const maxLength = 1500;
    const truncated = extract.length > maxLength ? extract.substring(0, maxLength) + '...' : extract;
    
    const output = `📚 Wikipedia: ${title}\n\n${truncated}\n\nSource: https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    debugLog('wikipedia_search', 'OUTPUT', output);
    return output;
  },
});
