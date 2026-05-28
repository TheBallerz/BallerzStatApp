import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import './playerDetailPanel.css';
import { getTeamAsset } from '../../assets/teamAssets';

interface PlayerStats {
  seasonAvg: { pts: number; reb: number; ast: number; fg3m: number };
  lastGame: { pts: number; reb: number; ast: number; fg3m: number } | null;
}

interface GameLog {
  date: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg3m: number;
  min: number;
}

interface PlayerDetailPanelProps {
  nbaPlayerId: number;
  playerName: string;
  teamAbbr: string;
  onClose: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  showCompare?: boolean;
  onCompareYourself?: (stats: {
    pts: number;
    ast: number;
    reb: number;
    fg3m: number;
  }) => void;
}

const STAT_OPTIONS: { key: keyof GameLog; label: string }[] = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
  { key: 'stl', label: 'Steals' },
  { key: 'blk', label: 'Blocks' },
  { key: 'tov', label: 'Turnovers' },
  { key: 'fg3m', label: '3-Pointers' },
  { key: 'min', label: 'Minutes' },
];

const TILE_STATS: { key: keyof PlayerStats['seasonAvg']; label: string }[] = [
  { key: 'pts', label: 'PTS' },
  { key: 'ast', label: 'AST' },
  { key: 'reb', label: 'REB' },
  { key: 'fg3m', label: '3PM' },
];

function fmt(val: number): string {
  return val.toFixed(1);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pdp-tooltip">
      <p className="pdp-tooltip-date">{label}</p>
      <p className="pdp-tooltip-val">{payload[0].value}</p>
    </div>
  );
}

export default function PlayerDetailPanel({
  nbaPlayerId,
  playerName,
  teamAbbr,
  onClose,
  isFavorited,
  onToggleFavorite,
  showCompare,
  onCompareYourself,
}: PlayerDetailPanelProps) {
  const asset = getTeamAsset(teamAbbr);
  const headshotUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaPlayerId}.png`;

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [games, setGames] = useState<GameLog[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingGames, setLoadingGames] = useState(true);
  const [error, setError] = useState('');
  const [selectedStat, setSelectedStat] = useState<keyof GameLog>('pts');

  useEffect(() => {
    setStats(null);
    setError('');
    setLoadingStats(true);

    async function loadStats() {
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
        setLoadingStats(false);
      }
    }

    loadStats();
  }, [nbaPlayerId]);

  useEffect(() => {
    setGames([]);
    setLoadingGames(true);

    async function loadGames() {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_API_BASE}/players/${nbaPlayerId}/games`,
        );
        if (r.ok) {
          const data: GameLog[] = await r.json();
          setGames(data.map((g) => ({ ...g, date: fmtDate(g.date) })));
        }
      } catch {
        // leave games empty
      } finally {
        setLoadingGames(false);
      }
    }

    loadGames();
  }, [nbaPlayerId]);

  const headerGradient = `linear-gradient(to bottom, ${asset.color}55 0%, #1a1a1a 100%)`;

  return (
    <div className="pdp-panel">
      {/* ── Header ── */}
      <div className="pdp-header" style={{ background: headerGradient }}>
        <div className="pdp-identity">
          <h2 className="pdp-name">{playerName}</h2>
          {teamAbbr && <span className="pdp-team">{teamAbbr}</span>}
        </div>

        <div className="pdp-header-right">
          <div className="pdp-headshot-circle">
            <img
              className="pdp-headshot"
              src={headshotUrl}
              alt={playerName}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility =
                  'hidden';
              }}
            />
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
      </div>

      {/* ── Chart Section ── */}
      <div className="pdp-graph-section">
        <div className="pdp-graph-controls">
          <select
            className="pdp-stat-select"
            value={selectedStat}
            onChange={(e) => setSelectedStat(e.target.value as keyof GameLog)}
          >
            {STAT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {loadingGames ? (
          <div className="pdp-chart-skeleton" />
        ) : games.length === 0 ? (
          <p className="pdp-chart-empty">No recent game data</p>
        ) : (
          <div className="pdp-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={games}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`grad-${nbaPlayerId}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={asset.color}
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor={asset.color}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                  tickLine={false}
                  tickCount={undefined}
                  tickFormatter={(v: number) => String(v)}
                  domain={([min, max]: [number, number]) => {
                    const lo = Math.floor(min / 5) * 5;
                    const hi = Math.ceil(max / 5) * 5;
                    return [lo, hi];
                  }}
                  ticks={(() => {
                    const vals = games.map((g) => g[selectedStat] as number);
                    if (!vals.length) return [];
                    const lo = Math.floor(Math.min(...vals) / 5) * 5;
                    const hi = Math.ceil(Math.max(...vals) / 5) * 5;
                    const result = [];
                    for (let v = lo; v <= hi; v += 5) result.push(v);
                    return result;
                  })()}
                  width={28}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
                />
                <Area
                  type="linear"
                  dataKey={selectedStat}
                  stroke="#ffffff"
                  strokeWidth={1}
                  fill={`url(#grad-${nbaPlayerId})`}
                  dot={false}
                  activeDot={{ r: 4, fill: '#ffffff', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="pdp-divider" />

      {/* ── Stats Section ── */}
      <div className="pdp-body">
        {loadingStats ? (
          <p className="pdp-status">Loading…</p>
        ) : error || !stats ? (
          <p className="pdp-status">
            {error || 'No stats available for this season'}
          </p>
        ) : (
          <>
            <p className="pdp-section-label">Season Averages</p>
            <div className="pdp-stats-grid">
              {TILE_STATS.map(({ key, label }) => {
                const avg = stats.seasonAvg[key];
                const last = stats.lastGame?.[key] ?? null;
                const diff = last !== null ? last - avg : null;
                const diffStr =
                  diff === null ? null : diff > 0 ? `+${fmt(diff)}` : fmt(diff);
                const diffClass =
                  diff === null ? '' : diff > 0 ? 'pos' : diff < 0 ? 'neg' : '';
                return (
                  <div key={key} className="pdp-stat-tile">
                    <span className="pdp-tile-value">{fmt(avg)}</span>
                    <span className="pdp-tile-label">{label}</span>
                    {diffStr !== null && (
                      <span className={`pdp-tile-diff ${diffClass}`}>
                        {diffStr}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Compare Yourself ── */}
      {showCompare && stats && onCompareYourself && (
        <div className="pdp-compare-wrap">
          <button
            className="pdp-compare-btn"
            onClick={() =>
              onCompareYourself({
                pts: stats.seasonAvg.pts,
                ast: stats.seasonAvg.ast,
                reb: stats.seasonAvg.reb,
                fg3m: stats.seasonAvg.fg3m,
              })
            }
          >
            Compare Yourself
          </button>
        </div>
      )}
    </div>
  );
}
