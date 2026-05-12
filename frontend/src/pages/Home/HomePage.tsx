import { useState, useEffect } from 'react';
import './homePage.css';
import GameCard from '../../components/games/GameCard';
import TopPlayerCard, {
  type TopPlayer,
} from '../../components/players/TopPlayerCard';
import FavoritePlayerCard, {
  type FavoritePlayer,
} from '../../components/players/FavoritePlayerCard';
import FavoriteTeamCard, {
  type FavoriteTeam,
} from '../../components/teams/FavoriteTeamCard';
import { getToken } from '../../services/authService';

// ── Types ──────────────────────────────────────────────────────────────────────

type SelectedCard = {
  id: string;
  label: string;
};

interface TeamInfo {
  abbr: string;
  score: number | null;
}

interface RecentGame {
  gameId: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
}

interface RecentGameDay {
  date: string; // e.g. "Apr 28th"
  games: RecentGame[];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopPlayersData {
  points: TopPlayer[];
  threes: TopPlayer[];
  assists: TopPlayer[];
  rebounds: TopPlayer[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const EMPTY_FAVORITE_COUNT = 4; // number of placeholder boxes when no favorites exist

// Stat column definitions — order determines left-to-right column order
const TOP_PLAYER_COLUMNS = [
  { key: 'points' as const, label: 'Points Per Game', suffix: 'PPG' },
  { key: 'threes' as const, label: '3-Pointers', suffix: '3PM' },
  { key: 'assists' as const, label: 'Assists', suffix: 'APG' },
  { key: 'rebounds' as const, label: 'Rebounds', suffix: 'RPG' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  // ── Selection state (for stats panels) ──────────────────────────────────────
  const [selected, setSelected] = useState<SelectedCard[]>([]);

  // ── Recent games state ───────────────────────────────────────────────────────
  const [recentDays, setRecentDays] = useState<RecentGameDay[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);

  // Fetch the 4 most-recent game days from the backend on mount.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchRecentGames() {
      try {
        const res = await fetch('/api/games/recent', {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: RecentGameDay[] = await res.json();
        setRecentDays(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setGamesError('Could not load recent games.');
        }
      } finally {
        setGamesLoading(false);
      }
    }

    fetchRecentGames();
    return () => controller.abort();
  }, []);

  // ── Top players state ────────────────────────────────────────────────────────
  const [topPlayers, setTopPlayers] = useState<TopPlayersData | null>(null);
  const [topLoading, setTopLoading] = useState(true);
  const [topError, setTopError] = useState<string | null>(null);

  // Fetch top-5 players per stat category on mount.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchTopPlayers() {
      try {
        const res = await fetch('/api/players/top', {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: TopPlayersData = await res.json();
        setTopPlayers(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setTopError('Could not load top players.');
        }
      } finally {
        setTopLoading(false);
      }
    }

    fetchTopPlayers();
    return () => controller.abort();
  }, []);

  // ── Favorites state ──────────────────────────────────────────────────────────
  const [favoritePlayers, setFavoritePlayers] = useState<FavoritePlayer[]>([]);
  const [favoriteTeams, setFavoriteTeams] = useState<FavoriteTeam[]>([]);

  // Fetch the logged-in user's favorites on every mount.
  // Silently skips the request if no token is present (user not logged in).
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const controller = new AbortController();

    async function fetchFavorites() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          console.error(
            '[Favorites] GET /api/auth/me failed with status',
            res.status,
          );
          return;
        }
        const data = await res.json();
        console.log('[Favorites] /api/auth/me response:', data);
        setFavoritePlayers(data.user.favoritePlayers ?? []);
        setFavoriteTeams(data.user.favoriteTeams ?? []);
      } catch (err) {
        console.error('[Favorites] fetch error:', err);
      }
    }

    fetchFavorites();
    return () => controller.abort();
  }, []);

  // ── Card selection helpers ───────────────────────────────────────────────────

  const handleCardClick = (card: SelectedCard) => {
    setSelected((prev) => {
      const alreadySelected = prev.some((s) => s.id === card.id);
      if (alreadySelected) {
        // Clicking an active card deselects it
        return prev.filter((s) => s.id !== card.id);
      }
      if (prev.length < 2) {
        // Open first or second panel
        return [...prev, card];
      }
      // Two panels already open: replace the oldest with the new selection (FIFO)
      return [prev[1], card];
    });
  };

  const isActive = (id: string) => selected.some((s) => s.id === id);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="home-page">
      {/* ── Scrollable content ─────────────────────────────── */}
      <div className="home-content">
        {/* ── Recent Games ──────────────────────────────────── */}
        <section className="home-section">
          <h2 className="section-title">Recent Games</h2>

          {gamesLoading && (
            <div className="games-grid">
              {Array.from({ length: 4 }).map((_, col) => (
                <div key={col} className="game-column">
                  <span className="card-date">—</span>
                  <div className="card-scroll-container">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="game-card"
                        style={{ opacity: 0.35 }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {gamesError && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              {gamesError}
            </p>
          )}

          {!gamesLoading && !gamesError && (
            <div className="games-scroll-wrapper">
              <div className="games-grid">
                {recentDays.map((day) => (
                  <div key={day.date} className="game-column">
                    <span className="card-date">{day.date}</span>
                    <div className="card-scroll-container">
                      {day.games.map((game) => (
                        <GameCard
                          key={game.gameId}
                          gameId={game.gameId}
                          homeTeam={game.homeTeam}
                          awayTeam={game.awayTeam}
                          isActive={isActive(game.gameId)}
                          onClick={() =>
                            handleCardClick({
                              id: game.gameId,
                              label: `${game.awayTeam.abbr} @ ${game.homeTeam.abbr}`,
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Top Players ───────────────────────────────────── */}
        <section className="home-section">
          <h2 className="section-title">Top Players</h2>

          {/* Loading skeleton */}
          {topLoading && (
            <div className="games-scroll-wrapper">
              <div className="games-grid">
                {TOP_PLAYER_COLUMNS.map((col) => (
                  <div key={col.key} className="game-column">
                    <span className="card-date">{col.label}</span>
                    <div className="top-players-column">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="favorite-card"
                          style={{ opacity: 0.25 }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topError && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              {topError}
            </p>
          )}

          {!topLoading && !topError && topPlayers && (
            <div className="games-scroll-wrapper">
              <div className="games-grid">
                {TOP_PLAYER_COLUMNS.map(({ key, label, suffix }) => (
                  <div key={key} className="game-column">
                    <span className="card-date">{label}</span>
                    <div className="top-players-column">
                      {topPlayers[key].map((player) => (
                        <TopPlayerCard
                          key={player.nbaPlayerId}
                          player={player}
                          statLabel={suffix}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Favorites ─────────────────────────────────────── */}
        <div className="favorites-row">
          <div className="favorites-col">
            <h2 className="section-title">Your Favorite Players</h2>
            <div className="favorites-scroll-container">
              {favoritePlayers.length > 0
                ? favoritePlayers.map((player) => (
                    <FavoritePlayerCard key={player._id} player={player} />
                  ))
                : Array.from({ length: EMPTY_FAVORITE_COUNT }).map((_, i) => (
                    <div key={i} className="favorite-card" />
                  ))}
            </div>
          </div>

          <div className="favorites-col">
            <h2 className="section-title">Your Favorite Teams</h2>
            <div className="favorites-scroll-container">
              {favoriteTeams.length > 0
                ? favoriteTeams.map((team) => (
                    <FavoriteTeamCard key={team._id} team={team} />
                  ))
                : Array.from({ length: EMPTY_FAVORITE_COUNT }).map((_, i) => (
                    <div key={i} className="favorite-card" />
                  ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats panels ───────────────────────────────────── */}
      {selected.length > 0 && (
        <div className={`stats-panels-container panels-${selected.length}`}>
          {selected.map((item) => (
            <div key={item.id} className="stats-panel">
              <div className="stats-panel-header">
                <h2 className="stats-panel-title">{item.label}</h2>
              </div>
              <div className="stats-panel-divider" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
