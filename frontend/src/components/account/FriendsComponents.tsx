// FriendsComponents.tsx
// All right-column / social components:
//   ConfirmModal, FriendRowMenu, AddFriends, FriendRequests,
//   FriendsList, Leaderboard, FriendsPanel

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getFriends,
  getLeaderboard,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  type FriendUser,
  type FriendRequest,
  type LeaderboardEntry,
  type LeaderboardSortKey,
  type UserSearchResult,
} from '../../services/friendsService';
import {
  getFriendSeasonStats,
  type UserSeasonStats,
} from '../../services/userStatsService';
import './friendsComponents.css';

// ── ConfirmModal ───────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmDanger?: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmDanger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="modal-card">
        <p className="cfm-title">{title}</p>
        <p className="cfm-message">{message}</p>
        <div className="cfm-actions">
          <button
            className="cfm-cancel-btn"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className={`cfm-confirm-btn${confirmDanger ? ' cfm-danger' : ''}`}
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FriendRowMenu ──────────────────────────────────────────────────────────────

interface FriendRowMenuProps {
  friendName: string;
  onRemove: () => void;
  onBlock: () => void;
}

function FriendRowMenu({ onRemove, onBlock }: FriendRowMenuProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="arm-wrap"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button className="arm-trigger" title="Options">
        •••
      </button>
      {open && (
        <div
          className="arm-menu"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <button className="arm-item" onClick={onRemove}>
            Remove Friend
          </button>
          <hr className="arm-divider" />
          <button className="arm-item arm-danger" onClick={onBlock}>
            Block User
          </button>
        </div>
      )}
    </div>
  );
}

// ── Toast notification ─────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
}

function Toast({ message }: ToastProps) {
  return <div className="aaf-toast">{message}</div>;
}

// ── AddFriends ─────────────────────────────────────────────────────────────────

interface AddFriendsProps {
  onRequestSent: () => void;
}

function AddFriends({ onRequestSent }: AddFriendsProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [showDropdown, setShowDropdown] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const visibleResults = query.length >= 2 ? results : [];
  const isDropdownOpen = query.length >= 2 && showDropdown;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchUsers(query);
        setResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const showToast = (name: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(`Friend request sent to ${name}!`);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  };

  const handleRequest = async (u: UserSearchResult) => {
    try {
      await sendFriendRequest(u._id);
      setSentIds((prev) => new Set(prev).add(u._id));
      showToast(`${u.firstName} ${u.lastName}`);
      onRequestSent();
    } catch {
      /* already sent or blocked */
    }
  };

  const initials = (u: UserSearchResult) =>
    ((u.firstName[0] || '') + (u.lastName[0] || '')).toUpperCase();

  return (
    <>
      {toast && <Toast message={toast} />}
      <div className="aaf-search-wrap">
        <input
          className="aaf-input"
          placeholder="Search by name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => visibleResults.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        />
        {isDropdownOpen && visibleResults.length > 0 && (
          <div className="aaf-dropdown">
            {visibleResults.map((u) => {
              const alreadySent = sentIds.has(u._id);
              return (
                <div key={u._id} className="aaf-result-row">
                  <div className="aaf-avatar-sm">{initials(u)}</div>
                  <span className="aaf-name">
                    {u.firstName} {u.lastName}
                  </span>
                  {u.status === 'friend' && (
                    <button
                      className="aaf-status-btn aaf-status-friend"
                      disabled
                    >
                      Your Friend
                    </button>
                  )}
                  {(u.status === 'pending' || alreadySent) && (
                    <button
                      className="aaf-status-btn aaf-status-requested"
                      disabled
                    >
                      Requested
                    </button>
                  )}
                  {u.status === 'none' && !alreadySent && (
                    <button
                      className="aaf-request-btn"
                      onClick={() => handleRequest(u)}
                    >
                      Request
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── FriendRequests ─────────────────────────────────────────────────────────────

interface FriendRequestsProps {
  requests: FriendRequest[];
  onAccept: (fromUserId: string) => Promise<void>;
  onDecline: (fromUserId: string) => Promise<void>;
}

function FriendRequests({
  requests,
  onAccept,
  onDecline,
}: FriendRequestsProps) {
  const [busy, setBusy] = useState<Set<string>>(new Set());

  if (requests.length === 0) return null;

  const act = async (id: string, fn: (id: string) => Promise<void>) => {
    setBusy((p) => new Set(p).add(id));
    try {
      await fn(id);
    } finally {
      setBusy((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  };

  const initials = (r: FriendRequest) =>
    ((r.from.firstName[0] || '') + (r.from.lastName[0] || '')).toUpperCase();

  return (
    <div>
      {requests.map((r) => {
        const id = r.from._id;
        const isBusy = busy.has(id);
        return (
          <div key={id} className="afr-row">
            <div className="afr-avatar">{initials(r)}</div>
            <span className="afr-name">
              {r.from.firstName} {r.from.lastName}
            </span>
            <button
              className="afr-icon-btn afr-accept"
              disabled={isBusy}
              title="Accept"
              onClick={() => act(id, onAccept)}
            >
              ✓
            </button>
            <button
              className="afr-icon-btn afr-decline"
              disabled={isBusy}
              title="Decline"
              onClick={() => act(id, onDecline)}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── FriendsList ────────────────────────────────────────────────────────────────

interface FriendsListProps {
  friends: FriendUser[];
  onRemove: (friendId: string, friendName: string) => void;
  onBlock: (friendId: string, friendName: string) => void;
}

function FriendsList({ friends, onRemove, onBlock }: FriendsListProps) {
  const [statsMap, setStatsMap] = useState<Record<string, UserSeasonStats>>({});

  useEffect(() => {
    if (friends.length === 0) return;
    Promise.all(
      friends.map((f) =>
        getFriendSeasonStats(f._id)
          .then((s) => ({ id: f._id, stats: s }))
          .catch(() => ({ id: f._id, stats: null })),
      ),
    ).then((results) => {
      const map: Record<string, UserSeasonStats> = {};
      for (const r of results) {
        if (r.stats) map[r.id] = r.stats;
      }
      setStatsMap(map);
    });
  }, [friends]);

  const fmt = (userId: string, key: keyof UserSeasonStats): string => {
    const s = statsMap[userId];
    if (!s || s.gamesPlayed === 0) return '—';
    return (s[key] as number).toFixed(1);
  };

  const initials = (f: FriendUser) =>
    ((f.firstName[0] || '') + (f.lastName[0] || '')).toUpperCase();

  return (
    <table className="afl-table">
      <thead>
        <tr>
          <th></th>
          <th>Name</th>
          <th>PTS</th>
          <th>AST</th>
          <th>REB</th>
          <th>3PM</th>
        </tr>
      </thead>
      <tbody>
        {friends.map((f) => {
          const fullName = `${f.firstName} ${f.lastName}`;
          return (
            <tr key={f._id} className="afl-row">
              <td style={{ width: 40 }}>
                <FriendRowMenu
                  friendName={fullName}
                  onRemove={() => onRemove(f._id, fullName)}
                  onBlock={() => onBlock(f._id, fullName)}
                />
              </td>
              <td>
                <div className="afl-name-cell">
                  <div className="afl-avatar-sm">{initials(f)}</div>
                  {fullName}
                </div>
              </td>
              <td>{fmt(f._id, 'avgPoints')}</td>
              <td>{fmt(f._id, 'avgAssists')}</td>
              <td>{fmt(f._id, 'avgRebounds')}</td>
              <td>{fmt(f._id, 'avgFg3m')}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

const STAT_LABEL: Record<LeaderboardSortKey, string> = {
  avgPoints: 'PPG',
  avgAssists: 'APG',
  avgRebounds: 'RPG',
  avgFg3m: '3PM',
};

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  sortBy: LeaderboardSortKey;
  loading: boolean;
  currentUserId: string;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="alb-badge alb-gold">1st</span>;
  if (rank === 2) return <span className="alb-badge alb-silver">2nd</span>;
  if (rank === 3) return <span className="alb-badge alb-bronze">3rd</span>;
  return <span className="alb-rank-num">{rank}th</span>;
}

function Leaderboard({
  entries,
  sortBy,
  loading,
  currentUserId,
}: LeaderboardProps) {
  const statLabel = STAT_LABEL[sortBy];

  const statValue = (e: LeaderboardEntry): string => {
    const map: Record<LeaderboardSortKey, number> = {
      avgPoints: e.avgPoints,
      avgAssists: e.avgAssists,
      avgRebounds: e.avgRebounds,
      avgFg3m: e.avgFg3m,
    };
    return map[sortBy].toFixed(0);
  };

  if (loading) return <p className="alb-empty">Loading…</p>;
  if (entries.length === 0)
    return <p className="alb-empty">Add friends to see the leaderboard!</p>;

  return (
    <div>
      {entries.map((e) => (
        <div
          key={e.userId}
          className={`alb-row${e.userId === currentUserId ? ' alb-self-row' : ''}`}
        >
          <RankBadge rank={e.rank} />
          <span className="alb-entry-line">
            {e.firstName} {e.lastName}
            {e.userId === currentUserId ? ' (you)' : ''}
            {' — '}
            <strong>
              {statValue(e)} {statLabel}
            </strong>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── FriendsPanel ───────────────────────────────────────────────────────────────

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  confirmDanger: boolean;
  onConfirm: () => Promise<void>;
}

interface FriendsPanelProps {
  currentUserId: string;
}

export function FriendsPanel({ currentUserId }: FriendsPanelProps) {
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardSort, setLeaderboardSort] =
    useState<LeaderboardSortKey>('avgPoints');
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);

  const fetchFriends = useCallback(async () => {
    try {
      const data = await getFriends();
      setFriends(data.friends);
      setRequests(data.friendRequests);
    } catch {
      /* silently ignore */
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async (sortBy: LeaderboardSortKey) => {
    setLoadingLeaderboard(true);
    try {
      const data = await getLeaderboard(sortBy);
      setLeaderboard(data);
    } catch {
      /* silently ignore */
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
    fetchLeaderboard('avgPoints');
  }, [fetchFriends, fetchLeaderboard]);

  const refetchAll = () => {
    fetchFriends();
    fetchLeaderboard(leaderboardSort);
  };

  const handleLeaderboardSortChange = (sortBy: LeaderboardSortKey) => {
    setLeaderboardSort(sortBy);
    fetchLeaderboard(sortBy);
  };

  const handleAccept = async (fromUserId: string) => {
    await acceptFriendRequest(fromUserId);
    refetchAll();
  };
  const handleDecline = async (fromUserId: string) => {
    await declineFriendRequest(fromUserId);
    fetchFriends();
  };

  const handleRemove = (friendId: string, friendName: string) => {
    setConfirmModal({
      title: 'Remove Friend',
      message: `Remove ${friendName} from your friends list?`,
      confirmLabel: 'Remove',
      confirmDanger: false,
      onConfirm: async () => {
        await removeFriend(friendId);
        refetchAll();
      },
    });
  };

  const handleBlock = (friendId: string, friendName: string) => {
    setConfirmModal({
      title: 'Block User',
      message: `Block ${friendName}? They won't be able to find you or send you requests.`,
      confirmLabel: 'Block',
      confirmDanger: true,
      onConfirm: async () => {
        await blockUser(friendId);
        refetchAll();
      },
    });
  };

  return (
    <div className="account-card afp-panel">
      <h2 className="afp-title">Friends</h2>
      <hr className="afp-divider" />

      <div className="afp-section">
        <p className="afp-section-label">Add Friends</p>
        <AddFriends onRequestSent={fetchFriends} />
      </div>

      {!loadingFriends && requests.length > 0 && (
        <>
          <hr className="afp-divider" />
          <div className="afp-section">
            <p className="afp-section-label">
              Friend Requests
              <span className="afp-req-count">{requests.length}</span>
            </p>
            <FriendRequests
              requests={requests}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          </div>
        </>
      )}

      <hr className="afp-divider" />
      <div className="afp-section">
        <p className="afp-section-label">Your Friends</p>
        {loadingFriends ? (
          <p className="afp-empty">Loading…</p>
        ) : friends.length === 0 ? (
          <p className="afp-empty">No friends yet. Search above to add some!</p>
        ) : (
          <FriendsList
            friends={friends}
            onRemove={handleRemove}
            onBlock={handleBlock}
          />
        )}
      </div>

      <hr className="afp-divider" />
      <div className="afp-section">
        <div className="afp-section-header">
          <p className="afp-section-label">Leaderboard</p>
          <select
            className="alb-stat-select"
            value={leaderboardSort}
            onChange={(e) =>
              handleLeaderboardSortChange(e.target.value as LeaderboardSortKey)
            }
          >
            <option value="avgPoints">PTS</option>
            <option value="avgAssists">AST</option>
            <option value="avgRebounds">REB</option>
            <option value="avgFg3m">3PM</option>
          </select>
        </div>
        <Leaderboard
          entries={leaderboard}
          sortBy={leaderboardSort}
          loading={loadingLeaderboard}
          currentUserId={currentUserId}
        />
      </div>

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          confirmDanger={confirmModal.confirmDanger}
          onConfirm={async () => {
            await confirmModal.onConfirm();
            setConfirmModal(null);
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
