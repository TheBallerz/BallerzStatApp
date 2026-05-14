import { useState, useEffect, useRef } from 'react';
import './FavoritesPage.css';
// Reuse the exact same search-bar / results styles from the GetStarted workflow
import '../GetStarted/getStartedPage.css';
import FavoritePlayerCard, {
  type FavoritePlayer,
} from '../../components/players/FavoritePlayerCard';
import FavoriteTeamCard, {
  type FavoriteTeam,
} from '../../components/teams/FavoriteTeamCard';
import PlayerDetailPanel from '../../components/players/PlayerDetailPanel';
import HomeTeamPanel from '../../components/teams/HomeTeamPanel';
import { saveFavorites } from '../../services/favoritesService';
import { getToken } from '../../services/authService';

// ── Search result shapes returned by the search endpoints ────────────────────

interface PlayerResult {
  _id: string;
  firstName: string;
  lastName: string;
  nbaId: number | null;
}

interface TeamResult {
  _id: string;
  name: string;
  nbaId: number | null;
}

// ── Panel selection types (mirrors HomePage) ──────────────────────────────────

type SelectedTeamCard = {
  type: 'team';
  id: string;
  label: string;
  nbaTeamId: number;
};

type SelectedPlayerCard = {
  type: 'player';
  id: string;
  label: string;
  nbaPlayerId: number;
  playerName: string;
  teamAbbr: string;
};

type SelectedCard = SelectedTeamCard | SelectedPlayerCard;

// ── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE as string;

/** Fetch the current user's full favorites from /api/auth/me */
async function fetchMe(): Promise<{
  favoritePlayers: FavoritePlayer[];
  favoriteTeams: FavoriteTeam[];
}> {
  const token = getToken();
  if (!token) return { favoritePlayers: [], favoriteTeams: [] };

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { favoritePlayers: [], favoriteTeams: [] };
  const data = await res.json();
  return {
    favoritePlayers: data.user.favoritePlayers ?? [],
    favoriteTeams:   data.user.favoriteTeams   ?? [],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FavoritesPage() {
  // ── Favorites state ───────────────────────────────────────────────────────
  const [favoritePlayers, setFavoritePlayers] = useState<FavoritePlayer[]>([]);
  const [favoriteTeams,   setFavoriteTeams]   = useState<FavoriteTeam[]>([]);

  // ── Panel selection state ─────────────────────────────────────────────────
  const [selected, setSelected] = useState<SelectedCard[]>([]);

  // ── Player search ─────────────────────────────────────────────────────────
  const [playerQuery,   setPlayerQuery]   = useState('');
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);

  // ── Team search ───────────────────────────────────────────────────────────
  const [teamQuery,   setTeamQuery]   = useState('');
  const [teamResults, setTeamResults] = useState<TeamResult[]>([]);

  // ── Refs for click-outside to close dropdowns ─────────────────────────────
  const playerSearchRef = useRef<HTMLDivElement>(null);
  const teamSearchRef   = useRef<HTMLDivElement>(null);

  // ── 1. Load favorites on mount ────────────────────────────────────────────
  useEffect(() => {
    fetchMe().then(({ favoritePlayers: p, favoriteTeams: t }) => {
      setFavoritePlayers(p);
      setFavoriteTeams(t);
    });
  }, []);

  // ── 2. Debounced player search (300 ms) ───────────────────────────────────
  useEffect(() => {
    const trimmed = playerQuery.trim();
    if (!trimmed) { setPlayerResults([]); return; }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/players/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (res.ok) setPlayerResults(await res.json());
      } catch { /* ignore */ }
    }, 300);

    return () => clearTimeout(timer);
  }, [playerQuery]);

  // ── 3. Debounced team search (300 ms) ─────────────────────────────────────
  useEffect(() => {
    const trimmed = teamQuery.trim();
    if (!trimmed) { setTeamResults([]); return; }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/teams/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (res.ok) setTeamResults(await res.json());
      } catch { /* ignore */ }
    }, 300);

    return () => clearTimeout(timer);
  }, [teamQuery]);

  // ── 4. Click-outside closes dropdowns ─────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (playerSearchRef.current && !playerSearchRef.current.contains(e.target as Node)) {
        setPlayerResults([]);
      }
      if (teamSearchRef.current && !teamSearchRef.current.contains(e.target as Node)) {
        setTeamResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Derived: sets of currently-favorited nbaIds ───────────────────────────
  const favPlayerIds = new Set(
    favoritePlayers.map((p) => (p.nbaId != null ? String(p.nbaId) : p._id)),
  );
  const favTeamIds = new Set(
    favoriteTeams.map((t) => (t.nbaId != null ? String(t.nbaId) : t._id)),
  );

  // Filter already-favorited items out of search results
  const visiblePlayerResults = playerResults.filter(
    (r) => !favPlayerIds.has(r.nbaId != null ? String(r.nbaId) : r._id),
  );
  const visibleTeamResults = teamResults.filter(
    (r) => !favTeamIds.has(r.nbaId != null ? String(r.nbaId) : r._id),
  );

  // ── Panel selection helpers ───────────────────────────────────────────────

  const handleCardClick = (card: SelectedCard) => {
    setSelected((prev) => {
      const alreadySelected = prev.some((s) => s.id === card.id);
      if (alreadySelected) return prev.filter((s) => s.id !== card.id);
      if (prev.length < 2) return [...prev, card];
      // FIFO: replace oldest
      return [prev[1], card];
    });
  };

  const activePanelType =
    selected.length > 0 ? selected[selected.length - 1].type : null;

  const isPlayerGreyed = activePanelType === 'team';
  const isTeamGreyed   = activePanelType === 'player';

  // ── Add / remove handlers ─────────────────────────────────────────────────

  async function addPlayer(result: PlayerResult) {
    setPlayerQuery('');
    setPlayerResults([]);
    const newIds = [
      ...favoritePlayers.map((p) => p.nbaId).filter((id): id is number => id != null),
      ...(result.nbaId != null ? [result.nbaId] : []),
    ];
    await saveFavorites({ favoritePlayers: newIds });
    const { favoritePlayers: updated } = await fetchMe();
    setFavoritePlayers(updated);
  }

  async function removePlayer(player: FavoritePlayer) {
    // If this player's panel is open, close it first
    setSelected((prev) => prev.filter((s) => s.id !== `player-${player._id}`));
    const newIds = favoritePlayers
      .filter((p) => p._id !== player._id)
      .map((p) => p.nbaId)
      .filter((id): id is number => id != null);
    setFavoritePlayers((prev) => prev.filter((p) => p._id !== player._id));
    await saveFavorites({ favoritePlayers: newIds });
  }

  async function addTeam(result: TeamResult) {
    setTeamQuery('');
    setTeamResults([]);
    const newIds = [
      ...favoriteTeams.map((t) => t.nbaId).filter((id): id is number => id != null),
      ...(result.nbaId != null ? [result.nbaId] : []),
    ];
    await saveFavorites({ favoriteTeams: newIds });
    const { favoriteTeams: updated } = await fetchMe();
    setFavoriteTeams(updated);
  }

  async function removeTeam(team: FavoriteTeam) {
    // If this team's panel is open, close it first
    setSelected((prev) => prev.filter((s) => s.id !== `team-${team._id}`));
    const newIds = favoriteTeams
      .filter((t) => t._id !== team._id)
      .map((t) => t.nbaId)
      .filter((id): id is number => id != null);
    setFavoriteTeams((prev) => prev.filter((t) => t._id !== team._id));
    await saveFavorites({ favoriteTeams: newIds });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fp-page">
      <div className="fp-columns">

        {/* ── Left column: Favorite Players ─────────────────────────────── */}
        <div className="fp-col">
          <h2 className="fp-col-title">Your Favorite Players</h2>

          {/* Search bar */}
          <div className="fp-search-wrap" ref={playerSearchRef}>
            <div className="gs-search-bar">
              <input
                type="text"
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
                placeholder="Add Players to Your Favorites"
                aria-label="Search players"
              />
              <span className="gs-search-icon" aria-hidden="true">🔍</span>
            </div>

            {visiblePlayerResults.length > 0 && (
              <div className="gs-results fp-results-dropdown">
                {visiblePlayerResults.map((player) => (
                  <div key={player._id} className="gs-result-row">
                    <span className="gs-result-name">
                      {player.firstName} {player.lastName}
                    </span>
                    <button
                      className="gs-add-btn"
                      type="button"
                      onClick={() => addPlayer(player)}
                    >
                      Add <span className="gs-btn-symbol">+</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cards */}
          <div className="fp-scroll">
            {favoritePlayers.map((player) => (
              <div key={player._id} className="fp-card-wrap">
                <FavoritePlayerCard
                  player={player}
                  isGreyed={isPlayerGreyed}
                  onClick={() => {
                    if (!player.nbaId) return;
                    handleCardClick({
                      type: 'player',
                      id: `player-${player._id}`,
                      label: `${player.firstName} ${player.lastName}`,
                      nbaPlayerId: player.nbaId,
                      playerName: `${player.firstName} ${player.lastName}`,
                      teamAbbr: player.teamId?.abbreviation ?? '',
                    });
                  }}
                />
                <button
                  className="fp-remove-btn"
                  aria-label="Remove from favorites"
                  onClick={(e) => { e.stopPropagation(); removePlayer(player); }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right column: Favorite Teams ──────────────────────────────── */}
        <div className="fp-col">
          <h2 className="fp-col-title">Your Favorite Teams</h2>

          {/* Search bar */}
          <div className="fp-search-wrap" ref={teamSearchRef}>
            <div className="gs-search-bar">
              <input
                type="text"
                value={teamQuery}
                onChange={(e) => setTeamQuery(e.target.value)}
                placeholder="Add Teams to Your Favorites"
                aria-label="Search teams"
              />
              <span className="gs-search-icon" aria-hidden="true">🔍</span>
            </div>

            {visibleTeamResults.length > 0 && (
              <div className="gs-results fp-results-dropdown">
                {visibleTeamResults.map((team) => (
                  <div key={team._id} className="gs-result-row">
                    <span className="gs-result-name">{team.name}</span>
                    <button
                      className="gs-add-btn"
                      type="button"
                      onClick={() => addTeam(team)}
                    >
                      Add <span className="gs-btn-symbol">+</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cards */}
          <div className="fp-scroll">
            {favoriteTeams.map((team) => (
              <div key={team._id} className="fp-card-wrap">
                <FavoriteTeamCard
                  team={team}
                  isGreyed={isTeamGreyed}
                  onClick={() => {
                    if (!team.nbaId) return;
                    handleCardClick({
                      type: 'team',
                      id: `team-${team._id}`,
                      label: team.name,
                      nbaTeamId: team.nbaId,
                    });
                  }}
                />
                <button
                  className="fp-remove-btn"
                  aria-label="Remove from favorites"
                  onClick={(e) => { e.stopPropagation(); removeTeam(team); }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Detail panels (fixed overlay, floats over content) ────────── */}
      {selected.length > 0 && (
        <div className={`fp-panels-container panels-${selected.length}`}>
          {selected.map((item) => {
            if (item.type === 'team') {
              const matchingTeam = favoriteTeams.find((t) => `team-${t._id}` === item.id);
              return (
                <div key={item.id} className="fp-panel">
                  <HomeTeamPanel
                    nbaTeamId={item.nbaTeamId}
                    label={item.label}
                    onClose={() => handleCardClick(item)}
                    isFavorited={true}
                    onToggleFavorite={matchingTeam ? () => removeTeam(matchingTeam) : undefined}
                  />
                </div>
              );
            } else {
              const matchingPlayer = favoritePlayers.find((p) => `player-${p._id}` === item.id);
              return (
                <div key={item.id} className="fp-panel">
                  <PlayerDetailPanel
                    nbaPlayerId={item.nbaPlayerId}
                    playerName={item.playerName}
                    teamAbbr={item.teamAbbr}
                    onClose={() => handleCardClick(item)}
                    isFavorited={true}
                    onToggleFavorite={matchingPlayer ? () => removePlayer(matchingPlayer) : undefined}
                  />
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
