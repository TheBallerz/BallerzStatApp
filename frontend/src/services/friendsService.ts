// friendsService.ts
// Handles API calls for the friends system: search, requests, leaderboard, block.

const API_BASE = `${import.meta.env.VITE_API_BASE}/friends`;

export type LeaderboardSortKey =
  | 'avgPoints'
  | 'avgAssists'
  | 'avgRebounds'
  | 'avgFg3m';

export interface FriendUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string | null;
}

export interface FriendRequest {
  from: FriendUser;
  createdAt: string;
}

export interface FriendsData {
  friends: FriendUser[];
  friendRequests: FriendRequest[];
}

export interface UserSearchResult extends FriendUser {
  status: 'none' | 'pending' | 'friend';
}

export interface LeaderboardEntry {
  userId: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  gamesPlayed: number;
  avgPoints: number;
  avgAssists: number;
  avgRebounds: number;
  avgFg3m: number;
  rank: number;
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

export async function getFriends(): Promise<FriendsData> {
  const res = await fetch(API_BASE, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load friends.');
  return res.json();
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Search failed.');
  return res.json();
}

export async function sendFriendRequest(targetUserId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ targetUserId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to send request.');
}

export async function acceptFriendRequest(fromUserId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/accept`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ fromUserId }),
  });
  if (!res.ok) throw new Error('Failed to accept request.');
}

export async function declineFriendRequest(fromUserId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/decline`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ fromUserId }),
  });
  if (!res.ok) throw new Error('Failed to decline request.');
}

export async function removeFriend(friendId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${friendId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to remove friend.');
}

export async function blockUser(targetUserId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/block`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ targetUserId }),
  });
  if (!res.ok) throw new Error('Failed to block user.');
}

export async function unblockUser(targetUserId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/block/${targetUserId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to unblock user.');
}

export async function getLeaderboard(
  sortBy: LeaderboardSortKey,
): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/leaderboard?sortBy=${sortBy}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load leaderboard.');
  return res.json();
}
