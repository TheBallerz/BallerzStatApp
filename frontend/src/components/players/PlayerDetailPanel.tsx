import { useEffect, useState } from 'react';
import './playerDetailPanel.css';
import { getTeamAsset } from '../../assets/teamAssets';

interface PlayerStats {
  seasonAvg: { pts: number; reb: number; ast: number; fg3m: number };
  lastGame: { pts: number; reb: number; ast: number; fg3m: number } | null;
}

interface PlayerDetailPanelProps {
  nbaPlayerId: number;
  playerName: string;
  teamAbbr: string;
  onClose: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}

function fmt(val: number): string {
  return val.toFixed(1);
}

export default function PlayerDetailPanel({
  nbaPlayerId,
  playerName,
  teamAbbr,
  onClose,
  isFavorited,
  onToggleFavorite,
}: PlayerDetailPanelProps) {
  const asset = getTeamAsset(teamAbbr);
  const headshotUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaPlayerId}.png`;

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const r = await fetch(
          `${import.meta.env.VITE_API_BASE}/players/${nbaPlayerId}/stats`,
        );
        if (r.status === 404) return;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setStats(await r.json());
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [nbaPlayerId]);

  // Stat definitions in display order
  const statDefs: { key: keyof PlayerStats['seasonAvg']; label: string }[] = [
    { key: 'pts', label: 'PTS' },
    { key: 'reb', label: 'REB' },
    { key: 'ast', label: 'AST' },
    { key: 'fg3m', label: '3PM' },
  ];

  return (
    <div className="pdp-panel">
      {/* ── Header ── */}
      <div className="pdp-header">
        <div className="pdp-identity">
          <img
            className="pdp-headshot"
            src={headshotUrl}
            alt={playerName}
            style={{ border: `2px solid ${asset.color}` }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
            }}
          />
          <div className="pdp-name-wrap">
            <h2 className="pdp-name">{playerName}</h2>
            {teamAbbr && <span className="pdp-team">{teamAbbr}</span>}
          </div>
        </div>
        <div className="pdp-actions">
          <button className="pdp-close" onClick={onClose}>
            ×
          </button>
          {onToggleFavorite && (
            <button
              className={`pdp-heart${isFavorited ? ' pdp-heart--filled' : ''}`}
              aria-label={
                isFavorited ? 'Remove from favorites' : 'Add to favorites'
              }
              onClick={onToggleFavorite}
            >
              {isFavorited ? '♥' : '♡'}
            </button>
          )}
        </div>
      </div>

      <div className="pdp-divider" />

      {/* ── Body ── */}
      <div className="pdp-body">
        {loading ? (
          <p className="pdp-status">Loading…</p>
        ) : error || !stats ? (
          <p className="pdp-status">
            {error || 'No stats available for this season'}
          </p>
        ) : (
          <>
            <p className="pdp-section-label">Season Averages</p>
            {statDefs.map(({ key, label }) => (
              <div key={key} className="pdp-stat-row">
                <span className="pdp-stat-label">{label}</span>
                <span className="pdp-stat-value">
                  {fmt(stats.seasonAvg[key])}
                </span>
              </div>
            ))}

            <p className="pdp-section-label">Last Game</p>
            {stats.lastGame ? (
              statDefs.map(({ key, label }) => (
                <div key={key} className="pdp-stat-row">
                  <span className="pdp-stat-label">{label}</span>
                  <span className="pdp-stat-value">{stats.lastGame![key]}</span>
                </div>
              ))
            ) : (
              <p
                className="pdp-status"
                style={{ textAlign: 'left', padding: '6px 0' }}
              >
                No recent game data
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
