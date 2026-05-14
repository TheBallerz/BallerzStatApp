import { useEffect, useState } from 'react';
import './favoritePlayerCard.css';
import { getTeamAsset } from '../../assets/teamAssets';

export interface FavoritePlayer {
  _id: string;
  firstName: string;
  lastName: string;
  nbaId: number | null;
  imageUrl: string | null;
  teamId: { abbreviation: string } | null;
}

interface PlayerStats {
  seasonAvg: { pts: number; reb: number; ast: number; fg3m: number };
  lastGame: { pts: number; reb: number; ast: number; fg3m: number } | null;
}

interface StatRowProps {
  label: string;
  avg: number;
  last: number | null;
}

function fmt(val: number, decimals = 1): string {
  return val.toFixed(decimals);
}

function StatRow({ label, avg, last }: StatRowProps) {
  const diff = last !== null ? last - avg : null;
  const diffStr =
    diff === null
      ? '--'
      : diff > 0
        ? `+${fmt(diff)}`
        : fmt(diff);
  const diffClass =
    diff === null ? '' : diff > 0 ? 'fpc-diff-pos' : diff < 0 ? 'fpc-diff-neg' : '';

  return (
    <tr className="fpc-stat-row">
      <td className="fpc-stat-label">{label}</td>
      <td className="fpc-stat-val">{fmt(avg)}</td>
      <td className="fpc-stat-val">{last !== null ? String(last) : '--'}</td>
      <td className={`fpc-stat-val fpc-diff ${diffClass}`}>{diffStr}</td>
    </tr>
  );
}

interface FavoritePlayerCardProps {
  player: FavoritePlayer;
  onClick?: () => void;
  /** When true the card is dimmed and non-interactive */
  isGreyed?: boolean;
}

export default function FavoritePlayerCard({ player, onClick, isGreyed }: FavoritePlayerCardProps) {
  const abbr = player.teamId?.abbreviation ?? '';
  const asset = getTeamAsset(abbr);

  const headshotUrl = player.nbaId
    ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.nbaId}.png`
    : (player.imageUrl ?? '');

  const fullName = `${player.firstName} ${player.lastName}`;
  const gradient = `linear-gradient(to right, ${asset.color}cc 0%, #1a1a1a 52%)`;

  const [stats, setStats] = useState<PlayerStats | null>(null);
  // Track whether a fetch is still in flight so the skeleton doesn't spin
  // forever when the response is a non-ok status (404, 500) or a network error.
  // Initialise to true only when there is an nbaId to fetch — cards with no
  // nbaId should never show the skeleton at all.
  const [loading, setLoading] = useState<boolean>(!!player.nbaId);

  useEffect(() => {
    if (!player.nbaId) return;
    setLoading(true);
    fetch(`/api/players/${player.nbaId}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [player.nbaId]);

  return (
    <div
      className="fpc-card"
      style={{
        background: gradient,
        ...(isGreyed ? { filter: 'grayscale(0.8) opacity(0.4)', pointerEvents: 'none' } : {}),
      }}
      onClick={onClick}
    >
      {/* Left column — name, team, photo */}
      <div className="fpc-left">
        <div className="fpc-info">
          <span className="fpc-name">{fullName}</span>
          {abbr && <span className="fpc-team">{abbr}</span>}
        </div>
        {headshotUrl && (
          <img
            className="fpc-headshot"
            src={headshotUrl}
            alt={fullName}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
            }}
          />
        )}
      </div>

      {/* Right column — stat table */}
      <div className="fpc-right">
        {loading ? (
          <div className="fpc-loading" />
        ) : stats ? (
          <table className="fpc-table">
            <thead>
              <tr>
                <th className="fpc-th">Stat</th>
                <th className="fpc-th">Avg</th>
                <th className="fpc-th">Last</th>
                <th className="fpc-th">Dif</th>
              </tr>
            </thead>
            <tbody>
              <StatRow label="PTS" avg={stats.seasonAvg.pts}  last={stats.lastGame?.pts  ?? null} />
              <StatRow label="3PM" avg={stats.seasonAvg.fg3m} last={stats.lastGame?.fg3m ?? null} />
              <StatRow label="AST" avg={stats.seasonAvg.ast}  last={stats.lastGame?.ast  ?? null} />
              <StatRow label="REB" avg={stats.seasonAvg.reb}  last={stats.lastGame?.reb  ?? null} />
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
