export type StandingTeam = {
  teamId: string;
  nbaTeamId: number;
  teamName: string;
  abbreviation?: string;
  conference?: string;
  division?: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winPct: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgSteals: number;
  avgBlocks: number;
  avgTurnovers: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
};

export type StandingsResponse = {
  season: string;
  east: StandingTeam[];
  west: StandingTeam[];
};

const API_BASE = import.meta.env.VITE_API_BASE;

export async function fetchStandings(
  season = '2025-26',
  type: 'season' | 'finals' = 'season'
): Promise<StandingsResponse> {
  const response = await fetch(
    `${API_BASE}/standings?season=${season}&type=${type}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch standings');
  }

  return response.json();
}