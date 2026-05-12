import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getToken } from '../services/authService';
import {
  getUsers,
  deleteUser,
  setUserAdmin,
  type AdminUser,
} from '../services/adminService';
import './accountPage.css';

// ── Types ──────────────────────────────────────────────────────────────────────

interface MeUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
}

// ── Admin panel sub-component ──────────────────────────────────────────────────

interface AdminPanelProps {
  currentUserId: string;
}

function AdminPanel({ currentUserId }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track which row is mid-request so we can disable its controls
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      try {
        const data = await getUsers();
        if (!cancelled) setUsers(data);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load users.',
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const markBusy = (id: string) => setBusy((prev) => new Set(prev).add(id));
  const clearBusy = (id: string) =>
    setBusy((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });

  const handleToggleAdmin = async (user: AdminUser) => {
    markBusy(user._id);
    try {
      const updated = await setUserAdmin(user._id, !user.isAdmin);
      setUsers((prev) =>
        prev.map((u) => (u._id === updated._id ? updated : u)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update role.');
    } finally {
      clearBusy(user._id);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (
      !window.confirm(
        `Delete ${user.firstName} ${user.lastName}? This cannot be undone.`,
      )
    )
      return;
    markBusy(user._id);
    try {
      await deleteUser(user._id);
      setUsers((prev) => prev.filter((u) => u._id !== user._id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete user.');
      clearBusy(user._id);
    }
  };

  return (
    <div className="admin-section">
      <p className="admin-section-title">Admin — User Management</p>

      {loading && <p className="admin-status">Loading users…</p>}
      {error && <p className="admin-error">{error}</p>}

      {!loading && !error && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Admin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user._id === currentUserId;
              const isRowBusy = busy.has(user._id);

              return (
                <tr key={user._id}>
                  {/* Name + email */}
                  <td>
                    <div className="admin-user-name">
                      {user.firstName} {user.lastName}
                      {user.isAdmin && (
                        <span className="admin-badge">Admin</span>
                      )}
                    </div>
                    <div className="admin-user-email">{user.email}</div>
                  </td>

                  {/* Admin toggle */}
                  <td>
                    <div className="toggle-wrap">
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={user.isAdmin}
                          disabled={isRowBusy || isSelf}
                          onChange={() => handleToggleAdmin(user)}
                        />
                        <span className="toggle-track" />
                      </label>
                      <span className="toggle-label">
                        {user.isAdmin ? 'Admin' : 'User'}
                      </span>
                    </div>
                  </td>

                  {/* Delete */}
                  <td>
                    <button
                      className="admin-delete-btn"
                      type="button"
                      disabled={isRowBusy || isSelf}
                      onClick={() => handleDelete(user)}
                      title={
                        isSelf
                          ? 'You cannot delete your own account'
                          : `Delete ${user.firstName}`
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Account page ───────────────────────────────────────────────────────────────

export default function AccountPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the live user record from the backend on mount so isAdmin is always
  // up-to-date (localStorage may be stale if the flag was changed since login).
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMe() {
      try {
        const res = await fetch('http://localhost:3000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUser(data.user);
      } catch {
        // silently fall back to no user
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="account-page">
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="account-page">
      {/* ── Profile section ──────────────────────────── */}
      <div className="account-section">
        <p className="account-section-title">Account</p>

        {user ? (
          <>
            <p className="account-name">
              {user.firstName} {user.lastName}
            </p>
            <p className="account-email">{user.email}</p>
          </>
        ) : (
          <p className="account-email">Not logged in.</p>
        )}

        <button className="logout-btn" type="button" onClick={handleLogout}>
          Log Out
        </button>
      </div>

      {/* ── Admin panel (visible to admins only) ─────── */}
      {user?.isAdmin && <AdminPanel currentUserId={user._id} />}
    </div>
  );
}
