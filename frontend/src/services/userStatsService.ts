// userStatsService.ts
// Handles API calls for user-logged game stats and season averages.

const API_BASE = `${import.meta.env.VITE_API_BASE}/user`;

export interface UserSeasonStats {
  gamesPlayed: number;
  avgPoints: number;
  avgAssists: number;
  avgRebounds: number;
  avgFg3m: number;
  avgSteals: number;
  avgBlocks: number;
  avgTurnovers: number;
  avgMinutes: number;
}

export interface UserGameLog {
  _id: string;
  gameDate: string;
  opponent: string;
  points: number;
  assists: number;
  rebounds: number;
  threePointersMade: number;
  steals: number;
  blocks: number;
  turnovers: number;
  minutes: number;
}

export interface NewGameEntry {
  gameDate: string;
  opponent?: string;
  points: number;
  assists: number;
  rebounds: number;
  threePointersMade: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  minutes?: number;
}

function getToken(): string {
  return localStorage.getItem('ballerz_token') || '';
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

export async function getMySeasonStats(): Promise<UserSeasonStats> {
  const res = await fetch(`${API_BASE}/stats/season`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load season stats.');
  return res.json();
}

export async function getFriendSeasonStats(
  userId: string,
): Promise<UserSeasonStats> {
  const res = await fetch(`${API_BASE}/stats/season/${userId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load friend stats.');
  return res.json();
}

export async function getMyGames(limit = 50): Promise<UserGameLog[]> {
  const res = await fetch(`${API_BASE}/stats/games?limit=${limit}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load games.');
  return res.json();
}

export async function addGame(entry: NewGameEntry): Promise<UserGameLog> {
  const res = await fetch(`${API_BASE}/stats/games`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(entry),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to log game.');
  return data;
}

export async function updateGame(
  gameId: string,
  entry: Partial<NewGameEntry>,
): Promise<UserGameLog> {
  const res = await fetch(`${API_BASE}/stats/games/${gameId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(entry),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update game.');
  return data;
}

export async function deleteGame(gameId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/stats/games/${gameId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete game.');
}
