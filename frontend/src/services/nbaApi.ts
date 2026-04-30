const API_BASE = "http://localhost:3000/api";

export async function fetchTeams() {
  const res = await fetch(`${API_BASE}/teams`);

  if (!res.ok) {
    throw new Error(`Failed to fetch teams: ${res.status}`);
  }

  return res.json();
}

export async function fetchTeam(teamId: number | string) {
  const res = await fetch(`${API_BASE}/teams/${teamId}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch team: ${res.status}`);
  }

  return res.json();
}