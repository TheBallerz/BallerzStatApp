import { useEffect, useState } from 'react';
import './homeTeamPanel.css';
import { getTeamAsset } from '../../assets/teamAssets';

interface TeamData {
  teamId: number;
  city: string;
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  record: string;
  ppg: number;
  rpg: number;
  apg: number;
  fgPct: number;
}

interface HomeTeamPanelProps {
  nbaTeamId: number;
  /** Fallback label (e.g. abbreviation) shown before data loads */
  label: string;
  onClose: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}

export default function HomeTeamPanel({ nbaTeamId, label, onClose, isFavorited, onToggleFavorite }: HomeTeamPanelProps) {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${import.meta.env.VITE_API_BASE}/teams/${nbaTeamId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((data: TeamData) => {
        setTeam(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [nbaTeamId]);

  const abbr = team?.abbreviation ?? label;
  const asset = getTeamAsset(abbr);
  const logoUrl = asset.logoUrl;
  const fullName = team ? `${team.city} ${team.name}` : label;

  const stats = team
    ? [
        { label: 'Record',   value: team.record },
        { label: 'PPG',      value: String(team.ppg) },
        { label: 'RPG',      value: String(team.rpg) },
        { label: 'APG',      value: String(team.apg) },
        { label: 'FG%',      value: `${(team.fgPct * 100).toFixed(1)}%` },
      ]
    : [];

  return (
    <div className="htp-panel">
      {/* ── Header ── */}
      <div className="htp-header" style={{ borderTop: `3px solid ${asset.color}` }}>
        <div className="htp-identity">
          {logoUrl && (
            <img
              className="htp-logo"
              src={logoUrl}
              alt={abbr}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
          )}
          <div className="htp-name-wrap">
            <h2 className="htp-name">{fullName}</h2>
            {team && (
              <span className="htp-division">{team.division} Division</span>
            )}
          </div>
        </div>
        <div className="htp-actions">
          <button className="htp-close" onClick={onClose}>×</button>
          {onToggleFavorite && (
            <button
              className={`htp-heart${isFavorited ? ' htp-heart--filled' : ''}`}
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              onClick={onToggleFavorite}
            >
              {isFavorited ? '♥' : '♡'}
            </button>
          )}
        </div>
      </div>

      <div className="htp-divider" />

      {/* ── Body ── */}
      <div className="htp-body">
        {loading ? (
          <p className="htp-status">Loading…</p>
        ) : error || !team ? (
          <p className="htp-status">{error || 'No data found'}</p>
        ) : (
          stats.map(({ label: lbl, value }) => (
            <div key={lbl} className="htp-stat-row">
              <span className="htp-stat-label">{lbl}</span>
              <span className="htp-stat-value">{value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
