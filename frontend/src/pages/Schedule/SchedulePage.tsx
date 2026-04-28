import { useState, useEffect } from "react";
import "./SchedulePage.css";

interface Team {
  _id: string;
  name: string;
  city: string;
  abbreviation: string;
  logoUrl?: string;
}

interface TeamGameStats {
  _id: string;
  gameDate: string;
  opponentTeamId: Team;      
  points: number;
  oppPoints: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
}

// A game returned from the schedule/today endpoint
// NOTE: Your backend will need a Game or Schedule model for this.
// This shape is a suggested contract — update it to match whatever
// the NBA API returns once nbaApi.js is implemented.
interface TodayGame {
  _id: string;
  gameDate: string;
  startTime: string;         // e.g. "7:30 PM ET"
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number;
  awayScore?: number;
  status: "Upcoming" | "Live" | "Final";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE       = "http://localhost:3000/api";
const CURRENT_SEASON = "2024-25";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NBA_CDN_IDS: Record<string, string> = {
  LAL: "1610612747", GSW: "1610612744", BOS: "1610612738", CHI: "1610612741",
  MIA: "1610612748", NYK: "1610612752", LAC: "1610612746", PHX: "1610612756",
  DEN: "1610612743", MIL: "1610612749", DAL: "1610612742", PHI: "1610612755",
  BKN: "1610612751", TOR: "1610612761", ATL: "1610612737", CLE: "1610612739",
  IND: "1610612754", CHA: "1610612766", ORL: "1610612753", WAS: "1610612764",
  MEM: "1610612763", NOP: "1610612740", SAS: "1610612759", OKC: "1610612760",
  UTA: "1610612762", POR: "1610612757", SAC: "1610612758", MIN: "1610612750",
  HOU: "1610612745", DET: "1610612765",
};

function getLogoUrl(team: Team): string {
  if (team.logoUrl) return team.logoUrl;
  const id = NBA_CDN_IDS[team.abbreviation];
  return id ? `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg` : "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
  });
}

// Determine W/L from a TeamGameStats entry
function gameResult(game: TeamGameStats): { label: string; won: boolean } {
  const won = game.points > game.oppPoints;
  return {
    label: `${won ? "W" : "L"} ${game.points}-${game.oppPoints}`,
    won,
  };
}

// ─── Team accent colors (client-side only) ────────────────────────────────────

const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  LAL: { primary: "#552583", secondary: "#FDB927" },
  GSW: { primary: "#1D428A", secondary: "#FFC72C" },
  BOS: { primary: "#007A33", secondary: "#BA9653" },
  CHI: { primary: "#CE1141", secondary: "#FFFFFF" },
  MIA: { primary: "#98002E", secondary: "#F9A01B" },
  NYK: { primary: "#006BB6", secondary: "#F58426" },
  LAC: { primary: "#C8102E", secondary: "#1D428A" },
  PHX: { primary: "#1D1160", secondary: "#E56020" },
  DEN: { primary: "#0E2240", secondary: "#FEC524" },
  MIL: { primary: "#00471B", secondary: "#EEE1C6" },
  DAL: { primary: "#00538C", secondary: "#002B5E" },
  PHI: { primary: "#006BB6", secondary: "#ED174C" },
  BKN: { primary: "#444444", secondary: "#AAAAAA" },
  TOR: { primary: "#CE1141", secondary: "#000000" },
  ATL: { primary: "#E03A3E", secondary: "#C1D32F" },
  CLE: { primary: "#860038", secondary: "#FDBB30" },
  IND: { primary: "#002D62", secondary: "#FDBB30" },
  CHA: { primary: "#1D1160", secondary: "#00788C" },
  ORL: { primary: "#0077C0", secondary: "#C4CED4" },
  WAS: { primary: "#002B5C", secondary: "#E31837" },
  MEM: { primary: "#5D76A9", secondary: "#12173F"  },
  NOP: { primary: "#0C2340", secondary: "#C8A956" },
  SAS: { primary: "#444444", secondary: "#C4CED4" },
  OKC: { primary: "#007AC1", secondary: "#EF3B24" },
  UTA: { primary: "#002B5C", secondary: "#00471B" },
  POR: { primary: "#E03A3E", secondary: "#000000" },
  SAC: { primary: "#5A2D81", secondary: "#63727A" },
  MIN: { primary: "#0C2340", secondary: "#236192" },
  HOU: { primary: "#CE1141", secondary: "#000000" },
  DET: { primary: "#C8102E", secondary: "#1D428A" },
};

const getColors = (abbr: string) =>
  TEAM_COLORS[abbr] ?? { primary: "#333333", secondary: "#AAAAAA" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  // ── State ──────────────────────────────────────────────────────────────────

  const [favoriteTeams, setFavoriteTeams]   = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams]     = useState(true);
  const [errorTeams, setErrorTeams]         = useState<string | null>(null);

  const [selectedTeam, setSelectedTeam]     = useState<Team | null>(null);

  // Full season game log for the selected team (from TeamGameStats)
  const [teamSchedule, setTeamSchedule]     = useState<TeamGameStats[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [errorSchedule, setErrorSchedule]   = useState<string | null>(null);

  // All NBA games happening today
  // NOTE: requires a schedule/game endpoint backed by the NBA API.
  // Endpoint to implement: GET /api/schedule/today
  const [todaysGames, setTodaysGames]       = useState<TodayGame[]>([]);
  const [loadingToday, setLoadingToday]     = useState(true);
  const [errorToday, setErrorToday]         = useState<string | null>(null);

  const [selectedGame, setSelectedGame]     = useState<TodayGame | null>(null);

  // ── 1. Fetch favorite teams ────────────────────────────────────────────────
  // Endpoint to implement: GET /api/users/me/favorites/teams
  // Should return User.favoriteTeams populated with full Team documents.
  // TODO: add Authorization header once JWT auth is wired:
  //   headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
  useEffect(() => {
    const load = async () => {
      setLoadingTeams(true);
      setErrorTeams(null);
      try {
        const res = await fetch(`${API_BASE}/users/me/favorites/teams`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data: Team[] = await res.json();
        setFavoriteTeams(data);
      } catch (err) {
        setErrorTeams("Could not load favorite teams.");
        console.error(err);
      } finally {
        setLoadingTeams(false);
      }
    };
    load();
  }, []);

  // ── 2. Fetch today's games across all NBA teams ────────────────────────────
  // Endpoint to implement: GET /api/schedule/today
  // Should return all games scheduled for today's date, each with
  // homeTeam and awayTeam populated as Team documents.
  // This will be driven by the NBA API once nbaApi.js is implemented.
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
        setErrorToday("Today's games will appear once the schedule API is connected.");
        console.error(err);
      } finally {
        setLoadingToday(false);
      }
    };
    load();
  }, []);

  // ── 3. Fetch full season schedule when a team is selected ──────────────────
  // Endpoint to implement: GET /api/teams/:abbr/schedule?season=2024-25
  // Should return all TeamGameStats documents for the team in the given season,
  // sorted by gameDate ascending, with opponentTeamId populated as a Team doc.
  useEffect(() => {
    if (!selectedTeam) return;

    const load = async () => {
      setLoadingSchedule(true);
      setErrorSchedule(null);
      setTeamSchedule([]);
      try {
        const res = await fetch(
          `${API_BASE}/teams/${selectedTeam.abbreviation}/schedule?season=${CURRENT_SEASON}`
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const data: TeamGameStats[] = await res.json();
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

  // ── Render ─────────────────────────────────────────────────────────────────

  const colors = selectedTeam ? getColors(selectedTeam.abbreviation) : null;

  return (
    <div className="sched-page">

      {/* ── Left sidebar: favorite teams + their next game ── */}
      <aside className="sched-sidebar">
        <h2 className="sched-sidebar-title">Favorite Teams</h2>

        {loadingTeams && <p className="sched-loading">Loading…</p>}
        {errorTeams   && <p className="sched-error">{errorTeams}</p>}

        <div className="sched-team-list">
          {favoriteTeams.map((team) => {
            const c        = getColors(team.abbreviation);
            const isActive = selectedTeam?._id === team._id;
            return (
              <button
                key={team._id}
                className={`sched-team-item ${isActive ? "active" : ""}`}
                style={
                  isActive
                    ? {
                        background: `linear-gradient(135deg, ${c.primary}55, #1a1a1a)`,
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
                  {/* Next game date/opponent will be fetched from the schedule endpoint */}
                  {/* TODO: fetch GET /api/teams/:abbr/schedule?upcoming=true&limit=1 */}
                  <span className="sched-team-next">Next game loading soon</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="sched-main">
        <div className="sched-panel">

          {/* ── Today's games strip ── */}
          <section className="sched-today-section">
            <h3 className="sched-section-title">Today's Games</h3>

            {loadingToday && <p className="sched-loading">Loading…</p>}
            {errorToday   && <p className="sched-placeholder">{errorToday}</p>}

            {!loadingToday && todaysGames.length === 0 && !errorToday && (
              <p className="sched-placeholder">
                Today's games will appear once the schedule API is connected.
              </p>
            )}

            <div className="sched-today-list">
              {todaysGames.map((game) => {
                const isFav = favoriteTeams.some(
                  (t) =>
                    t._id === game.homeTeam._id ||
                    t._id === game.awayTeam._id
                );
                return (
                  <button
                    key={game._id}
                    className={[
                      "sched-today-card",
                      isFav              ? "fav-game" : "",
                      selectedGame?._id === game._id ? "active"    : "",
                    ].join(" ")}
                    onClick={() => setSelectedGame(game)}
                  >
                    <span className="sched-today-time">{game.startTime}</span>
                    <div className="sched-today-matchup">
                      <span>{game.awayTeam.abbreviation}</span>
                      <span className="sched-at">@</span>
                      <span>{game.homeTeam.abbreviation}</span>
                    </div>
                    <span
                      className={`sched-status ${game.status === "Live" ? "live" : ""}`}
                    >
                      {game.status === "Final" && game.homeScore !== undefined
                        ? `${game.awayScore}–${game.homeScore}`
                        : game.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="sched-divider" />

          {/* ── Full season schedule for selected team ── */}
          <section className="sched-full-section">
            {!selectedTeam && (
              <p className="sched-placeholder">
                Select a team from the left to view their full schedule.
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
                    <img
                      src={getLogoUrl(selectedTeam)}
                      alt={selectedTeam.abbreviation}
                      className="sched-logo-sm"
                    />
                  </div>
                  <h3 className="sched-full-title" style={{ color: colors.secondary }}>
                    {selectedTeam.city} {selectedTeam.name} — {CURRENT_SEASON} Schedule
                  </h3>
                </div>

                {loadingSchedule && <p className="sched-loading">Loading schedule…</p>}
                {errorSchedule   && <p className="sched-error">{errorSchedule}</p>}

                {!loadingSchedule && teamSchedule.length === 0 && !errorSchedule && (
                  <p className="sched-placeholder">
                    Schedule will appear once the API is connected.
                  </p>
                )}

                {teamSchedule.length > 0 && (
                  <div className="sched-table-wrap">
                    <table className="sched-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Opponent</th>
                          <th>Result</th>
                          <th>PTS</th>
                          <th>REB</th>
                          <th>AST</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamSchedule.map((game) => {
                          const { label, won } = gameResult(game);
                          const opp = game.opponentTeamId;
                          return (
                            <tr key={game._id}>
                              <td>{formatDate(game.gameDate)}</td>
                              <td>
                                <div className="sched-opp-cell">
                                  <img
                                    src={getLogoUrl(opp)}
                                    alt={opp.abbreviation}
                                    className="sched-opp-logo"
                                  />
                                  {opp.abbreviation}
                                </div>
                              </td>
                              <td>
                                <span className={won ? "win" : "loss"}>{label}</span>
                              </td>
                              <td>{game.points}</td>
                              <td>{game.rebounds}</td>
                              <td>{game.assists}</td>
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
