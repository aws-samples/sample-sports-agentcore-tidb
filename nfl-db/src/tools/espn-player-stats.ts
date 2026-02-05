import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { debugLog } from './debug';
import type { ESPNAthleteGroup, ESPNTeamInfo } from '../types';

export const espnPlayerStats = tool({
  name: 'espn_player_stats',
  description: 'Get current season stats for a specific NFL player from ESPN.',
  inputSchema: z.object({
    playerName: z.string().describe('The player name to search for'),
    teamAbbr: z.string().optional().describe('Team abbreviation to narrow search'),
  }),
  callback: async (input) => {
    debugLog('espn_player_stats', 'INPUT', input);
    const { playerName, teamAbbr } = input;
    
    const teams = teamAbbr 
      ? [teamAbbr]
      : ['sf', 'phi', 'lar', 'car', 'chi', 'gb', 'sea', 'buf', 'jax', 'pit', 'hou', 'ne', 'lac', 'den'];
    
    for (const abbr of teams) {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbr}/roster`;
        const response = await fetch(url);
        if (!response.ok) continue;
        
        const data = await response.json() as { athletes?: ESPNAthleteGroup[] };
        
        for (const group of data.athletes || []) {
          for (const athlete of group.items || []) {
            const name = athlete.fullName || athlete.displayName || '';
            if (name.toLowerCase().includes(playerName.toLowerCase())) {
              const teamUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbr}`;
              const teamResp = await fetch(teamUrl);
              const teamData = await teamResp.json() as ESPNTeamInfo;
              
              let playerStats = '';
              for (const leaderCat of teamData.team?.leaders || []) {
                for (const leader of leaderCat.leaders || []) {
                  if (leader.athlete?.fullName?.toLowerCase().includes(playerName.toLowerCase())) {
                    playerStats += `${leaderCat.displayName}: ${leader.displayValue}\n`;
                  }
                }
              }
              
              const output = `Player: ${name}
Team: ${teamData.team?.displayName || abbr.toUpperCase()}
Position: ${athlete.position?.displayName || athlete.position?.abbreviation || 'N/A'}
Jersey: #${athlete.jersey || 'N/A'}
Experience: ${athlete.experience?.years || 0} years
${playerStats ? `\nSeason Stats:\n${playerStats}` : '\nNo season leader stats available.'}`;
              debugLog('espn_player_stats', 'OUTPUT', output);
              return output;
            }
          }
        }
      } catch {
        continue;
      }
    }
    
    const output = `Could not find player "${playerName}" in the NFL roster data.`;
    debugLog('espn_player_stats', 'OUTPUT', output);
    return output;
  },
});
