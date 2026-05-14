import { getToken } from './authService';

const API_BASE = 'https://ballerz-backend.azurewebsites.net/api/admin';

/** Shape of a user record returned by the admin endpoints */
export interface AdminUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

/** Shared fetch helper — attaches the JWT and throws on non-OK responses */
async function adminFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { message?: string }).message ||
        `Request failed (${res.status})`,
    );
  }

  return res;
}

/** Returns every user in the database (admin-only). */
export async function getUsers(): Promise<AdminUser[]> {
  const res = await adminFetch('/users');
  return res.json();
}

/** Permanently deletes a user by their MongoDB _id (admin-only). */
export async function deleteUser(id: string): Promise<void> {
  await adminFetch(`/users/${id}`, { method: 'DELETE' });
}

/**
 * Sets or clears the isAdmin flag on a user (admin-only).
 * Returns the updated user document.
 */
export async function setUserAdmin(
  id: string,
  isAdmin: boolean,
): Promise<AdminUser> {
  const res = await adminFetch(`/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ isAdmin }),
  });
  return res.json();
}
