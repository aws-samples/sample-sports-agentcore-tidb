// Database types
export interface EmbeddingResult {
  team_name: string;
  chunk_text: string;
  distance: number;
}

// ESPN API types
export interface ESPNAthlete {
  fullName?: string;
  displayName?: string;
  jersey?: string;
  position?: { displayName?: string; abbreviation?: string };
  experience?: { years?: number };
}

export interface ESPNAthleteGroup {
  items?: ESPNAthlete[];
}

export interface ESPNLeader {
  athlete?: { fullName?: string; displayName?: string };
  displayValue?: string;
}

export interface ESPNLeaderCategory {
  displayName?: string;
  leaders?: ESPNLeader[];
}

export interface ESPNTeam {
  displayName?: string;
  abbreviation?: string;
  leaders?: ESPNLeaderCategory[];
  record?: { items?: { summary?: string }[] };
}

export interface ESPNCompetitor {
  team?: ESPNTeam;
  homeAway?: string;
  records?: { summary?: string }[];
  leaders?: ESPNLeaderCategory[];
}

export interface ESPNOdds {
  details?: string;
  overUnder?: number;
  awayTeamOdds?: { favorite?: boolean };
}

export interface ESPNCompetition {
  competitors?: ESPNCompetitor[];
  odds?: ESPNOdds[];
  status?: { type?: { detail?: string } };
  broadcasts?: { names?: string[] }[];
}

export interface ESPNEvent {
  name?: string;
  date?: string;
  competitions?: ESPNCompetition[];
}

export interface ESPNScoreboard {
  events?: ESPNEvent[];
}

export interface ESPNTeamInfo {
  team?: ESPNTeam;
}

export interface ESPNStatCategory {
  name?: string;
  stats?: { name?: string; displayValue?: string; value?: string | number }[];
}

export interface ESPNTeamStats {
  results?: { stats?: { categories?: ESPNStatCategory[] } };
}

// Wikipedia API types
export interface WikiPage {
  extract?: string;
}

export interface WikiSearchResult {
  title: string;
}

// Helper types
export interface TeamNameInfo {
  name: string;
  abbr: string;
  normalized: string;
}

// API types
export interface InvocationRequest {
  prompt: string;
  debug?: boolean;
  stream?: boolean;
  actorId?: string;
  sessionId?: string;
}

export interface DebugEntry {
  tool: string;
  phase: 'INPUT' | 'OUTPUT';
  data: unknown;
  timestamp: number;
}

export interface InvocationResponse {
  success: boolean;
  prompt: string;
  response: string;
  timestamp: number;
  debug?: DebugEntry[];
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export interface HealthResponse {
  status: string;
  time_of_last_update: number;
}
