import { getToken } from './authService';

/**
 * Saves the user's favorite players and/or teams to their profile.
 * Only the fields provided are updated — omitted fields are left untouched.
 *
 * @param payload.favoritePlayers - Array of NBA player IDs (Player.nbaId numbers)
 * @param payload.favoriteTeams   - Array of NBA team IDs (Team.nbaId numbers)
 */
export async function saveFavorites(payload: {
  favoritePlayers?: number[];
  favoriteTeams?: number[];
}): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');

  const res = await fetch(`${import.meta.env.VITE_API_BASE}/auth/favorites`, {
    method:  'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to save favorites.');
  }
}
