import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="htp-tooltip">
      <p className="htp-tooltip-date">{label}</p>
      <p className="htp-tooltip-val">{payload[0].value}</p>
    </div>
  );
}

type Props = {
  nbaTeamId: number;
  color?: string;
};

export default function TeamStatChart({ nbaTeamId, color = '#ffffff' }: Props) {
  const [games, setGames] = useState<GameLog[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [selectedStat, setSelectedStat] = useState<keyof GameLog>('pts');

  useEffect(() => {
    async function loadGames() {
      try {
        setLoadingGames(true);

        const r = await fetch(
          `${import.meta.env.VITE_API_BASE}/teams/${nbaTeamId}/games`,
        );

        if (!r.ok) throw new Error();

        const data: GameLog[] = await r.json();

        setGames(
          data.map((g) => ({
            ...g,
            date: fmtDate(g.date),
          })),
        );
      } catch {
        setGames([]);
      } finally {
        setLoadingGames(false);
      }
    }

    loadGames();
  }, [nbaTeamId]);

  return (
    <div className="htp-graph-section">
      <div className="htp-graph-controls">
        <select
          className="htp-stat-select"
          value={selectedStat}
          onChange={(e) => setSelectedStat(e.target.value as keyof GameLog)}
        >
          {STAT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
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
              margin={{
                top: 4,
                right: 8,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient
                  id={`grad-team-${nbaTeamId}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={color} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="date"
                tick={{
                  fill: 'rgba(255,255,255,0.35)',
                  fontSize: 10,
                }}
                axisLine={{
                  stroke: 'rgba(255,255,255,0.15)',
                }}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fill: 'rgba(255,255,255,0.35)',
                  fontSize: 10,
                }}
                axisLine={{
                  stroke: 'rgba(255,255,255,0.15)',
                }}
                tickLine={false}
                width={28}
              />

              <Tooltip content={<ChartTooltip />} />

              <Area
                type="linear"
                dataKey={selectedStat}
                stroke="#ffffff"
                strokeWidth={1}
                fill={`url(#grad-team-${nbaTeamId})`}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: '#ffffff',
                  strokeWidth: 0,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
