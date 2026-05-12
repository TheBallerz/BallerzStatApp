// authService.ts
// Handles all authentication API calls and manages the user session in localStorage.
// After a successful login or registration, a JWT and a user object are persisted so
// other parts of the app can read them without making additional network requests.

const API_BASE = `${import.meta.env.VITE_API_BASE}/auth`;
const TOKEN_KEY = 'ballerz_token'; // localStorage key for the JWT
const USER_KEY = 'ballerz_user'; // localStorage key for the serialized user object

// Shape of the user object returned by the backend and stored locally
export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
}

// Shape of every successful auth response from the backend
interface AuthResponse {
  token: string;
  user: AuthUser;
}

// Sends a registration request to the backend.
// On success, persists the JWT and user object to localStorage.
export async function register(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, email, password }),
  });

  const data = await res.json();
  // Throw so the calling component can catch it and display the error message
  if (!res.ok) throw new Error(data.message || 'Registration failed.');

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

// Sends a login request to the backend.
// On success, persists the JWT and user object to localStorage.
export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  // Throw so the calling component can catch it and display the error message
  if (!res.ok) throw new Error(data.message || 'Login failed.');

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

// Clears the JWT and user object from localStorage, ending the session.
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Returns the stored user object, or null if no one is logged in.
export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

// Returns the raw JWT string, or null if no one is logged in.
// Attach this to the Authorization header when making authenticated requests.
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
