import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './userSelfPanel.css';
import { getMySeasonStats, getMyGames } from '../../services/userStatsService';
import type {
  UserSeasonStats,
  UserGameLog,
} from '../../services/userStatsService';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompareStats {
  pts: number;
  ast: number;
  reb: number;
  fg3m: number;
}

interface UserSelfPanelProps {
  compareStats: CompareStats;
  onClose: () => void;
  userName: string;
  userAvatar: string | null;
}

interface ChartRow {
  date: string;
  pts: number;
  ast: number;
  reb: number;
  fg3m: number;
}

type StatKey = 'pts' | 'ast' | 'reb' | 'fg3m';

const STAT_OPTIONS: { key: StatKey; label: string }[] = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
  { key: 'fg3m', label: '3-Pointers' },
];

const TILE_STATS: { key: keyof CompareStats; label: string }[] = [
  { key: 'pts', label: 'PTS' },
  { key: 'ast', label: 'AST' },
  { key: 'reb', label: 'REB' },
  { key: 'fg3m', label: '3PM' },
];

// Map UserGameLog fields to ChartRow keys
function toChartRow(g: UserGameLog): ChartRow {
  const d = new Date(g.gameDate);
  const date = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return {
    date,
    pts: g.points,
    ast: g.assists,
    reb: g.rebounds,
    fg3m: g.threePointersMade,
  };
}

function fmt(val: number): string {
  return val.toFixed(1);
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="usp-tooltip">
      <p className="usp-tooltip-date">{label}</p>
      <p className="usp-tooltip-val">{payload[0].value}</p>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

const CHART_COLOR = '#ffffff';

export default function UserSelfPanel({
  compareStats,
  onClose,
  userName,
  userAvatar,
}: UserSelfPanelProps) {
  const [stats, setStats] = useState<UserSeasonStats | null>(null);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingGames, setLoadingGames] = useState(true);
  const [selectedStat, setSelectedStat] = useState<StatKey>('pts');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [s, games] = await Promise.all([
          getMySeasonStats(),
          getMyGames(),
        ]);
        if (!cancelled) {
          setStats(s);
          // Sort ascending by date for chart (getMyGames returns desc)
          setChartData([...games].reverse().map(toChartRow));
        }
      } catch {
        // leave nulls / empty
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
          setLoadingGames(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const headerGradient = `linear-gradient(to bottom, ${CHART_COLOR}55 0%, #1a1a1a 100%)`;

  // Map season stat keys to chart/compare keys
  const getStatValue = (key: keyof CompareStats): number => {
    if (!stats) return 0;
    switch (key) {
      case 'pts':
        return stats.avgPoints;
      case 'ast':
        return stats.avgAssists;
      case 'reb':
        return stats.avgRebounds;
      case 'fg3m':
        return stats.avgFg3m;
    }
  };

  return (
    <div className="usp-panel">
      {/* ── Header ── */}
      <div className="usp-header" style={{ background: headerGradient }}>
        <div className="usp-identity">
          <h2 className="usp-title">{userName}</h2>
          <span className="usp-subtitle">Your Stats</span>
        </div>

        <div className="usp-header-right">
          <div className="usp-avatar-circle">
            {userAvatar ? (
              <img
                className="usp-avatar-img"
                src={userAvatar}
                alt={userName}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility =
                    'hidden';
                }}
              />
            ) : (
              <span className="usp-avatar-initials">
                {userName
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            )}
          </div>
          <div className="usp-actions">
            <button className="usp-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
      </div>

      {/* ── Chart Section ── */}
      <div className="usp-graph-section">
        <div className="usp-graph-controls">
          <select
            className="usp-stat-select"
            value={selectedStat}
            onChange={(e) => setSelectedStat(e.target.value as StatKey)}
          >
            {STAT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {loadingGames ? (
          <div className="usp-chart-skeleton" />
        ) : chartData.length === 0 ? (
          <p className="usp-chart-empty">No game data yet</p>
        ) : (
          <div className="usp-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="usp-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={CHART_COLOR}
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLOR}
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
                  domain={([min, max]: readonly [number, number]) => {
                    const lo = Math.floor(min / 5) * 5;
                    const hi = Math.ceil(max / 5) * 5;
                    return [lo, hi] as [number, number];
                  }}
                  ticks={(() => {
                    const vals = chartData.map(
                      (g) => g[selectedStat] as number,
                    );
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
                  stroke={CHART_COLOR}
                  strokeWidth={1}
                  fill="url(#usp-grad)"
                  dot={false}
                  activeDot={{ r: 4, fill: CHART_COLOR, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="usp-divider" />

      {/* ── Stats Section ── */}
      <div className="usp-body">
        {loadingStats ? (
          <p className="usp-status">Loading…</p>
        ) : !stats ? (
          <p className="usp-status">No stats available</p>
        ) : (
          <>
            <p className="usp-section-label">Your Averages</p>
            <div className="usp-stats-grid">
              {TILE_STATS.map(({ key, label }) => {
                const userVal = getStatValue(key);
                const cmpVal = compareStats[key];
                const colorClass =
                  userVal >= cmpVal
                    ? 'usp-stat-tile--green'
                    : 'usp-stat-tile--red';
                return (
                  <div key={key} className={`usp-stat-tile ${colorClass}`}>
                    <span className="usp-tile-value">{fmt(userVal)}</span>
                    <span className="usp-tile-label">{label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
