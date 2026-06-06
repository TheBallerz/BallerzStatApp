import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getToken, type AuthUser } from '../services/authService';
import {
  getMySeasonStats,
  getMyGames,
  addGame,
  updateGame,
  deleteGame,
  type UserSeasonStats,
  type UserGameLog,
} from '../services/userStatsService';
import {
  getUsers,
  deleteUser,
  setUserAdmin,
  type AdminUser,
} from '../services/adminService';
import {
  ProfileHeader,
  StatTiles,
  GameLogTable,
  GameLogModal,
  EditProfileModal,
} from '../components/account/AccountComponents';
import { FriendsPanel } from '../components/account/FriendsComponents';
import './accountPage.css';

// ── Types ──────────────────────────────────────────────────────────────────────

interface MeUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  avatar: string | null;
  friends: string[];
  favoritePlayers: unknown[];
  favoriteTeams: unknown[];
}

// ── Admin panel sub-component ──────────────────────────────────────────────────

interface AdminPanelProps {
  currentUserId: string;
}

function AdminPanel({ currentUserId }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
                  <td>
                    <div className="admin-user-name">
                      {user.firstName} {user.lastName}
                      {user.isAdmin && (
                        <span className="admin-badge">Admin</span>
                      )}
                    </div>
                    <div className="admin-user-email">{user.email}</div>
                  </td>
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

  // ── User / profile state ────────────────────────────────────────────────────
  const [user, setUser] = useState<MeUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // ── Stats state ─────────────────────────────────────────────────────────────
  const [seasonStats, setSeasonStats] = useState<UserSeasonStats | null>(null);
  const [games, setGames] = useState<UserGameLog[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingGames, setLoadingGames] = useState(true);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const [gameModalMode, setGameModalMode] = useState<'add' | 'edit'>('add');
  const [editingGame, setEditingGame] = useState<UserGameLog | undefined>();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // ── Fetch me ────────────────────────────────────────────────────────────────
  const fetchMe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoadingUser(false);
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setUser(data.user);
    } catch {
      // silently fall back
    } finally {
      setLoadingUser(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const s = await getMySeasonStats();
      setSeasonStats(s);
    } catch {
      // keep null
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchGames = useCallback(async () => {
    setLoadingGames(true);
    try {
      const g = await getMyGames();
      setGames(g);
    } catch {
      // keep empty
    } finally {
      setLoadingGames(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
    fetchStats();
    fetchGames();
  }, [fetchMe, fetchStats, fetchGames]);

  // ── Game log mutations ───────────────────────────────────────────────────────
  const handleSaveGame = async (entry: Parameters<typeof addGame>[0]) => {
    if (gameModalMode === 'add') {
      await addGame(entry);
    } else if (editingGame) {
      await updateGame(editingGame._id, entry);
    }
    await Promise.all([fetchStats(), fetchGames()]);
    setGameModalOpen(false);
  };

  const handleEditGame = (game: UserGameLog) => {
    setEditingGame(game);
    setGameModalMode('edit');
    setGameModalOpen(true);
  };

  const handleDeleteGame = async (gameId: string) => {
    await deleteGame(gameId);
    await Promise.all([fetchStats(), fetchGames()]);
  };

  const openAddGameModal = () => {
    setEditingGame(undefined);
    setGameModalMode('add');
    setGameModalOpen(true);
  };

  // ── Profile update ───────────────────────────────────────────────────────────
  const handleProfileSave = async (updated: AuthUser) => {
    await fetchMe();
    setUser((prev) =>
      prev
        ? {
            ...prev,
            firstName: updated.firstName,
            lastName: updated.lastName,
            email: updated.email,
          }
        : prev,
    );
    setProfileModalOpen(false);
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loadingUser) {
    return (
      <div className="account-page">
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="account-page">
        <div className="account-logged-out">
          <p className="account-logged-out-msg">You are not logged in.</p>
          <button
            className="account-login-btn"
            onClick={() => navigate('/login')}
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="account-two-col">
        {/* ── Left column — single card ──────────────────────────────────── */}
        <div className="account-left">
          <div className="account-card account-left-card">
            {/* Profile header */}
            <ProfileHeader
              user={{
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                avatar: user.avatar,
              }}
              friendCount={user.friends.length}
              favPlayerCount={user.favoritePlayers.length}
              favTeamCount={user.favoriteTeams.length}
              onEditProfile={() => setProfileModalOpen(true)}
              onLogout={handleLogout}
            />

            <hr className="account-inner-divider" />

            {/* Season averages */}
            <div className="account-inner-section">
              <p className="account-sub-label">Your Average Stats</p>
              <StatTiles stats={seasonStats} loading={loadingStats} />
            </div>

            <hr className="account-inner-divider" />

            {/* Game log */}
            <div className="account-inner-section">
              <div className="account-card-header">
                <p className="account-sub-label">Your Game Log</p>
                <button className="agl-new-btn" onClick={openAddGameModal}>
                  New Game +
                </button>
              </div>
              <GameLogTable
                games={games}
                loading={loadingGames}
                onEdit={handleEditGame}
                onDelete={handleDeleteGame}
              />
            </div>
          </div>
        </div>

        {/* ── Right column ──────────────────────────────────────────────── */}
        <div className="account-right">
          <FriendsPanel currentUserId={user._id} />
        </div>
      </div>

      {/* ── Admin panel (admin users only) ──────────────────────────────── */}
      {user.isAdmin && <AdminPanel currentUserId={user._id} />}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {gameModalOpen && (
        <GameLogModal
          mode={gameModalMode}
          initial={editingGame}
          onSave={handleSaveGame}
          onClose={() => setGameModalOpen(false)}
        />
      )}

      {profileModalOpen && (
        <EditProfileModal
          user={user}
          onSave={handleProfileSave}
          onClose={() => setProfileModalOpen(false)}
        />
      )}
    </div>
  );
}
