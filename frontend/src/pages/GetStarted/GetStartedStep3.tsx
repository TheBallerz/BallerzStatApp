import { useState } from "react";

interface Props {
  onSkip: () => void;
}

export default function GetStartedStep3({ onSkip }: Props) {
  const [query, setQuery] = useState("");

  return (
    <div className="gs-card gs-card--step2">
      {/* Header row */}
      <div className="gs-card-header-row">
        <h2 className="gs-card-title">
          Create Your Account{" "}
          <span className="gs-step-label">3/3</span>
        </h2>
        <button className="gs-skip-btn" type="button" onClick={onSkip}>
          Skip
        </button>
      </div>

      {/* Search */}
      <p className="gs-section-label">Choose Your Favorite Teams</p>
      <div className="gs-search-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder=""
          aria-label="Search teams"
        />
        <button
          className="gs-search-icon"
          type="button"
          aria-label="Search"
        >
          🔍
        </button>
      </div>
    </div>
  );
}
