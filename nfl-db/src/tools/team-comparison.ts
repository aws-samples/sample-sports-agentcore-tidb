import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { debugLog } from './debug';
import type { ESPNTeamInfo, ESPNTeamStats } from '../types';

export const teamComparison = tool({
  name: 'team_comparison',
  description: 'Compare two NFL teams head-to-head on key statistics.',
  inputSchema: z.object({
    team1: z.string().describe('First team abbreviation'),
    team2: z.string().describe('Second team abbreviation'),
  }),
  callback: async (input) => {
    debugLog('team_comparison', 'INPUT', input);
    const { team1, team2 } = input;
    
    const fetchTeamStats = async (abbr: string): Promise<ESPNTeamStats | null> => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbr}/statistics`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return resp.json() as Promise<ESPNTeamStats>;
    };
    
    const fetchTeamInfo = async (abbr: string): Promise<ESPNTeamInfo | null> => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbr}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return resp.json() as Promise<ESPNTeamInfo>;
    };
    
    const [stats1, stats2, info1, info2] = await Promise.all([
      fetchTeamStats(team1),
      fetchTeamStats(team2),
      fetchTeamInfo(team1),
      fetchTeamInfo(team2),
    ]);
    
    const getName = (info: ESPNTeamInfo | null) => info?.team?.displayName || 'Unknown';
    const getRecord = (info: ESPNTeamInfo | null) => info?.team?.record?.items?.[0]?.summary || 'N/A';
    
    const extractStat = (stats: ESPNTeamStats | null, category: string, statName: string) => {
      const cat = stats?.results?.stats?.categories?.find((c) => 
        c.name?.toLowerCase().includes(category.toLowerCase())
      );
      const stat = cat?.stats?.find((s) => 
        s.name?.toLowerCase().includes(statName.toLowerCase())
      );
      return stat?.displayValue || stat?.value || 'N/A';
    };
    
    let result = `📊 HEAD-TO-HEAD COMPARISON\n\n`;
    result += `${getName(info1)} (${getRecord(info1)}) vs ${getName(info2)} (${getRecord(info2)})\n\n`;
    
    const categories = [
      { label: 'Points Per Game', cat: 'scoring', stat: 'avgPoints' },
      { label: 'Total Yards/Game', cat: 'passing', stat: 'netYards' },
      { label: 'Rushing Yards/Game', cat: 'rushing', stat: 'rushingYards' },
      { label: 'Passing Yards/Game', cat: 'passing', stat: 'netPassingYards' },
      { label: 'Turnovers', cat: 'general', stat: 'turnover' },
    ];
    
    for (const { label, cat, stat } of categories) {
      const v1 = extractStat(stats1, cat, stat);
      const v2 = extractStat(stats2, cat, stat);
      result += `${label}:\n  ${getName(info1)}: ${v1}\n  ${getName(info2)}: ${v2}\n\n`;
    }
    
    result += `KEY PLAYERS:\n`;
    const teamInfos: [ESPNTeamInfo | null, string][] = [[info1, getName(info1)], [info2, getName(info2)]];
    for (const [info, name] of teamInfos) {
      result += `\n${name}:\n`;
      for (const leader of info?.team?.leaders || []) {
        const l = leader.leaders?.[0];
        if (l) {
          result += `  ${leader.displayName}: ${l.athlete?.displayName} (${l.displayValue})\n`;
        }
      }
    }
    
    debugLog('team_comparison', 'OUTPUT', result);
    return result;
  },
});
