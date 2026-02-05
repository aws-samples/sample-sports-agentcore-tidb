import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { debugLog } from './debug';
import type { ESPNScoreboard, TeamNameInfo } from '../types';

export const espnMatchup = tool({
  name: 'espn_matchup',
  description: 'Get current matchup information including odds, team records, and key players from ESPN.',
  inputSchema: z.object({
    team1: z.string().describe('First team name or abbreviation'),
    team2: z.string().optional().describe('Second team name or abbreviation'),
  }),
  callback: async (input) => {
    debugLog('espn_matchup', 'INPUT', input);
    const { team1, team2 } = input;
    
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
    const response = await fetch(url);
    const data = await response.json() as ESPNScoreboard;
    
    const normalizeTeam = (t: string) => t.toLowerCase().replace(/[^a-z]/g, '');
    const t1 = normalizeTeam(team1);
    const t2 = team2 ? normalizeTeam(team2) : null;
    
    for (const event of data.events || []) {
      const competitors = event.competitions?.[0]?.competitors || [];
      const teamNames: TeamNameInfo[] = competitors.map((c) => ({
        name: c.team?.displayName || '',
        abbr: c.team?.abbreviation || '',
        normalized: normalizeTeam(c.team?.displayName || '') + normalizeTeam(c.team?.abbreviation || ''),
      }));
      
      const matchesT1 = teamNames.some((t) => t.normalized.includes(t1) || t1.includes(t.abbr.toLowerCase()));
      const matchesT2 = !t2 || teamNames.some((t) => t.normalized.includes(t2) || t2.includes(t.abbr.toLowerCase()));
      
      if (matchesT1 && matchesT2) {
        const comp = event.competitions![0];
        const home = competitors.find((c) => c.homeAway === 'home');
        const away = competitors.find((c) => c.homeAway === 'away');
        const odds = comp.odds?.[0];
        
        let result = `🏈 ${event.name}\n`;
        result += `📅 ${comp.status?.type?.detail || event.date}\n`;
        result += `📺 ${comp.broadcasts?.[0]?.names?.join(', ') || 'TBD'}\n\n`;
        
        result += `HOME: ${home?.team?.displayName} (${home?.records?.[0]?.summary || 'N/A'})\n`;
        for (const leader of home?.leaders || []) {
          const l = leader.leaders?.[0];
          if (l) result += `  ${leader.displayName}: ${l.athlete?.displayName} - ${l.displayValue}\n`;
        }
        
        result += `\nAWAY: ${away?.team?.displayName} (${away?.records?.[0]?.summary || 'N/A'})\n`;
        for (const leader of away?.leaders || []) {
          const l = leader.leaders?.[0];
          if (l) result += `  ${leader.displayName}: ${l.athlete?.displayName} - ${l.displayValue}\n`;
        }
        
        if (odds) {
          result += `\n💰 ODDS:\n`;
          result += `  Spread: ${odds.details}\n`;
          result += `  Over/Under: ${odds.overUnder}\n`;
          result += `  Favorite: ${odds.awayTeamOdds?.favorite ? away?.team?.displayName : home?.team?.displayName}\n`;
        }
        
        debugLog('espn_matchup', 'OUTPUT', result);
        return result;
      }
    }
    
    const output = `No upcoming matchup found for "${team1}"${team2 ? ` vs "${team2}"` : ''}.`;
    debugLog('espn_matchup', 'OUTPUT', output);
    return output;
  },
});
