// AccountComponents.tsx
// All left-column / personal account components:
//   ProfileHeader, StatTiles, GameLogTable, GameLogModal, EditProfileModal

import { useState, useRef } from 'react';
import { updateProfile } from '../../services/authService';
import {
  type UserSeasonStats,
  type UserGameLog,
  type NewGameEntry,
} from '../../services/userStatsService';
import './accountComponents.css';

// ── ProfileHeader ──────────────────────────────────────────────────────────────

interface ProfileHeaderProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
  friendCount: number;
  favPlayerCount: number;
  favTeamCount: number;
  onEditProfile: () => void;
  onLogout: () => void;
}

export function ProfileHeader({
  user,
  friendCount,
  favPlayerCount,
  favTeamCount,
  onEditProfile,
  onLogout,
}: ProfileHeaderProps) {
  const initials = (
    (user.firstName[0] || '') + (user.lastName[0] || '')
  ).toUpperCase();

  return (
    <div className="aph-header">
      <div className="aph-avatar">
        {user.avatar ? (
          <img src={user.avatar} alt={`${user.firstName} avatar`} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="aph-info">
        <div className="aph-top-row">
          <div className="aph-name-group">
            <p className="aph-name">
              {user.firstName} {user.lastName}
            </p>
            <p className="aph-email">{user.email}</p>
          </div>
          <div className="aph-actions">
            <button className="aph-edit-btn" onClick={onEditProfile}>
              Edit Profile
            </button>
            <button className="aph-logout-btn" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>
        <div className="aph-counts">
          <div className="aph-count-item">
            <span className="aph-count-label">Friends</span>
            <span className="aph-count-num">{friendCount}</span>
          </div>
          <div className="aph-count-item">
            <span className="aph-count-label">Favorite Players</span>
            <span className="aph-count-num">{favPlayerCount}</span>
          </div>
          <div className="aph-count-item">
            <span className="aph-count-label">Favorite Teams</span>
            <span className="aph-count-num">{favTeamCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── StatTiles ──────────────────────────────────────────────────────────────────

interface StatTilesProps {
  stats: UserSeasonStats | null;
  loading: boolean;
}

const STAT_TILES: { label: string; key: keyof UserSeasonStats }[] = [
  { label: 'PTS', key: 'avgPoints' },
  { label: 'AST', key: 'avgAssists' },
  { label: 'REB', key: 'avgRebounds' },
  { label: '3PM', key: 'avgFg3m' },
];

export function StatTiles({ stats, loading }: StatTilesProps) {
  if (loading) {
    return (
      <div className="ast-grid">
        {STAT_TILES.map((t) => (
          <div key={t.key} className="ast-tile ast-skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="ast-grid">
      {STAT_TILES.map((t) => {
        const raw = stats?.[t.key] as number | undefined;
        const val =
          !stats || stats.gamesPlayed === 0 ? '—' : (raw ?? 0).toFixed(1);
        return (
          <div key={t.key} className="ast-tile">
            <span className="ast-label">{t.label}</span>
            <span className="ast-value">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── GameLogTable ───────────────────────────────────────────────────────────────

interface GameLogTableProps {
  games: UserGameLog[];
  loading: boolean;
  onEdit: (game: UserGameLog) => void;
  onDelete: (gameId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function GameLogTable({
  games,
  loading,
  onEdit,
  onDelete,
}: GameLogTableProps) {
  if (loading) return <p className="agl-empty">Loading…</p>;

  if (games.length === 0) {
    return (
      <p className="agl-empty">
        No games logged yet. Hit "New Game +" to start!
      </p>
    );
  }

  return (
    <table className="agl-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>PTS</th>
          <th>AST</th>
          <th>REB</th>
          <th>3PM</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {games.map((g) => (
          <tr key={g._id}>
            <td className="agl-date-cell">{formatDate(g.gameDate)}</td>
            <td>{g.points}</td>
            <td>{g.assists}</td>
            <td>{g.rebounds}</td>
            <td>{g.threePointersMade}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              <button className="agl-edit-btn" onClick={() => onEdit(g)}>
                Edit
              </button>
              <button
                className="agl-delete-btn"
                onClick={() => onDelete(g._id)}
              >
                ✕
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── GameLogModal ───────────────────────────────────────────────────────────────

interface GameLogModalProps {
  mode: 'add' | 'edit';
  initial?: UserGameLog;
  onSave: (entry: NewGameEntry) => Promise<void>;
  onClose: () => void;
}

function toDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

export function GameLogModal({
  mode,
  initial,
  onSave,
  onClose,
}: GameLogModalProps) {
  const [gameDate, setGameDate] = useState(
    initial ? toDateInput(initial.gameDate) : '',
  );
  const [opponent, setOpponent] = useState(initial?.opponent || '');
  const [points, setPoints] = useState(String(initial?.points ?? 0));
  const [assists, setAssists] = useState(String(initial?.assists ?? 0));
  const [rebounds, setRebounds] = useState(String(initial?.rebounds ?? 0));
  const [threes, setThrees] = useState(String(initial?.threePointersMade ?? 0));
  const [steals, setSteals] = useState(String(initial?.steals ?? 0));
  const [blocks, setBlocks] = useState(String(initial?.blocks ?? 0));
  const [turnovers, setTurnovers] = useState(String(initial?.turnovers ?? 0));
  const [minutes, setMinutes] = useState(String(initial?.minutes ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameDate) {
      setError('Game date is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        gameDate,
        opponent: opponent || undefined,
        points: Number(points) || 0,
        assists: Number(assists) || 0,
        rebounds: Number(rebounds) || 0,
        threePointersMade: Number(threes) || 0,
        steals: Number(steals) || 0,
        blocks: Number(blocks) || 0,
        turnovers: Number(turnovers) || 0,
        minutes: Number(minutes) || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
      setSaving(false);
    }
  };

  const numField = (
    label: string,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => (
    <div className="glm-field" key={label}>
      <label className="glm-label">{label}</label>
      <input
        className="glm-input"
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => setter(e.target.value)}
      />
    </div>
  );

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card">
        <p className="glm-title">
          {mode === 'edit' ? 'Edit Game' : 'Log Game'}
        </p>
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="glm-field">
            <label className="glm-label">Date *</label>
            <input
              className="glm-input"
              type="date"
              value={gameDate}
              required
              onChange={(e) => setGameDate(e.target.value)}
            />
          </div>
          <div className="glm-field">
            <label className="glm-label">Opponent (optional)</label>
            <input
              className="glm-input"
              type="text"
              value={opponent}
              placeholder="e.g. Pickup crew"
              onChange={(e) => setOpponent(e.target.value)}
            />
          </div>
          <div className="glm-grid">
            {numField('PTS *', points, setPoints)}
            {numField('AST *', assists, setAssists)}
            {numField('REB *', rebounds, setRebounds)}
            {numField('3PM *', threes, setThrees)}
            {numField('STL', steals, setSteals)}
            {numField('BLK', blocks, setBlocks)}
            {numField('TOV', turnovers, setTurnovers)}
            {numField('MIN', minutes, setMinutes)}
          </div>
          {error && <p className="glm-error">{error}</p>}
          <div className="glm-actions">
            <button
              type="button"
              className="glm-cancel-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="glm-save-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── EditProfileModal ───────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 2;

interface EditProfileModalProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
  onSave: (updated: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isAdmin: boolean;
    avatar?: string | null;
  }) => void;
  onClose: () => void;
}

export function EditProfileModal({
  user,
  onSave,
  onClose,
}: EditProfileModalProps) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatar,
  );
  const [newAvatarBase64, setNewAvatarBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_FILE_SIZE_MB} MB.`);
      e.target.value = '';
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      setNewAvatarBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setNewAvatarBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (firstName !== user.firstName) payload.firstName = firstName;
      if (lastName !== user.lastName) payload.lastName = lastName;
      if (email !== user.email) payload.email = email;
      if (password) payload.password = password;
      if (newAvatarBase64 !== null) payload.avatar = newAvatarBase64;

      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }

      const updated = await updateProfile(payload);
      onSave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const initials = (
    (user.firstName[0] || '') + (user.lastName[0] || '')
  ).toUpperCase();

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card">
        <p className="epm-title">Edit Profile</p>

        <div className="epm-avatar-row">
          <div className="epm-avatar-preview">
            {avatarPreview ? (
              <img src={avatarPreview} alt="avatar preview" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="epm-avatar-actions">
            <button
              type="button"
              className="epm-upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Photo
            </button>
            {avatarPreview && (
              <button
                type="button"
                className="epm-remove-btn"
                onClick={handleRemoveAvatar}
              >
                Remove
              </button>
            )}
            <span className="epm-avatar-hint">
              Max {MAX_FILE_SIZE_MB} MB · JPG, PNG, GIF
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="epm-field">
            <label className="epm-label">First Name</label>
            <input
              className="epm-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="epm-field">
            <label className="epm-label">Last Name</label>
            <input
              className="epm-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="epm-field">
            <label className="epm-label">Email</label>
            <input
              className="epm-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="epm-field">
            <label className="epm-label">New Password</label>
            <input
              className="epm-input"
              type="password"
              value={password}
              placeholder="Leave blank to keep current"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="epm-error">{error}</p>}
          <div className="epm-actions">
            <button
              type="button"
              className="epm-cancel-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="epm-save-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
