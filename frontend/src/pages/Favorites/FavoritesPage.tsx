import './FavoritesPage.css';

export default function FavoritesPage() {
  return (
    <div className="favorites-page">
      <h2 className="favorites-title">Favorite Teams</h2>
      <div className="favorites-container">
        {/* Left Sidebar */}
        <div className="team-sidebar">
          {/* Teams will be populated from API */}
        </div>

        {/* Right Panel */}
        <div className="team-detail-panel">
          <div className="team-detail-content">
            {/* Team stats/content will go here */}
          </div>
        </div>
      </div>
    </div>
  );
}