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
  fg3m: number;
  fgPct: number;
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
}

interface HomeTeamPanelProps {
  nbaTeamId: number;
  label: string;
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
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmt(val: number): string {
  return val.toFixed(1);
}

function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="htp-tooltip">
      <p className="htp-tooltip-date">{label}</p>
      <p className="htp-tooltip-val">{payload[0].value}</p>
    </div>
  );
}

export default function HomeTeamPanel({
  nbaTeamId,
  label,
  onClose,
  isFavorited,
  onToggleFavorite,
  showCompare,
  onCompareYourself,
}: HomeTeamPanelProps) {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [games, setGames] = useState<GameLog[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [selectedStat, setSelectedStat] = useState<keyof GameLog>('pts');

  useEffect(() => {
    setTeam(null);
    setError('');
    setLoading(true);
    async function load() {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_API_BASE}/teams/${nbaTeamId}`,
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setTeam(await r.json());
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [nbaTeamId]);

  useEffect(() => {
    setGames([]);
    setLoadingGames(true);
    async function loadGames() {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_API_BASE}/teams/${nbaTeamId}/games`,
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
  }, [nbaTeamId]);

  const abbr = team?.abbreviation ?? label;
  const asset = getTeamAsset(abbr);
  const fullName = team?.name ?? label;
  const headerGradient = `linear-gradient(to bottom, ${asset.color}55 0%, #1a1a1a 100%)`;

  const lastGame = games.length > 0 ? games[games.length - 1] : null;

  const TILE_STATS: {
    key: keyof TeamData | 'fgPctDisplay';
    label: string;
    isRecord?: boolean;
  }[] = [
    { key: 'record', label: 'Record', isRecord: true },
    { key: 'ppg', label: 'PPG' },
    { key: 'rpg', label: 'RPG' },
    { key: 'apg', label: 'APG' },
    { key: 'fg3m', label: '3PM' },
    { key: 'fgPctDisplay', label: 'FG%' },
  ];

  return (
    <div className="htp-panel">
      {/* ── Header ── */}
      <div className="htp-header" style={{ background: headerGradient }}>
        <div className="htp-identity">
          <h2 className="htp-name">{fullName}</h2>
          {team && (
            <span className="htp-division">{team.division} Division</span>
          )}
        </div>

        <div className="htp-header-right">
          <div className="htp-logo-circle">
            <img
              className="htp-logo"
              src={asset.logoUrl}
              alt={abbr}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility =
                  'hidden';
              }}
            />
          </div>
          <div className="htp-actions">
            <button className="htp-close" onClick={onClose}>
              ×
            </button>
            {onToggleFavorite && (
              <button
                className={`htp-heart${isFavorited ? ' htp-heart--filled' : ''}`}
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
      <div className="htp-graph-section">
        <div className="htp-graph-controls">
          <select
            className="htp-stat-select"
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
          <div className="htp-chart-skeleton" />
        ) : games.length === 0 ? (
          <p className="htp-chart-empty">No recent game data</p>
        ) : (
          <div className="htp-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={games}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`grad-team-${nbaTeamId}`}
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
                  fill={`url(#grad-team-${nbaTeamId})`}
                  dot={false}
                  activeDot={{ r: 4, fill: '#ffffff', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="htp-divider" />

      {/* ── Stats Section ── */}
      <div className="htp-body">
        {loading ? (
          <p className="htp-status">Loading…</p>
        ) : error || !team ? (
          <p className="htp-status">{error || 'No data found'}</p>
        ) : (
          <>
            <p className="htp-section-label">Season Averages</p>
            <div className="htp-stats-grid">
              {TILE_STATS.map(({ key, label: lbl, isRecord }) => {
                if (isRecord) {
                  return (
                    <div key={key} className="htp-stat-tile">
                      <span className="htp-tile-value">{team.record}</span>
                      <span className="htp-tile-label">{lbl}</span>
                    </div>
                  );
                }

                const seasonVal =
                  key === 'fgPctDisplay'
                    ? team.fgPct * 100
                    : (team[key as keyof TeamData] as number);
                const lastVal = lastGame
                  ? key === 'fgPctDisplay'
                    ? null
                    : ((lastGame[key as keyof GameLog] as number | undefined) ??
                      null)
                  : null;
                const diff =
                  lastVal !== null && lastVal !== undefined
                    ? lastVal - seasonVal
                    : null;
                const diffStr =
                  diff === null ? null : diff > 0 ? `+${fmt(diff)}` : fmt(diff);
                const diffClass =
                  diff === null ? '' : diff > 0 ? 'pos' : diff < 0 ? 'neg' : '';
                const displayVal =
                  key === 'fgPctDisplay'
                    ? `${seasonVal.toFixed(1)}%`
                    : fmt(seasonVal);

                return (
                  <div key={key} className="htp-stat-tile">
                    <span className="htp-tile-value">{displayVal}</span>
                    <span className="htp-tile-label">{lbl}</span>
                    {diffStr !== null && (
                      <span className={`htp-tile-diff ${diffClass}`}>
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
      {showCompare && team && onCompareYourself && (
        <div className="htp-compare-wrap">
          <button
            className="htp-compare-btn"
            onClick={() =>
              onCompareYourself({
                pts: team.ppg,
                ast: team.apg,
                reb: team.rpg,
                fg3m: team.fg3m,
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
