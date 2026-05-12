import { useState, useEffect } from 'react';

export interface SelectedItem {
  id:   string;
  name: string;
}

interface PlayerResult {
  _id:       string;
  firstName: string;
  lastName:  string;
  nbaId:     number | null;
}

interface Props {
  selectedPlayers: SelectedItem[];
  onAdd:    (player: SelectedItem) => void;
  onRemove: (id: string) => void;
  onSkip:   () => void;
}

export default function GetStartedStep2({ selectedPlayers, onAdd, onRemove, onSkip }: Props) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<PlayerResult[]>([]);

  // Debounced search — fires 300 ms after the user stops typing
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) { setResults([]); return; }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `http://localhost:3000/api/players/search?q=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) setResults(await res.json());
      } catch {
        // silently ignore network errors during search
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // IDs already selected — used to hide duplicates from results list.
  // We use nbaId as the canonical id, falling back to _id if nbaId is absent.
  const selectedIds = new Set(selectedPlayers.map((p) => p.id));
  const visibleResults = results.filter(
    (r) => !selectedIds.has(r.nbaId != null ? String(r.nbaId) : r._id),
  );

  return (
    <div className="gs-card gs-card--step2">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="gs-card-header-row">
        <h2 className="gs-card-title">
          Create Your Account <span className="gs-step-label">2/3</span>
        </h2>
        <button className="gs-skip-btn" type="button" onClick={onSkip}>
          Skip
        </button>
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <p className="gs-section-label">Choose Your Favorite Players</p>
      <div className="gs-search-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder=""
          aria-label="Search players"
        />
        <span className="gs-search-icon" aria-hidden="true">🔍</span>
      </div>

      {/* ── Search results ─────────────────────────────────── */}
      {visibleResults.length > 0 && (
        <div className="gs-results">
          {visibleResults.map((player) => (
            <div key={player._id} className="gs-result-row">
              <span className="gs-result-name">
                {player.firstName} {player.lastName}
              </span>
              <button
                className="gs-add-btn"
                type="button"
                onClick={() =>
                  onAdd({
                    id:   player.nbaId != null ? String(player.nbaId) : player._id,
                    name: `${player.firstName} ${player.lastName}`,
                  })
                }
              >
                Add <span className="gs-btn-symbol">+</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Selected list ──────────────────────────────────── */}
      {selectedPlayers.length > 0 && (
        <div className="gs-selected">
          <p className="gs-selected-label">Selected:</p>
          {selectedPlayers.map((player) => (
            <div key={player.id} className="gs-result-row">
              <span className="gs-result-name">{player.name}</span>
              <button
                className="gs-remove-btn"
                type="button"
                onClick={() => onRemove(player.id)}
              >
                Remove <span className="gs-btn-symbol">−</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
