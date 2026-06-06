import { useState, useEffect } from 'react';
import './SchedulePage.css';

interface Team {
  _id: string;
  name: string;
  city: string;
  abbreviation: string;
  logoUrl?: string;
}

interface TodayGame {
  _id: string;
  gameDate: string;
  startTime: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  status: 'Upcoming' | 'Live' | 'Final';
}

interface TeamGame {
  _id: string;
  gameDate: string;
  opponentTeamId: Team;
  isHome: boolean;
  wl: 'W' | 'L';
  points: number | null;
  oppPoints: number | null;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  plusMinus: number | null;
}

type SortDirection = 'asc' | 'desc' | null;
type SortKey = keyof TeamGame;

interface SortState {
  key: SortKey | null;
  direction: SortDirection;
}

const API_BASE = import.meta.env.VITE_API_BASE;

const ALL_TEAMS = [
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
];

const NBA_CDN_IDS: Record<string, string> = {
  LAL: '1610612747',
  GSW: '1610612744',
  BOS: '1610612738',
  CHI: '1610612741',
  MIA: '1610612748',
  NYK: '1610612752',
  LAC: '1610612746',
  PHX: '1610612756',
  DEN: '1610612743',
  MIL: '1610612749',
  DAL: '1610612742',
  PHI: '1610612755',
  BKN: '1610612751',
  TOR: '1610612761',
  ATL: '1610612737',
  CLE: '1610612739',
  IND: '1610612754',
  CHA: '1610612766',
  ORL: '1610612753',
  WAS: '1610612764',
  MEM: '1610612763',
  NOP: '1610612740',
  SAS: '1610612759',
  OKC: '1610612760',
  UTA: '1610612762',
  POR: '1610612757',
  SAC: '1610612758',
  MIN: '1610612750',
  HOU: '1610612745',
  DET: '1610612765',
};

function getLogoUrl(team: Team): string {
  if (team.logoUrl) return team.logoUrl;
  const id = NBA_CDN_IDS[team.abbreviation];
  return id ? `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg` : '';
}

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function deriveCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 10 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

function normalizeSeason(raw: string): string {
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{4})-(\d{4})$/);
  if (m) return `${m[1]}-${m[2].slice(2)}`;
  return raw;
}

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

function teamFromAbbr(abbr: string): Team {
  return { _id: abbr, abbreviation: abbr, name: '', city: '' };
}

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

export default function SchedulePage() {
  const [currentSeason, setCurrentSeason] =
    useState<string>(deriveCurrentSeason);
  const [favoriteTeams, setFavoriteTeams] = useState<Team[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(true);
  const [favoritesAvail, setFavoritesAvail] = useState(true);
  const [todaysGames, setTodaysGames] = useState<TodayGame[]>([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [errorToday, setErrorToday] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<TodayGame | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamSchedule, setTeamSchedule] = useState<TeamGame[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [errorSchedule, setErrorSchedule] = useState<string | null>(null);
  const [selectedScheduleGame, setSelectedScheduleGame] =
    useState<TeamGame | null>(null);
  const [sort, setSort] = useState<SortState>({ key: null, direction: null });

  useEffect(() => {
    fetch(`${API_BASE}/schedule/season/current`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (data?.season) {
          setCurrentSeason(normalizeSeason(String(data.season)));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoadingFavs(true);
      try {
        const r = await fetch(`${API_BASE}/users/me/favorites/teams`);
        if (!r.ok) throw new Error();
        const data: Team[] = await r.json();
        setFavoriteTeams(data);
      } catch {
        setFavoritesAvail(false);
      } finally {
        setLoadingFavs(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoadingToday(true);
      setErrorToday(null);
      try {
        const r = await fetch(`${API_BASE}/schedule/today`);
        if (!r.ok) throw new Error();
        const data: TodayGame[] = await r.json();
        setTodaysGames(data);
      } catch {
        setErrorToday("Could not load today's games.");
      } finally {
        setLoadingToday(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    const params = new URLSearchParams({
      team: selectedTeam.abbreviation,
      season: currentSeason,
    });
    const load = async () => {
      setLoadingSchedule(true);
      setErrorSchedule(null);
      setTeamSchedule([]);
      try {
        const r = await fetch(`${API_BASE}/schedule?${params}`);
        if (!r.ok) throw new Error();
        const data: TeamGame[] = await r.json();
        setTeamSchedule(data);
      } catch {
        setErrorSchedule('Could not load team schedule.');
      } finally {
        setLoadingSchedule(false);
      }
    };
    void load();
  }, [selectedTeam, currentSeason]);

  const colors = selectedTeam ? getColors(selectedTeam.abbreviation) : null;
  const favTeamIds = new Set(favoriteTeams.map((t) => t._id));
  const wins = teamSchedule.filter((g) => g.wl === 'W').length;
  const losses = teamSchedule.filter((g) => g.wl === 'L').length;

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'desc' };
      if (prev.direction === 'desc') return { key, direction: 'asc' };
      return { key: null, direction: null };
    });
  };

  const sortedSchedule = (() => {
    if (!sort.key || !sort.direction) return teamSchedule;
    return [...teamSchedule].sort((a, b) => {
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

  return (
    <div className="sched-page">
      <aside className="sched-sidebar">
        <h2 className="sched-sidebar-title">
          {favoritesAvail ? 'Favorite Teams' : 'Select Team'}
        </h2>

        {selectedScheduleGame && (
          <div
            style={{
              background: '#151515',
              border: '1px solid #2a2a2a',
              borderRadius: '16px',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '0.9rem',
              }}
            >
              <img
                src={getLogoUrl(selectedScheduleGame.opponentTeamId)}
                alt={selectedScheduleGame.opponentTeamId.abbreviation}
                style={{ width: 28, height: 28, objectFit: 'contain' }}
              />
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  {selectedScheduleGame.isHome ? 'vs' : '@'}{' '}
                  {selectedScheduleGame.opponentTeamId.abbreviation}
                </div>
                <div style={{ color: '#666', fontSize: '0.72rem' }}>
                  {formatDate(selectedScheduleGame.gameDate)}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.55rem',
                fontSize: '0.8rem',
              }}
            >
              <div>
                <span style={{ color: '#666' }}>Result:</span>{' '}
                <span
                  className={`sched-result ${selectedScheduleGame.wl === 'W' ? 'win' : 'loss'}`}
                >
                  {selectedScheduleGame.wl}
                </span>
              </div>
              <div>
                <span style={{ color: '#666' }}>Score:</span>{' '}
                <span>
                  {selectedScheduleGame.points ?? '—'} -{' '}
                  {selectedScheduleGame.oppPoints ?? '—'}
                </span>
              </div>
              <div>
                <span style={{ color: '#666' }}>REB:</span>{' '}
                {selectedScheduleGame.rebounds}
              </div>
              <div>
                <span style={{ color: '#666' }}>AST:</span>{' '}
                {selectedScheduleGame.assists}
              </div>
              <div>
                <span style={{ color: '#666' }}>STL:</span>{' '}
                {selectedScheduleGame.steals}
              </div>
              <div>
                <span style={{ color: '#666' }}>BLK:</span>{' '}
                {selectedScheduleGame.blocks}
              </div>
              <div>
                <span style={{ color: '#666' }}>+/-:</span>{' '}
                <span
                  style={{
                    color:
                      (selectedScheduleGame.plusMinus ?? 0) > 0
                        ? '#4ade80'
                        : (selectedScheduleGame.plusMinus ?? 0) < 0
                          ? '#f87171'
                          : '#aaa',
                    fontWeight: 700,
                  }}
                >
                  {selectedScheduleGame.plusMinus != null
                    ? selectedScheduleGame.plusMinus > 0
                      ? `+${selectedScheduleGame.plusMinus}`
                      : selectedScheduleGame.plusMinus
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {favoritesAvail && (
          <>
            {loadingFavs && <p className="sched-loading">Loading…</p>}
            <div className="sched-team-list">
              {favoriteTeams.map((team) => {
                const c = getColors(team.abbreviation);
                const isActive =
                  selectedTeam?.abbreviation === team.abbreviation;
                return (
                  <button
                    key={team._id}
                    className={`sched-team-item ${isActive ? 'active' : ''}`}
                    style={
                      isActive
                        ? {
                            background: `linear-gradient(135deg, ${c.primary}55, #1a1a1a)`,
                            borderColor: c.secondary,
                          }
                        : {}
                    }
                    onClick={() => {
                      setSelectedTeam(team);
                      setSelectedGame(null);
                      setSelectedScheduleGame(null);
                      setSort({ key: null, direction: null });
                    }}
                  >
                    <div
                      className="sched-team-logo-wrap"
                      style={{
                        background: `radial-gradient(circle at center, ${c.primary}88, transparent)`,
                      }}
                    >
                      <img
                        src={getLogoUrl(team)}
                        alt={team.abbreviation}
                        className="sched-team-logo"
                      />
                    </div>
                    <div className="sched-team-text">
                      <span className="sched-team-abbr">
                        {team.abbreviation}
                      </span>
                      <span className="sched-team-next">
                        {team.city} {team.name}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!loadingFavs && favoriteTeams.length === 0 && (
                <p className="sched-placeholder">
                  No favorite teams added yet.
                </p>
              )}
            </div>
          </>
        )}

        {!favoritesAvail && (
          <div className="sched-team-picker-wrap">
            <label className="sched-team-picker-label">
              Choose any team to view their schedule
            </label>
            <select
              className="sched-team-picker"
              value={selectedTeam?.abbreviation ?? ''}
              onChange={(e) => {
                const a = e.target.value;
                if (a) {
                  setSelectedTeam(teamFromAbbr(a));
                  setSelectedScheduleGame(null);
                  setSort({ key: null, direction: null });
                }
              }}
            >
              <option value="">— pick a team —</option>
              {ALL_TEAMS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}
      </aside>

      <main className="sched-main">
        <div className="sched-panel">
          <section className="sched-today-section">
            <h3 className="sched-section-title">Today's Games</h3>
            {loadingToday && <p className="sched-loading">Loading…</p>}
            {errorToday && <p className="sched-error">{errorToday}</p>}
            {!loadingToday && !errorToday && todaysGames.length === 0 && (
              <p className="sched-placeholder">No games scheduled for today.</p>
            )}
            <div className="sched-today-list">
              {todaysGames.map((game) => {
                const isFav =
                  favTeamIds.has(game.homeTeam._id) ||
                  favTeamIds.has(game.awayTeam._id);
                const isActive = selectedGame?._id === game._id;
                const scoreLabel =
                  game.status !== 'Upcoming' &&
                  game.homeScore !== null &&
                  game.awayScore !== null
                    ? `${game.awayScore}–${game.homeScore}`
                    : null;
                return (
                  <button
                    key={game._id}
                    className={[
                      'sched-today-card',
                      isFav ? 'fav-game' : '',
                      isActive ? 'active' : '',
                    ].join(' ')}
                    onClick={() => setSelectedGame(isActive ? null : game)}
                  >
                    <span className="sched-today-time">{game.startTime}</span>
                    <div className="sched-today-matchup">
                      <span>{game.awayTeam.abbreviation}</span>
                      <span className="sched-at">@</span>
                      <span>{game.homeTeam.abbreviation}</span>
                    </div>
                    {scoreLabel ? (
                      <span className="sched-score">{scoreLabel}</span>
                    ) : (
                      <span
                        className={`sched-status ${game.status === 'Live' ? 'live' : ''}`}
                      >
                        {game.status === 'Live' ? '● LIVE' : game.status}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="sched-divider" />

          <section className="sched-full-section">
            {!selectedTeam && (
              <p className="sched-placeholder">
                Select a team from the left to view their {currentSeason}{' '}
                schedule.
              </p>
            )}

            {selectedTeam && colors && (
              <>
                <div className="sched-full-header">
                  <div
                    className="sched-logo-sm-wrap"
                    style={{
                      background: `radial-gradient(circle at center, ${colors.primary}88, transparent)`,
                    }}
                  >
                    {NBA_CDN_IDS[selectedTeam.abbreviation] && (
                      <img
                        src={getLogoUrl(selectedTeam)}
                        alt={selectedTeam.abbreviation}
                        className="sched-logo-sm"
                      />
                    )}
                  </div>
                  <div>
                    <h3
                      className="sched-full-title"
                      style={{ color: colors.secondary }}
                    >
                      {selectedTeam.city
                        ? `${selectedTeam.city} ${selectedTeam.name}`
                        : selectedTeam.abbreviation}{' '}
                      — {currentSeason}
                    </h3>
                    {teamSchedule.length > 0 && (
                      <p
                        style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}
                      >
                        {wins}–{losses} ({teamSchedule.length} games)
                      </p>
                    )}
                  </div>
                </div>

                {loadingSchedule && (
                  <p className="sched-loading">Loading schedule…</p>
                )}
                {errorSchedule && (
                  <p className="sched-error">{errorSchedule}</p>
                )}
                {!loadingSchedule &&
                  teamSchedule.length === 0 &&
                  !errorSchedule && (
                    <p className="sched-placeholder">
                      No games found for this season.
                    </p>
                  )}

                {teamSchedule.length > 0 && (
                  <div className="sched-table-wrap">
                    <table className="sched-table">
                      <thead>
                        <tr>
                          {(
                            [
                              ['Date', 'gameDate'],
                              ['Opponent', 'opponentTeamId'],
                              ['Result', 'wl'],
                              ['Score', 'points'],
                              ['REB', 'rebounds'],
                              ['AST', 'assists'],
                              ['STL', 'steals'],
                              ['BLK', 'blocks'],
                              ['+/-', 'plusMinus'],
                            ] as [string, SortKey][]
                          ).map(([label, key]) => {
                            const isActive = sort.key === key;
                            const accentColor = colors?.secondary ?? '#ffffff';
                            return (
                              <th
                                key={key}
                                onClick={() => handleSort(key)}
                                style={{
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  color: isActive ? accentColor : undefined,
                                  transition: 'color 0.15s',
                                }}
                              >
                                {label}
                                <SortIcon
                                  direction={sort.direction}
                                  active={isActive}
                                  color={accentColor}
                                />
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSchedule.map((game) => {
                          const opp = game.opponentTeamId;
                          const won = game.wl === 'W';
                          return (
                            <tr
                              key={game._id}
                              onClick={() => setSelectedScheduleGame(game)}
                              style={{
                                cursor: 'pointer',
                                background:
                                  selectedScheduleGame?._id === game._id
                                    ? '#1e1e2e'
                                    : undefined,
                              }}
                            >
                              <td className="sched-date-col">
                                {formatDate(game.gameDate)}
                              </td>
                              <td>
                                <div className="sched-opp-cell">
                                  <span className="sched-ha-badge">
                                    {game.isHome ? 'vs' : '@'}
                                  </span>
                                  <img
                                    src={getLogoUrl(opp)}
                                    alt={opp.abbreviation}
                                    className="sched-opp-logo"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = 'none';
                                    }}
                                  />
                                  <span className="sched-opp-abbr">
                                    {opp.abbreviation}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`sched-result ${won ? 'win' : 'loss'}`}
                                >
                                  {game.wl}
                                </span>
                              </td>
                              <td className="sched-score">
                                <span
                                  style={{
                                    color: won ? '#4ade80' : '#f87171',
                                    fontWeight: 700,
                                  }}
                                >
                                  {game.points ?? '—'}
                                </span>
                                <span style={{ color: '#444' }}> – </span>
                                <span>
                                  {game.oppPoints != null
                                    ? game.oppPoints
                                    : '—'}
                                </span>
                              </td>
                              <td>{game.rebounds}</td>
                              <td>{game.assists}</td>
                              <td>{game.steals}</td>
                              <td>{game.blocks}</td>
                              <td
                                style={{
                                  color:
                                    (game.plusMinus ?? 0) > 0
                                      ? '#4ade80'
                                      : (game.plusMinus ?? 0) < 0
                                        ? '#f87171'
                                        : '#666',
                                  fontWeight: 600,
                                }}
                              >
                                {game.plusMinus != null
                                  ? game.plusMinus > 0
                                    ? `+${game.plusMinus}`
                                    : game.plusMinus
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
