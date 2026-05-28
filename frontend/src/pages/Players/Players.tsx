import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import './Players.css';
import PlayerBio from './PlayerBio';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Player {
  playerId: number;
  fullName: string;
  teamId: number;
  team: string; // abbreviation e.g. "LAL"
  teamName: string;
  fromYear: string;
  toYear: string;
  rosterStatus: number; // 1 = active
}

interface CareerSeason {
  season: string;
  teamId: number;
  team: string;
  gamesPlayed: number;
  gamesStarted: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
}

interface CareerStats {
  playerId: string;
  seasons: CareerSeason[];
}

type SortDirection = 'asc' | 'desc' | null;
type SortKey = keyof CareerSeason;

interface SortState {
  key: SortKey | null;
  direction: SortDirection;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE;

const GRAPH_STAT_OPTIONS = [
  { key: 'points', label: 'Points' },
  { key: 'rebounds', label: 'Rebounds' },
  { key: 'assists', label: 'Assists' },
  { key: 'steals', label: 'Steals' },
  { key: 'blocks', label: 'Blocks' },
  { key: 'turnovers', label: 'Turnovers' },
] as const;

type GraphStatKey = (typeof GRAPH_STAT_OPTIONS)[number]['key'];

// ─── Team Colors ───────────────────────────────────────────────────────────────

const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  LAL: { primary: '#552583', secondary: '#FDB927' },
  GSW: { primary: '#1D428A', secondary: '#FFC72C' },
  BOS: { primary: '#007A33', secondary: '#BA9653' },
  CHI: { primary: '#CE1141', secondary: '#FFFFFF' },
  MIA: { primary: '#98002E', secondary: '#F9A01B' },
  NYK: { primary: '#006BB6', secondary: '#F58426' },
  LAC: { primary: '#C8102E', secondary: '#1D428A' },
  PHX: { primary: '#1D1160', secondary: '#E56020' },
  DEN: { primary: '#0E2240', secondary: '#FEC524' },
  MIL: { primary: '#00471B', secondary: '#EEE1C6' },
  DAL: { primary: '#00538C', secondary: '#002B5E' },
  PHI: { primary: '#006BB6', secondary: '#ED174C' },
  BKN: { primary: '#444444', secondary: '#AAAAAA' },
  TOR: { primary: '#CE1141', secondary: '#FF6B35' },
  ATL: { primary: '#E03A3E', secondary: '#C1D32F' },
  CLE: { primary: '#860038', secondary: '#FDBB30' },
  IND: { primary: '#002D62', secondary: '#FDBB30' },
  CHA: { primary: '#1D1160', secondary: '#00788C' },
  ORL: { primary: '#0077C0', secondary: '#C4CED4' },
  WAS: { primary: '#002B5C', secondary: '#E31837' },
  MEM: { primary: '#5D76A9', secondary: '#12173F' },
  NOP: { primary: '#0C2340', secondary: '#C8A956' },
  SAS: { primary: '#444444', secondary: '#C4CED4' },
  OKC: { primary: '#007AC1', secondary: '#EF3B24' },
  UTA: { primary: '#002B5C', secondary: '#00471B' },
  POR: { primary: '#E03A3E', secondary: '#000000' },
  SAC: { primary: '#5A2D81', secondary: '#63727A' },
  MIN: { primary: '#0C2340', secondary: '#236192' },
  HOU: { primary: '#CE1141', secondary: '#C4CED4' },
  DET: { primary: '#C8102E', secondary: '#1D428A' },
};

const getColors = (abbr: string) =>
  TEAM_COLORS[abbr] ?? { primary: '#333333', secondary: '#888888' };

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getHeadshotUrl(playerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
}

function fmtPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '—';
  return (val * 100).toFixed(1) + '%';
}

function fmtStat(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '—';
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}

// ─── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Component ─────────────────────────────────────────────────────────────────

function SortIcon({
  direction,
  active,
  color,
}: {
  direction: SortDirection;
  active: boolean;
  color: string;
}) {
  const dimColor = 'rgba(255,255,255,0.18)';
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '1px',
        marginLeft: '4px',
        verticalAlign: 'middle',
      }}
    >
      <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
        <path
          d="M3.5 0.5L6.5 4.5H0.5L3.5 0.5Z"
          fill={active && direction === 'asc' ? color : dimColor}
          style={{ transition: 'fill 0.15s' }}
        />
      </svg>
      <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
        <path
          d="M3.5 4.5L0.5 0.5H6.5L3.5 4.5Z"
          fill={active && direction === 'desc' ? color : dimColor}
          style={{ transition: 'fill 0.15s' }}
        />
      </svg>
    </span>
  );
}

export default function Players() {
  // ── Sidebar state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [errorPlayers, setErrorPlayers] = useState<string | null>(null);

  // ── Detail state ───────────────────────────────────────────────────────────
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [careerStats, setCareerStats] = useState<CareerStats | null>(null);
  const [loadingCareer, setLoadingCareer] = useState(false);
  const [errorCareer, setErrorCareer] = useState<string | null>(null);
  const location = useLocation();
  const [sort, setSort] = useState<SortState>({ key: null, direction: null });
  const [selectedGraphStat, setSelectedGraphStat] =
    useState<GraphStatKey>('points');

  const debouncedSearch = useDebounce(searchQuery, 300);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedGraphLabel =
    GRAPH_STAT_OPTIONS.find((option) => option.key === selectedGraphStat)
      ?.label ?? 'Points';
  // ── 1. Fetch player list ───────────────────────────────────────────────────
  // GET /api/players?search=&currentOnly=0|1
  useEffect(() => {
    const state = location.state;

    if (!state?.openPlayer) return;

    setSelectedPlayer({
      playerId: state.nbaPlayerId,
      fullName: state.playerName,
      teamId: 0,
      team: state.teamAbbr,
      teamName: '',
      fromYear: '',
      toYear: '',
      rosterStatus: 1,
    });
  }, [location.state]);

  useEffect(() => {
    const load = async () => {
      setLoadingPlayers(true);
      setErrorPlayers(null);
      try {
        const params = new URLSearchParams({
          currentOnly: activeOnly ? '1' : '0',
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        });
        const res = await fetch(`${API_BASE}/players?${params}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data: Player[] = await res.json();
        setPlayers(data);
      } catch (err) {
        setErrorPlayers('Could not load players.');
        console.error(err);
      } finally {
        setLoadingPlayers(false);
      }
    };
    load();
  }, [debouncedSearch, activeOnly]);

  // ── 2. Fetch career stats when a player is selected ────────────────────────
  // GET /api/players/:playerId/career
  useEffect(() => {
    if (!selectedPlayer) return;
    const load = async () => {
      setLoadingCareer(true);
      setErrorCareer(null);
      setCareerStats(null);
      setSort({ key: null, direction: null });
      try {
        const res = await fetch(
          `${API_BASE}/players/${selectedPlayer.playerId}/career`,
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const data: CareerStats = await res.json();
        setCareerStats(data);
      } catch (err) {
        setErrorCareer('Could not load career stats.');
        console.error(err);
      } finally {
        setLoadingCareer(false);
      }
    };
    load();
  }, [selectedPlayer]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const colors = selectedPlayer ? getColors(selectedPlayer.team) : null;

  // Most recent season for the stat highlights in the header
  const latestSeason = careerStats?.seasons?.length
    ? [...careerStats.seasons].sort((a, b) =>
        b.season.localeCompare(a.season),
      )[0]
    : null;

  const handleSelectPlayer = useCallback((player: Player) => {
    setSelectedPlayer(player);
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'desc' };
      if (prev.direction === 'desc') return { key, direction: 'asc' };
      return { key: null, direction: null }; // reset to chronological
    });
  }, []);

  const sortedSeasons = (() => {
    if (!careerStats?.seasons) return [];
    const base = [...careerStats.seasons].sort((a, b) =>
      b.season.localeCompare(a.season),
    );
    if (!sort.key || !sort.direction) return base;
    return [...base].sort((a, b) => {
      const aVal = a[sort.key!] ?? 0;
      const bVal = b[sort.key!] ?? 0;
      if (typeof aVal === 'string' && typeof bVal === 'string')
        return sort.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      const diff = (aVal as number) - (bVal as number);
      return sort.direction === 'asc' ? diff : -diff;
    });
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="players-page">
      {/* ── Sidebar ── */}
      <aside className="players-sidebar">
        <h2 className="players-sidebar-title">Players</h2>

        {/* Search */}
        <div className="players-search-wrap">
          <span className="players-search-icon">⌕</span>
          <input
            className="players-search-input"
            type="text"
            placeholder="Search players…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Active-only toggle */}
        <div className="players-toggle-row">
          <input
            id="active-toggle"
            type="checkbox"
            className="players-toggle"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          <label htmlFor="active-toggle" className="players-toggle-label">
            Active players only
          </label>
        </div>

        {/* Status */}
        {loadingPlayers && <p className="players-loading">Loading…</p>}
        {errorPlayers && <p className="players-error">{errorPlayers}</p>}

        {/* Count */}
        {!loadingPlayers && players.length > 0 && (
          <p className="players-count-badge">
            {players.length} player{players.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* List */}
        <div className="players-list" ref={listRef}>
          {players.map((player) => {
            const c = getColors(player.team);
            const isActive = selectedPlayer?.playerId === player.playerId;
            return (
              <button
                key={player.playerId}
                className={`players-list-item ${isActive ? 'active' : ''}`}
                style={
                  isActive
                    ? ({
                        background: `linear-gradient(135deg, ${c.primary}55, #1a1a1a)`,
                        '--active-color': c.secondary,
                      } as React.CSSProperties)
                    : {}
                }
                onClick={() => handleSelectPlayer(player)}
              >
                <img
                  src={getHeadshotUrl(player.playerId)}
                  alt={player.fullName}
                  className="players-list-avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://cdn.nba.com/headshots/nba/latest/1040x760/logoman.png';
                  }}
                />
                <div className="players-list-info">
                  <span className="players-list-name">{player.fullName}</span>
                  <span className="players-list-team">
                    {player.team || 'Free Agent'}
                  </span>
                </div>
              </button>
            );
          })}

          {!loadingPlayers && players.length === 0 && !errorPlayers && (
            <p className="players-placeholder">No players found.</p>
          )}
        </div>
      </aside>

      {/* ── Main Panel ── */}
      <main className="players-main">
        <div className="players-panel">
          {/* Empty state */}
          {!selectedPlayer && (
            <p className="players-placeholder">
              Select a player to view their career stats.
            </p>
          )}

          {selectedPlayer && colors && (
            <>
              {/* ── Player Header ── */}
              <div className="players-detail-header">
                <div className="players-headshot-wrap">
                  <div
                    className="players-headshot-glow"
                    style={{
                      background: `radial-gradient(circle at center, ${colors.primary}99, transparent)`,
                    }}
                  />
                  <img
                    src={getHeadshotUrl(selectedPlayer.playerId)}
                    alt={selectedPlayer.fullName}
                    className="players-headshot"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://cdn.nba.com/headshots/nba/latest/1040x760/logoman.png';
                    }}
                  />
                </div>

                <div className="players-detail-info">
                  <h1
                    className="players-detail-name"
                    style={{ color: colors.secondary }}
                  >
                    {selectedPlayer.fullName}
                  </h1>

                  <div className="players-detail-meta">
                    {selectedPlayer.team ? (
                      <span
                        className="players-team-pill"
                        style={{
                          background: `${colors.primary}33`,
                          borderColor: `${colors.primary}88`,
                          color: colors.secondary,
                        }}
                      >
                        {selectedPlayer.team}
                      </span>
                    ) : (
                      <span
                        className="players-team-pill"
                        style={{ borderColor: '#333' }}
                      >
                        Free Agent
                      </span>
                    )}
                    {selectedPlayer.teamName && (
                      <>
                        <span className="players-detail-meta-sep">·</span>
                        <span>{selectedPlayer.teamName}</span>
                      </>
                    )}
                    <span className="players-detail-meta-sep">·</span>
                    <span>
                      {selectedPlayer.fromYear}–{selectedPlayer.toYear}
                    </span>
                    {selectedPlayer.rosterStatus === 1 && (
                      <>
                        <span className="players-detail-meta-sep">·</span>
                        <span style={{ color: '#4ade80', fontSize: '0.75rem' }}>
                          ● Active
                        </span>
                      </>
                    )}
                  </div>

                  {/* Latest season highlight stats */}
                  {loadingCareer && (
                    <p className="players-loading">Loading stats…</p>
                  )}
                  {errorCareer && (
                    <p className="players-error">{errorCareer}</p>
                  )}

                  {latestSeason && (
                    <div className="players-highlights">
                      {[
                        { val: fmtStat(latestSeason.points), lbl: 'PPG' },
                        { val: fmtStat(latestSeason.rebounds), lbl: 'RPG' },
                        { val: fmtStat(latestSeason.assists), lbl: 'APG' },
                        { val: fmtStat(latestSeason.steals), lbl: 'SPG' },
                        { val: fmtStat(latestSeason.blocks), lbl: 'BPG' },
                        { val: fmtPct(latestSeason.fgPct), lbl: 'FG%' },
                      ].map(({ val, lbl }) => (
                        <div
                          key={lbl}
                          className="players-highlight-box"
                          style={
                            {
                              borderColor: `${colors.primary}55`,
                            } as React.CSSProperties
                          }
                        >
                          <span
                            className="players-highlight-val"
                            style={{ color: colors.secondary }}
                          >
                            {val}
                          </span>
                          <span className="players-highlight-lbl">{lbl}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <PlayerBio
                    playerId={selectedPlayer.playerId}
                    fullName={selectedPlayer.fullName}
                    team={selectedPlayer.team}
                  />

                  {!loadingCareer && !careerStats && !errorCareer && (
                    <p className="players-placeholder">No stats available.</p>
                  )}
                </div>
              </div>

              {careerStats && careerStats.seasons.length > 0 && (
                <section className="player-chart-section">
                  <div className="player-chart-header">
                    <h2>{selectedGraphLabel} Over Time</h2>

                    <select
                      className="player-chart-select"
                      value={selectedGraphStat}
                      onChange={(e) =>
                        setSelectedGraphStat(e.target.value as GraphStatKey)
                      }
                    >
                      {GRAPH_STAT_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="player-chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[...careerStats.seasons].sort((a, b) =>
                          a.season.localeCompare(b.season),
                        )}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="season" />
                        <YAxis />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey={selectedGraphStat}
                          strokeWidth={2}
                          dot
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
              {/* Divider */}
              <div
                className="players-divider"
                style={{ background: colors.secondary }}
              />

              {/* ── Career Stats Table ── */}
              {careerStats && careerStats.seasons.length > 0 && (
                <>
                  <p className="players-career-title">Career Stats</p>
                  <div className="players-career-table-wrap">
                    <table className="players-career-table">
                      <thead>
                        <tr>
                          {(
                            [
                              ['Season', 'season'],
                              ['Team', 'team'],
                              ['GP', 'gamesPlayed'],
                              ['GS', 'gamesStarted'],
                              ['MIN', 'minutes'],
                              ['PTS', 'points'],
                              ['REB', 'rebounds'],
                              ['AST', 'assists'],
                              ['STL', 'steals'],
                              ['BLK', 'blocks'],
                              ['TOV', 'turnovers'],
                              ['FG%', 'fgPct'],
                              ['3P%', 'fg3Pct'],
                              ['FT%', 'ftPct'],
                            ] as [string, SortKey][]
                          ).map(([label, key]) => {
                            const isActive = sort.key === key;
                            return (
                              <th
                                key={key}
                                onClick={() => handleSort(key)}
                                style={{
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  whiteSpace: 'nowrap',
                                  color: isActive
                                    ? colors.secondary
                                    : undefined,
                                  transition: 'color 0.15s',
                                }}
                              >
                                {label}
                                <SortIcon
                                  direction={sort.direction}
                                  active={isActive}
                                  color={colors.secondary}
                                />
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSeasons.map((s, i) => (
                          <tr
                            key={`${s.season}-${s.team}-${i}`}
                            className={
                              !sort.key && i === 0 ? 'highlight-row' : ''
                            }
                          >
                            <td className="season-col">{s.season}</td>
                            <td className="team-col">{s.team || '—'}</td>
                            <td>{fmtStat(s.gamesPlayed)}</td>
                            <td>{fmtStat(s.gamesStarted)}</td>
                            <td>{fmtStat(s.minutes)}</td>
                            <td
                              style={{
                                color: colors.secondary,
                                fontWeight: 700,
                              }}
                            >
                              {fmtStat(s.points)}
                            </td>
                            <td>{fmtStat(s.rebounds)}</td>
                            <td>{fmtStat(s.assists)}</td>
                            <td>{fmtStat(s.steals)}</td>
                            <td>{fmtStat(s.blocks)}</td>
                            <td>{fmtStat(s.turnovers)}</td>
                            <td className="players-pct-cell">
                              {fmtPct(s.fgPct)}
                            </td>
                            <td className="players-pct-cell">
                              {fmtPct(s.fg3Pct)}
                            </td>
                            <td className="players-pct-cell">
                              {fmtPct(s.ftPct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
