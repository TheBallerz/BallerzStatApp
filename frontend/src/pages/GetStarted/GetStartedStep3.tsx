import { useState, useEffect } from 'react';
import { type SelectedItem } from './GetStartedStep2';

interface TeamResult {
  _id: string;
  name: string;
  nbaId: number | null;
}

interface Props {
  selectedTeams: SelectedItem[];
  onAdd: (team: SelectedItem) => void;
  onRemove: (id: string) => void;
  onSkip: () => void;
}

export default function GetStartedStep3({
  selectedTeams,
  onAdd,
  onRemove,
  onSkip,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TeamResult[]>([]);

  // Debounced search — fires 300 ms after the user stops typing
  useEffect(() => {
    const trimmed = query.trim();

    const timer = setTimeout(async () => {
      if (!trimmed) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/teams/search?q=${encodeURIComponent(trimmed)}`,
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
  const selectedIds = new Set(selectedTeams.map((t) => t.id));
  const visibleResults = results.filter(
    (r) => !selectedIds.has(r.nbaId != null ? String(r.nbaId) : r._id),
  );

  return (
    <div className="gs-card gs-card--step2">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="gs-card-header-row">
        <h2 className="gs-card-title">
          Create Your Account <span className="gs-step-label">3/3</span>
        </h2>
        <button className="gs-skip-btn" type="button" onClick={onSkip}>
          Skip
        </button>
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <p className="gs-section-label">Choose Your Favorite Teams</p>
      <div className="gs-search-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder=""
          aria-label="Search teams"
        />
        <span className="gs-search-icon" aria-hidden="true">
          🔍
        </span>
      </div>

      {/* ── Search results ─────────────────────────────────── */}
      {visibleResults.length > 0 && (
        <div className="gs-results">
          {visibleResults.map((team) => (
            <div key={team._id} className="gs-result-row">
              <span className="gs-result-name">{team.name}</span>
              <button
                className="gs-add-btn"
                type="button"
                onClick={() =>
                  onAdd({
                    id: team.nbaId != null ? String(team.nbaId) : team._id,
                    name: team.name,
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
      {selectedTeams.length > 0 && (
        <div className="gs-selected">
          <p className="gs-selected-label">Selected:</p>
          {selectedTeams.map((team) => (
            <div key={team.id} className="gs-result-row">
              <span className="gs-result-name">{team.name}</span>
              <button
                className="gs-remove-btn"
                type="button"
                onClick={() => onRemove(team.id)}
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
