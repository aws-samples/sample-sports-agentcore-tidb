import { readFileSync } from 'fs';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { createRawConnection } from '../src/db';

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    if (!REGION) {
      throw new Error('AWS_REGION or AWS_DEFAULT_REGION must be set');
    }
    bedrockClient = new BedrockRuntimeClient({ region: REGION });
  }
  return bedrockClient;
}

interface TeamBracketInfo {
  team: string;
  status: string;
  key_players?: string[];
  notes?: string;
}

interface GameResult {
  game: string;
  date: string;
  network: string;
  winner: string;
  summary: string;
  key_plays?: string[];
  key_stats?: Record<string, string>;
  injuries?: string[];
}

interface ChampionshipMatchup {
  game: string;
  conference: string;
  date: string;
  network: string;
  away?: string;
  home?: string;
  storyline: string;
  key_matchup?: string;
}

interface KeyPerformer {
  player: string;
  team: string;
  stats: string;
  note?: string;
}

interface Injury {
  player: string;
  team: string;
  injury: string;
  date?: string;
  position?: string;
  details?: string;
  notes?: string;
  status?: string;
  return_timeline?: string;
}

interface PlayerStat {
  name: string;
  team: string;
  position: string;
  category: string;
  stats: string;
  playoff_stats?: string;
  status?: string;
}

interface PlayoffData {
  season: string;
  super_bowl: { name: string; date: string; location: string };
  schedule: { wild_card: string; divisional: string; conference_championships: string };
  afc_bracket: Record<string, TeamBracketInfo>;
  nfc_bracket: Record<string, TeamBracketInfo>;
  wild_card_results?: GameResult[];
  divisional_results?: GameResult[];
  conference_championship_matchups?: ChampionshipMatchup[];
  key_performers_wild_card?: KeyPerformer[];
  key_performers_divisional?: KeyPerformer[];
  storylines?: string[];
  injuries?: {
    season_ending?: Injury[];
    game_injuries_divisional?: Injury[];
    conference_championship_watch_list?: Injury[];
  };
}

interface InjuryData {
  season_ending_injuries?: Injury[];
  playoff_game_injuries?: { divisional_round?: Injury[]; wild_card_round?: Injury[] };
  conference_championship_watch_list?: Injury[];
}

interface CountResult {
  count: number;
}

async function getEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }),
  });

  const response = await getBedrockClient().send(command);
  const data = JSON.parse(new TextDecoder().decode(response.body));
  return data.embedding;
}

async function main() {
  // Load all data files - you must create these yourself in nfl-db/data/
  // See README.md for expected file formats
  const playoffData: PlayoffData = JSON.parse(readFileSync('data/nfl_playoffs_2026_full.json', 'utf-8'));
  const playerStats: PlayerStat[] = JSON.parse(readFileSync('data/nfl_player_stats_2026.json', 'utf-8'));
  const injuryData: InjuryData = JSON.parse(readFileSync('data/nfl_injuries_2026.json', 'utf-8'));
  
  const connection = await createRawConnection();
  console.log('Connected to TiDB\n');
  
  const chunks: { category: string; text: string }[] = [];

  // ===== PLAYOFF DATA =====
  
  // Super Bowl info
  chunks.push({
    category: 'Super Bowl LX',
    text: `${playoffData.super_bowl.name} will be played on ${playoffData.super_bowl.date} at ${playoffData.super_bowl.location}. The ${playoffData.season} sports playoffs schedule: Wild Card round ${playoffData.schedule.wild_card}, Divisional round ${playoffData.schedule.divisional}, Conference Championships ${playoffData.schedule.conference_championships}.`
  });

  // AFC bracket
  for (const [seed, info] of Object.entries(playoffData.afc_bracket)) {
    const seedNum = seed.replace('_seed', '');
    let text = `AFC ${seedNum} seed: ${info.team}. Status: ${info.status}.`;
    if (info.key_players) text += ` Key players: ${info.key_players.join(', ')}.`;
    if (info.notes) text += ` ${info.notes}`;
    chunks.push({ category: `AFC Playoffs - ${info.team}`, text });
  }

  // NFC bracket
  for (const [seed, info] of Object.entries(playoffData.nfc_bracket)) {
    const seedNum = seed.replace('_seed', '');
    let text = `NFC ${seedNum} seed: ${info.team}. Status: ${info.status}.`;
    if (info.key_players) text += ` Key players: ${info.key_players.join(', ')}.`;
    if (info.notes) text += ` ${info.notes}`;
    chunks.push({ category: `NFC Playoffs - ${info.team}`, text });
  }

  // Wild Card Results
  if (playoffData.wild_card_results) {
    for (const result of playoffData.wild_card_results) {
      let text = `Wild Card Result: ${result.game}. ${result.date} on ${result.network}. Winner: ${result.winner}. ${result.summary}`;
      if (result.key_plays?.length) {
        text += ` Key plays: ${result.key_plays.join('; ')}.`;
      }
      chunks.push({ category: `Wild Card Result - ${result.winner}`, text });
    }
  }

  // Divisional Results
  if (playoffData.divisional_results) {
    for (const result of playoffData.divisional_results) {
      let text = `Divisional Round Result: ${result.game}. ${result.date} on ${result.network}. Winner: ${result.winner}. ${result.summary}`;
      if (result.key_stats) {
        const statsText = Object.entries(result.key_stats).map(([player, stats]) => `${player}: ${stats}`).join('; ');
        text += ` Key stats: ${statsText}.`;
      }
      chunks.push({ category: `Divisional Result - ${result.winner}`, text });
    }
  }

  // Conference Championship Matchups
  if (playoffData.conference_championship_matchups) {
    for (const matchup of playoffData.conference_championship_matchups) {
      let text = `${matchup.conference} Championship: ${matchup.game}. ${matchup.date} on ${matchup.network}. ${matchup.storyline}`;
      if (matchup.key_matchup) text += ` Key matchup: ${matchup.key_matchup}`;
      chunks.push({ category: `Conference Championship - ${matchup.conference}`, text });
    }
  }

  // Key Performers - Divisional
  if (playoffData.key_performers_divisional) {
    const performerTexts = playoffData.key_performers_divisional.map(p => 
      `${p.player} (${p.team}): ${p.stats}${p.note ? ` - ${p.note}` : ''}`
    );
    chunks.push({
      category: 'Key Performers - Divisional Round',
      text: `Divisional Round key performers: ${performerTexts.join('. ')}.`
    });
  }

  // Storylines
  if (playoffData.storylines) {
    chunks.push({
      category: 'Storylines - 2025-26 Playoffs',
      text: `2025-26 sports Playoffs storylines: ${playoffData.storylines.join('. ')}.`
    });
  }

  // ===== PLAYER STATS =====
  
  // Group players by team for better context
  const playersByTeam: Record<string, PlayerStat[]> = {};
  for (const player of playerStats) {
    if (!playersByTeam[player.team]) playersByTeam[player.team] = [];
    playersByTeam[player.team].push(player);
  }

  for (const [team, players] of Object.entries(playersByTeam)) {
    const playerTexts = players.map(p => {
      let text = `${p.name} (${p.position}, ${p.category}): ${p.stats}`;
      if (p.playoff_stats) text += ` Playoffs: ${p.playoff_stats}`;
      if (p.status) text += ` Status: ${p.status}`;
      return text;
    });
    chunks.push({
      category: `Player Stats - ${team}`,
      text: `${team} player stats 2025-26 season: ${playerTexts.join('. ')}.`
    });
  }

  // ===== INJURIES =====
  
  // Season-ending injuries
  if (injuryData.season_ending_injuries) {
    const injuryTexts = injuryData.season_ending_injuries.map(i => 
      `${i.player} (${i.team}, ${i.position}): ${i.injury} on ${i.date}. ${i.details || ''} Return: ${i.return_timeline || 'TBD'}`
    );
    chunks.push({
      category: 'Injury Report - Season Ending',
      text: `2025-26 sports Playoffs season-ending injuries: ${injuryTexts.join('. ')}.`
    });
  }

  // Divisional round injuries
  if (injuryData.playoff_game_injuries?.divisional_round) {
    const injuryTexts = injuryData.playoff_game_injuries.divisional_round.map(i => 
      `${i.player} (${i.team}): ${i.injury} - ${i.details || i.notes || ''}`
    );
    chunks.push({
      category: 'Injury Report - Divisional Round',
      text: `Divisional Round game injuries: ${injuryTexts.join('. ')}.`
    });
  }

  // Conference Championship watch list
  if (injuryData.conference_championship_watch_list) {
    const watchTexts = injuryData.conference_championship_watch_list.map(i => 
      `${i.player} (${i.team}): ${i.status} - ${i.injury}. ${i.notes || ''}`
    );
    chunks.push({
      category: 'Injury Report - Conference Championship Watch',
      text: `Conference Championship injury watch list: ${watchTexts.join('. ')}.`
    });
  }

  // Delete old data before inserting new
  console.log('Clearing old playoff, player stats, and injury data...');
  await connection.execute(
    `DELETE FROM nfl_embeddings WHERE 
      team_name LIKE '%Playoffs%' OR 
      team_name LIKE '%Super Bowl%' OR 
      team_name LIKE '%Wild Card%' OR 
      team_name LIKE '%Injury Report%' OR 
      team_name LIKE '%Divisional%' OR 
      team_name LIKE '%Storylines%' OR 
      team_name LIKE '%Key Performers%' OR
      team_name LIKE '%Player Stats%' OR
      team_name LIKE '%Conference Championship%'`
  );
  console.log('Old data cleared.\n');

  console.log(`Loading ${chunks.length} chunks into TiDB...\n`);

  let loaded = 0;
  for (const chunk of chunks) {
    console.log(`[${++loaded}/${chunks.length}] ${chunk.category}`);
    try {
      const embedding = await getEmbedding(chunk.text);
      const vectorStr = `[${embedding.join(',')}]`;
      
      await connection.execute(
        'INSERT INTO nfl_embeddings (team_name, chunk_text, embedding) VALUES (?, ?, ?)',
        [chunk.category, chunk.text, vectorStr]
      );
    } catch (err) {
      console.error(`  Error: ${err}`);
    }
  }

  const [rows] = await connection.execute('SELECT COUNT(*) as count FROM nfl_embeddings');
  console.log(`\n✓ Done! Total chunks in database: ${(rows as CountResult[])[0].count}`);
  
  await connection.end();
  process.exit(0);
}

main().catch(console.error);