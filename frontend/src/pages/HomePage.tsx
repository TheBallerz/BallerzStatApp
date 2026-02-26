import { useState } from "react";
import "./homePage.css";

type SelectedCard = {
  id: string;
  label: string;
};

const GAME_COLUMNS = 4;
const CARDS_PER_COLUMN = 4;
const FAVORITE_CARD_COUNT = 4;

export default function HomePage() {
  const [selected, setSelected] = useState<SelectedCard[]>([]);

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
      // Two panels already open: replace the oldest with the new selection
      return [prev[1], card];
    });
  };

  const isActive = (id: string) => selected.some((s) => s.id === id);

  return (
    <div className="home-page">
      {/* ── Scrollable content ─────────────────────────────── */}
      <div className="home-content">
        <section className="home-section">
          <h2 className="section-title">Recent Games</h2>
          <div className="games-grid">
            {Array.from({ length: GAME_COLUMNS }).map((_, col) => (
              <div key={col} className="game-column">
                <span className="card-date">Date</span>
                <div className="card-scroll-container">
                  {Array.from({ length: CARDS_PER_COLUMN }).map((_, card) => {
                    const id = `recent-${col}-${card}`;
                    return (
                      <div
                        key={card}
                        className={`game-card${isActive(id) ? " card-active" : ""}`}
                        onClick={() => handleCardClick({ id, label: "Team Name" })}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="home-section">
          <h2 className="section-title">Coming Up</h2>
          <div className="games-grid">
            {Array.from({ length: GAME_COLUMNS }).map((_, col) => (
              <div key={col} className="game-column">
                <span className="card-date">Date</span>
                <div className="card-scroll-container">
                  {Array.from({ length: CARDS_PER_COLUMN }).map((_, card) => {
                    const id = `upcoming-${col}-${card}`;
                    return (
                      <div
                        key={card}
                        className={`game-card${isActive(id) ? " card-active" : ""}`}
                        onClick={() => handleCardClick({ id, label: "Team Name" })}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="favorites-row">
          <div className="favorites-col">
            <h2 className="section-title">Your Favorite Players</h2>
            <div className="favorites-scroll-container">
              {Array.from({ length: FAVORITE_CARD_COUNT }).map((_, i) => {
                const id = `player-${i}`;
                return (
                  <div
                    key={i}
                    className={`favorite-card${isActive(id) ? " card-active" : ""}`}
                    onClick={() => handleCardClick({ id, label: "Player Name" })}
                  />
                );
              })}
            </div>
          </div>

          <div className="favorites-col">
            <h2 className="section-title">Your Favorite Teams</h2>
            <div className="favorites-scroll-container">
              {Array.from({ length: FAVORITE_CARD_COUNT }).map((_, i) => {
                const id = `team-${i}`;
                return (
                  <div
                    key={i}
                    className={`favorite-card${isActive(id) ? " card-active" : ""}`}
                    onClick={() => handleCardClick({ id, label: "Team Name" })}
                  />
                );
              })}
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
