import { useState, useEffect } from "react";
import "./SchedulePage.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
  _id: string;
  name: string;
  city: string;
  abbreviation: string;
  logoUrl?: string;
}

// Shape returned by GET /api/schedule/today
interface TodayGame {
  _id: string;
  gameDate: string;
  startTime: string;       // "7:30 pm ET" | "Q3 4:22" | "Final"
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  status: "Upcoming" | "Live" | "Final";
}

// Shape returned by GET /api/schedule?team=LAL
interface TeamGame {
  _id: string;
  gameDate: string;
  opponentTeamId: Team;
  isHome: boolean;
  wl: "W" | "L";
  points: number;
  oppPoints: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  plusMinus: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE       = import.meta.env.VITE_API_BASE;
const CURRENT_SEASON = "2024-25";

// All 30 teams for the fallback picker when favorites aren't set up yet
const ALL_TEAMS = [
  "ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW",
  "HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK",
  "OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NBA_CDN_IDS: Record<string, string> = {
  LAL:"1610612747", GSW:"1610612744", BOS:"1610612738", CHI:"1610612741",
  MIA:"1610612748", NYK:"1610612752", LAC:"1610612746", PHX:"1610612756",
  DEN:"1610612743", MIL:"1610612749", DAL:"1610612742", PHI:"1610612755",
  BKN:"1610612751", TOR:"1610612761", ATL:"1610612737", CLE:"1610612739",
  IND:"1610612754", CHA:"1610612766", ORL:"1610612753", WAS:"1610612764",
  MEM:"1610612763", NOP:"1610612740", SAS:"1610612759", OKC:"1610612760",
  UTA:"1610612762", POR:"1610612757", SAC:"1610612758", MIN:"1610612750",
  HOU:"1610612745", DET:"1610612765",
};

function getLogoUrl(team: Team): string {
  if (team.logoUrl) return team.logoUrl;
  const id = NBA_CDN_IDS[team.abbreviation];
  return id ? `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg` : "";
}

function formatDate(raw: string): string {
  // teamgamelog returns "MMM DD, YYYY" e.g. "APR 01, 2025"
  // scoreboardv2 returns ISO-like "2025-04-01T00:00:00"
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  LAL:{ primary:"#552583", secondary:"#FDB927" },
  GSW:{ primary:"#1D428A", secondary:"#FFC72C" },
  BOS:{ primary:"#007A33", secondary:"#BA9653" },
  CHI:{ primary:"#CE1141", secondary:"#FFFFFF" },
  MIA:{ primary:"#98002E", secondary:"#F9A01B" },
  NYK:{ primary:"#006BB6", secondary:"#F58426" },
  LAC:{ primary:"#C8102E", secondary:"#1D428A" },
  PHX:{ primary:"#1D1160", secondary:"#E56020" },
  DEN:{ primary:"#0E2240", secondary:"#FEC524" },
  MIL:{ primary:"#00471B", secondary:"#EEE1C6" },
  DAL:{ primary:"#00538C", secondary:"#002B5E" },
  PHI:{ primary:"#006BB6", secondary:"#ED174C" },
  BKN:{ primary:"#444444", secondary:"#AAAAAA" },
  TOR:{ primary:"#CE1141", secondary:"#FF6B35" },
  ATL:{ primary:"#E03A3E", secondary:"#C1D32F" },
  CLE:{ primary:"#860038", secondary:"#FDBB30" },
  IND:{ primary:"#002D62", secondary:"#FDBB30" },
  CHA:{ primary:"#1D1160", secondary:"#00788C" },
  ORL:{ primary:"#0077C0", secondary:"#C4CED4" },
  WAS:{ primary:"#002B5C", secondary:"#E31837" },
  MEM:{ primary:"#5D76A9", secondary:"#12173F"  },
  NOP:{ primary:"#0C2340", secondary:"#C8A956" },
  SAS:{ primary:"#444444", secondary:"#C4CED4" },
  OKC:{ primary:"#007AC1", secondary:"#EF3B24" },
  UTA:{ primary:"#002B5C", secondary:"#00471B" },
  POR:{ primary:"#E03A3E", secondary:"#000000" },
  SAC:{ primary:"#5A2D81", secondary:"#63727A" },
  MIN:{ primary:"#0C2340", secondary:"#236192" },
  HOU:{ primary:"#CE1141", secondary:"#C4CED4" },
  DET:{ primary:"#C8102E", secondary:"#1D428A" },
};

const getColors = (abbr: string) =>
  TEAM_COLORS[abbr] ?? { primary: "#333333", secondary: "#888888" };

// Build a minimal Team object from just an abbreviation (for the picker)
function teamFromAbbr(abbr: string): Team {
  return { _id: abbr, abbreviation: abbr, name: "", city: "" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SchedulePage() {

  // ── Favorite teams sidebar ─────────────────────────────────────────────────
  const [favoriteTeams, setFavoriteTeams] = useState<Team[]>([]);
  const [loadingFavs, setLoadingFavs]     = useState(true);
  const [favoritesAvail, setFavoritesAvail] = useState(true);

  // ── Today's games ──────────────────────────────────────────────────────────
  const [todaysGames, setTodaysGames]     = useState<TodayGame[]>([]);
  const [loadingToday, setLoadingToday]   = useState(true);
  const [errorToday, setErrorToday]       = useState<string | null>(null);
  const [selectedGame, setSelectedGame]   = useState<TodayGame | null>(null);

  // ── Team schedule ──────────────────────────────────────────────────────────
  // selectedTeam can come from the favorites sidebar OR the fallback picker
  const [selectedTeam, setSelectedTeam]         = useState<Team | null>(null);
  const [teamSchedule, setTeamSchedule]         = useState<TeamGame[]>([]);
  const [loadingSchedule, setLoadingSchedule]   = useState(false);
  const [errorSchedule, setErrorSchedule]       = useState<string | null>(null);

  // ── 1. Fetch favorite teams ────────────────────────────────────────────────
  // GET /api/users/me/favorites/teams
  // If this endpoint isn't ready yet (no auth), we gracefully fall back to
  // showing a team picker dropdown in the sidebar instead.
  useEffect(() => {
    const load = async () => {
      setLoadingFavs(true);
      try {
        const res = await fetch(`${API_BASE}/users/me/favorites/teams`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data: Team[] = await res.json();
        setFavoriteTeams(data);
      } catch {
        // Favorites endpoint not ready — show picker fallback
        setFavoritesAvail(false);
      } finally {
        setLoadingFavs(false);
      }
    };
    load();
  }, []);

  // ── 2. Fetch today's games ─────────────────────────────────────────────────
  // GET /api/schedule/today
  useEffect(() => {
    const load = async () => {
      setLoadingToday(true);
      setErrorToday(null);
      try {
        const res = await fetch(`${API_BASE}/schedule/today`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data: TodayGame[] = await res.json();
        setTodaysGames(data);
      } catch (err) {
        setErrorToday("Could not load today's games.");
        console.error(err);
      } finally {
        setLoadingToday(false);
      }
    };
    load();
  }, []);

  // ── 3. Fetch team schedule when a team is selected ─────────────────────────
  // GET /api/schedule?team=LAL&season=2024-25
  useEffect(() => {
    if (!selectedTeam) return;
    const load = async () => {
      setLoadingSchedule(true);
      setErrorSchedule(null);
      setTeamSchedule([]);
      try {
        const params = new URLSearchParams({
          team:   selectedTeam.abbreviation,
          season: CURRENT_SEASON,
        });
        const res = await fetch(`${API_BASE}/schedule?${params}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data: TeamGame[] = await res.json();
        setTeamSchedule(data);
      } catch (err) {
        setErrorSchedule("Could not load team schedule.");
        console.error(err);
      } finally {
        setLoadingSchedule(false);
      }
    };
    load();
  }, [selectedTeam]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const colors = selectedTeam ? getColors(selectedTeam.abbreviation) : null;

  const favTeamIds = new Set(favoriteTeams.map(t => t._id));

  // Record counts for the schedule table summary
  const wins   = teamSchedule.filter(g => g.wl === "W").length;
  const losses = teamSchedule.filter(g => g.wl === "L").length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="sched-page">

      {/* ── Sidebar ── */}
      <aside className="sched-sidebar">
        <h2 className="sched-sidebar-title">
          {favoritesAvail ? "Favorite Teams" : "Select Team"}
        </h2>

        {/* Favorites list */}
        {favoritesAvail && (
          <>
            {loadingFavs && <p className="sched-loading">Loading…</p>}

            <div className="sched-team-list">
              {favoriteTeams.map((team) => {
                const c        = getColors(team.abbreviation);
                const isActive = selectedTeam?.abbreviation === team.abbreviation;
                return (
                  <button
                    key={team._id}
                    className={`sched-team-item ${isActive ? "active" : ""}`}
                    style={
                      isActive
                        ? {
                            background:  `linear-gradient(135deg, ${c.primary}55, #1a1a1a)`,
                            borderColor: c.secondary,
                          }
                        : {}
                    }
                    onClick={() => { setSelectedTeam(team); setSelectedGame(null); }}
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
                      <span className="sched-team-abbr">{team.abbreviation}</span>
                      <span className="sched-team-next">
                        {team.city} {team.name}
                      </span>
                    </div>
                  </button>
                );
              })}

              {!loadingFavs && favoriteTeams.length === 0 && (
                <p className="sched-placeholder">No favorite teams added yet.</p>
              )}
            </div>
          </>
        )}

        {/* Fallback: favorites endpoint not available yet — show a picker */}
        {!favoritesAvail && (
          <div className="sched-team-picker-wrap">
            <label className="sched-team-picker-label">
              Choose any team to view their schedule
            </label>
            <select
              className="sched-team-picker"
              value={selectedTeam?.abbreviation ?? ""}
              onChange={(e) => {
                const abbr = e.target.value;
                if (abbr) setSelectedTeam(teamFromAbbr(abbr));
              }}
            >
              <option value="">— pick a team —</option>
              {ALL_TEAMS.map(abbr => (
                <option key={abbr} value={abbr}>{abbr}</option>
              ))}
            </select>
          </div>
        )}
      </aside>

      {/* ── Main Panel ── */}
      <main className="sched-main">
        <div className="sched-panel">

          {/* ── Today's Games strip ── */}
          <section className="sched-today-section">
            <h3 className="sched-section-title">Today's Games</h3>

            {loadingToday && <p className="sched-loading">Loading…</p>}
            {errorToday   && <p className="sched-error">{errorToday}</p>}

            {!loadingToday && !errorToday && todaysGames.length === 0 && (
              <p className="sched-placeholder">No games scheduled for today.</p>
            )}

            <div className="sched-today-list">
              {todaysGames.map((game) => {
                const isFav  = favTeamIds.has(game.homeTeam._id) ||
                               favTeamIds.has(game.awayTeam._id);
                const isActive = selectedGame?._id === game._id;

                // Score display for live / final games
                const scoreLabel =
                  game.status !== "Upcoming" &&
                  game.homeScore !== null &&
                  game.awayScore !== null
                    ? `${game.awayScore}–${game.homeScore}`
                    : null;

                return (
                  <button
                    key={game._id}
                    className={[
                      "sched-today-card",
                      isFav    ? "fav-game" : "",
                      isActive ? "active"   : "",
                    ].join(" ")}
                    onClick={() => setSelectedGame(isActive ? null : game)}
                  >
                    <span className="sched-today-time">
                      {/* Show the raw status text (time, quarter, or "Final") */}
                      {game.startTime}
                    </span>
                    <div className="sched-today-matchup">
                      <span>{game.awayTeam.abbreviation}</span>
                      <span className="sched-at">@</span>
                      <span>{game.homeTeam.abbreviation}</span>
                    </div>
                    {scoreLabel ? (
                      <span className="sched-score">{scoreLabel}</span>
                    ) : (
                      <span className={`sched-status ${game.status === "Live" ? "live" : ""}`}>
                        {game.status === "Live" ? "● LIVE" : game.status}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="sched-divider" />

          {/* ── Full team schedule ── */}
          <section className="sched-full-section">

            {!selectedTeam && (
              <p className="sched-placeholder">
                Select a team from the left to view their {CURRENT_SEASON} schedule.
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
                    {/* Only show logo if we have a CDN ID for this team */}
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
                        : selectedTeam.abbreviation}{" "}
                      — {CURRENT_SEASON}
                    </h3>
                    {teamSchedule.length > 0 && (
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>
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

                {!loadingSchedule && teamSchedule.length === 0 && !errorSchedule && (
                  <p className="sched-placeholder">No games found for this season.</p>
                )}

                {teamSchedule.length > 0 && (
                  <div className="sched-table-wrap">
                    <table className="sched-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Opponent</th>
                          <th>Result</th>
                          <th>Score</th>
                          <th>REB</th>
                          <th>AST</th>
                          <th>STL</th>
                          <th>BLK</th>
                          <th>+/-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamSchedule.map((game) => {
                          const opp = game.opponentTeamId;
                          const won = game.wl === "W";
                          return (
                            <tr key={game._id}>
                              <td className="sched-date-col">
                                {formatDate(game.gameDate)}
                              </td>
                              <td>
                                <div className="sched-opp-cell">
                                  <span className="sched-ha-badge">
                                    {game.isHome ? "vs" : "@"}
                                  </span>
                                  <img
                                    src={getLogoUrl(opp)}
                                    alt={opp.abbreviation}
                                    className="sched-opp-logo"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                  <span className="sched-opp-abbr">
                                    {opp.abbreviation}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className={`sched-result ${won ? "win" : "loss"}`}>
                                  {game.wl}
                                </span>
                              </td>
                              <td className="sched-score">
                                <span style={{ color: won ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                                  {game.points}
                                </span>
                                <span style={{ color: "#444" }}> – </span>
                                <span>{game.oppPoints}</span>
                              </td>
                              <td>{game.rebounds}</td>
                              <td>{game.assists}</td>
                              <td>{game.steals}</td>
                              <td>{game.blocks}</td>
                              <td
                                style={{
                                  color:      game.plusMinus > 0 ? "#4ade80"
                                            : game.plusMinus < 0 ? "#f87171"
                                            : "#666",
                                  fontWeight: 600,
                                }}
                              >
                                {game.plusMinus > 0 ? `+${game.plusMinus}` : game.plusMinus}
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