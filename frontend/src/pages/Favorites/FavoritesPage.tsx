import { useState, useEffect } from "react";
import "./FavoritesPage.css";

// ─── Types (mirror your Mongoose models) ─────────────────────────────────────

interface Team {
  _id: string;
  name: string;
  city: string;
  abbreviation: string;
  conference: string;
  division: string;
  logoUrl?: string;
}

interface Player {
  _id: string;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  imageUrl?: string;
  height?: string;
  weight?: number;
  country?: string;
}

interface TeamSeasonStats {
  wins: number;
  losses: number;
  gamesPlayed: number;
  totalPoints: number;
  totalRebounds: number;
  totalAssists: number;
  totalSteals: number;
  totalBlocks: number;
  totalTurnovers: number;
}

interface PlayerSeasonStats {
  gamesPlayed: number;
  totalPoints: number;
  totalAssists: number;
  totalRebounds: number;
  totalSteals: number;
  totalBlocks: number;
  totalTurnovers: number;
  totalMinutes: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Update this if your Express server runs on a different port
const API_BASE = import.meta.env.VITE_API_BASE;

// Current NBA season — update each year
const CURRENT_SEASON = "2024-25";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Maps abbreviation → NBA CDN team ID so logos work before logoUrl is in the DB
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

// Falls back to a silhouette until imageUrl is stored in Player documents
function getHeadshotUrl(player: Player): string {
  if (player.imageUrl) return player.imageUrl;
  return "https://cdn.nba.com/headshots/nba/latest/1040x760/logoman.png";
}

// Per-game averages derived from season totals (matches your PlayerSeasonStats schema)
const avg = (total: number, gp: number): string =>
  gp ? (total / gp).toFixed(1) : "—";

const winPct = (stats: TeamSeasonStats): string => {
  const total = stats.wins + stats.losses;
  return total ? (stats.wins / total).toFixed(3).replace(/^0/, "") : "—";
};

// ─── Team accent colors (purely client-side, no backend required) ─────────────

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
  MEM: { primary: "#5D76A9", secondary: "#12173F" },
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

export default function FavoritesPage() {
  // ── State ──────────────────────────────────────────────────────────────────

  const [favoriteTeams, setFavoriteTeams]   = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams]     = useState(true);
  const [errorTeams, setErrorTeams]         = useState<string | null>(null);

  const [selectedTeam, setSelectedTeam]     = useState<Team | null>(null);

  const [teamStats, setTeamStats]           = useState<TeamSeasonStats | null>(null);
  const [loadingStats, setLoadingStats]     = useState(false);
  const [errorStats, setErrorStats]         = useState<string | null>(null);

  const [roster, setRoster]                 = useState<Player[]>([]);
  const [loadingRoster, setLoadingRoster]   = useState(false);
  const [errorRoster, setErrorRoster]       = useState<string | null>(null);

  const [selectedPlayer, setSelectedPlayer]       = useState<Player | null>(null);
  const [playerStats, setPlayerStats]             = useState<PlayerSeasonStats | null>(null);
  const [loadingPlayerStats, setLoadingPlayerStats] = useState(false);
  const [errorPlayerStats, setErrorPlayerStats]   = useState<string | null>(null);

  // ── 1. Fetch the logged-in user's favorite teams ───────────────────────────
  // Endpoint to implement: GET /api/users/me/favorites/teams
  // Should return User.favoriteTeams populated with full Team documents.
  // TODO: add Authorization header once JWT auth is wired up:
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
        if (data.length > 0) setSelectedTeam(data[0]);
      } catch (err) {
        setErrorTeams("Could not load favorite teams.");
        console.error(err);
      } finally {
        setLoadingTeams(false);
      }
    };
    load();
  }, []);

  // ── 2. Fetch stats + roster when the selected team changes ─────────────────
  useEffect(() => {
    if (!selectedTeam) return;
    const { abbreviation } = selectedTeam;

    // Endpoint to implement: GET /api/teams/:abbr/season-stats?season=2024-25
    // Should return the TeamSeasonStats document for the given team + season.
    const loadStats = async () => {
      setLoadingStats(true);
      setErrorStats(null);
      setTeamStats(null);
      try {
        const res = await fetch(
          `${API_BASE}/teams/${abbreviation}/season-stats?season=${CURRENT_SEASON}`
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const data: TeamSeasonStats = await res.json();
        setTeamStats(data);
      } catch (err) {
        setErrorStats("Could not load team stats.");
        console.error(err);
      } finally {
        setLoadingStats(false);
      }
    };

    // Endpoint to implement: GET /api/teams/:abbr/roster
    // Should return Team.roster populated with full Player documents.
    const loadRoster = async () => {
      setLoadingRoster(true);
      setErrorRoster(null);
      setRoster([]);
      try {
        const res = await fetch(`${API_BASE}/teams/${abbreviation}/roster`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data: Player[] = await res.json();
        setRoster(data);
      } catch (err) {
        setErrorRoster("Could not load roster.");
        console.error(err);
      } finally {
        setLoadingRoster(false);
      }
    };

    setSelectedPlayer(null);
    setPlayerStats(null);
    loadStats();
    loadRoster();
  }, [selectedTeam]);

  // ── 3. Fetch player season stats when a player card is clicked ─────────────
  // Endpoint to implement: GET /api/players/:id/season-stats?season=2024-25
  // Should return the PlayerSeasonStats document for the given player + season.
  useEffect(() => {
    if (!selectedPlayer) return;

    const load = async () => {
      setLoadingPlayerStats(true);
      setErrorPlayerStats(null);
      setPlayerStats(null);
      try {
        const res = await fetch(
          `${API_BASE}/players/${selectedPlayer._id}/season-stats?season=${CURRENT_SEASON}`
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const data: PlayerSeasonStats = await res.json();
        setPlayerStats(data);
      } catch (err) {
        setErrorPlayerStats("Could not load player stats.");
        console.error(err);
      } finally {
        setLoadingPlayerStats(false);
      }
    };
    load();
  }, [selectedPlayer]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const colors = selectedTeam ? getColors(selectedTeam.abbreviation) : null;

  return (
    <div className="fav-page">

      {/* ── Left sidebar: favorite teams list ── */}
      <aside className="fav-sidebar">
        <h2 className="fav-sidebar-title">Favorite Teams</h2>

        {loadingTeams && <p className="fav-loading">Loading...</p>}
        {errorTeams   && <p className="fav-error">{errorTeams}</p>}

        <div className="fav-team-list">
          {favoriteTeams.map((team) => {
            const c        = getColors(team.abbreviation);
            const isActive = selectedTeam?._id === team._id;
            return (
              <button
                key={team._id}
                className={`fav-team-item ${isActive ? "active" : ""}`}
                style={
                  isActive
                    ? {
                        background: `linear-gradient(135deg, ${c.primary}55, #1a1a1a)`,
                        borderColor: c.secondary,
                      }
                    : {}
                }
                onClick={() => setSelectedTeam(team)}
              >
                <div
                  className="fav-team-logo-wrap"
                  style={{
                    background: `radial-gradient(circle at center, ${c.primary}88, transparent)`,
                  }}
                >
                  <img
                    src={getLogoUrl(team)}
                    alt={team.abbreviation}
                    className="fav-team-logo"
                  />
                </div>
                <span className="fav-team-abbr">{team.abbreviation}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="fav-main">
        <div className="fav-panel">

          {/* No team selected yet */}
          {!selectedTeam && !loadingTeams && (
            <p className="fav-placeholder">Select a team to view details.</p>
          )}

          {selectedTeam && colors && (
            <>
              {/* ── Team header: logo + season stats ── */}
              <div className="fav-team-header">
                <div
                  className="fav-team-logo-lg-wrap"
                  style={{
                    background: `radial-gradient(circle at center, ${colors.primary}88, transparent)`,
                  }}
                >
                  <img
                    src={getLogoUrl(selectedTeam)}
                    alt={selectedTeam.abbreviation}
                    className="fav-team-logo-lg"
                  />
                </div>

                <div className="fav-team-info">
                  <h1 className="fav-team-name" style={{ color: colors.secondary }}>
                    {selectedTeam.city} {selectedTeam.name}
                  </h1>

                  {loadingStats && <p className="fav-loading">Loading stats…</p>}
                  {errorStats   && <p className="fav-error">{errorStats}</p>}

                  {/* Season stats — populated from TeamSeasonStats once API is live */}
                  {teamStats && (
                    <>
                      <div className="fav-stat-row">
                        <div className="fav-stat-box">
                          <span className="fav-stat-val">{teamStats.wins}</span>
                          <span className="fav-stat-lbl">W</span>
                        </div>
                        <div className="fav-stat-sep">–</div>
                        <div className="fav-stat-box">
                          <span className="fav-stat-val">{teamStats.losses}</span>
                          <span className="fav-stat-lbl">L</span>
                        </div>
                        <div className="fav-stat-pill">{winPct(teamStats)} PCT</div>
                        <div className="fav-stat-pill">
                          {avg(teamStats.totalPoints, teamStats.gamesPlayed)} PPG
                        </div>
                        <div className="fav-stat-pill">
                          {avg(teamStats.totalRebounds, teamStats.gamesPlayed)} RPG
                        </div>
                        <div className="fav-stat-pill">
                          {avg(teamStats.totalAssists, teamStats.gamesPlayed)} APG
                        </div>
                      </div>
                    </>
                  )}

                  {!loadingStats && !teamStats && !errorStats && (
                    <p className="fav-placeholder">
                      Season stats will appear once the API is connected.
                    </p>
                  )}

                  {/* Upcoming games — requires schedule endpoint */}
                  {/* TODO: fetch GET /api/teams/:abbr/schedule?upcoming=true&limit=3 */}
                  <div className="fav-next-games">
                    <span className="fav-next-label">
                      Upcoming games will appear once the schedule API is connected.
                    </span>
                  </div>
                </div>
              </div>

              <div className="fav-divider" style={{ background: colors.secondary }} />

              {/* ── Player detail view ── */}
              {selectedPlayer ? (
                <div className="fav-player-detail">
                  <button
                    className="fav-back-btn"
                    onClick={() => {
                      setSelectedPlayer(null);
                      setPlayerStats(null);
                    }}
                  >
                    ← Back to Roster
                  </button>

                  <div className="fav-player-detail-inner">
                    <img
                      src={getHeadshotUrl(selectedPlayer)}
                      alt={`${selectedPlayer.firstName} ${selectedPlayer.lastName}`}
                      className="fav-player-detail-img"
                    />

                    <div className="fav-player-detail-info">
                      <h2 className="fav-player-detail-name">
                        {selectedPlayer.firstName} {selectedPlayer.lastName}
                      </h2>
                      <p className="fav-player-detail-meta">
                        #{selectedPlayer.jerseyNumber} · {selectedPlayer.position}
                        {selectedPlayer.height && ` · ${selectedPlayer.height}`}
                        {selectedPlayer.weight && ` · ${selectedPlayer.weight} lbs`}
                        {selectedPlayer.country && ` · ${selectedPlayer.country}`}
                      </p>

                      {loadingPlayerStats && (
                        <p className="fav-loading">Loading stats…</p>
                      )}
                      {errorPlayerStats && (
                        <p className="fav-error">{errorPlayerStats}</p>
                      )}

                      {/* Per-game averages derived from PlayerSeasonStats totals */}
                      {playerStats && (
                        <div className="fav-player-stats-grid">
                          {[
                            { val: avg(playerStats.totalPoints,   playerStats.gamesPlayed), lbl: "PPG" },
                            { val: avg(playerStats.totalRebounds, playerStats.gamesPlayed), lbl: "RPG" },
                            { val: avg(playerStats.totalAssists,  playerStats.gamesPlayed), lbl: "APG" },
                            { val: avg(playerStats.totalSteals,   playerStats.gamesPlayed), lbl: "SPG" },
                            { val: avg(playerStats.totalBlocks,   playerStats.gamesPlayed), lbl: "BPG" },
                            { val: String(playerStats.gamesPlayed ?? "—"),                  lbl: "GP"  },
                          ].map(({ val, lbl }) => (
                            <div key={lbl} className="fav-player-stat-box">
                              <span className="fav-player-stat-val">{val}</span>
                              <span className="fav-player-stat-lbl">{lbl}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!loadingPlayerStats && !playerStats && !errorPlayerStats && (
                        <p className="fav-placeholder">
                          Season stats will appear once the API is connected.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Roster grid ── */
                <div className="fav-roster-section">
                  <h3 className="fav-roster-title">Roster</h3>

                  {loadingRoster && <p className="fav-loading">Loading roster…</p>}
                  {errorRoster   && <p className="fav-error">{errorRoster}</p>}

                  {!loadingRoster && roster.length === 0 && !errorRoster && (
                    <p className="fav-placeholder">
                      Roster will appear once the API is connected.
                    </p>
                  )}

                  <div className="fav-roster-grid">
                    {roster.map((player) => (
                      <button
                        key={player._id}
                        className="fav-player-card"
                        style={
                          {
                            "--team-color":   colors.secondary,
                            "--team-primary": colors.primary,
                          } as React.CSSProperties
                        }
                        onClick={() => setSelectedPlayer(player)}
                      >
                        <img
                          src={getHeadshotUrl(player)}
                          alt={`${player.firstName} ${player.lastName}`}
                          className="fav-player-card-img"
                        />
                        <div className="fav-player-card-info">
                          <span className="fav-player-card-name">
                            {player.firstName} {player.lastName}
                          </span>
                          <span className="fav-player-card-meta">
                            #{player.jerseyNumber} · {player.position}
                          </span>
                          <span className="fav-player-card-hint">
                            Click for season stats
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
