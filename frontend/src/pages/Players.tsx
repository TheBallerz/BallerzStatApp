import { useState } from 'react';
import './Players.css';

type StatCategory = 'Points' | 'Assists' | 'Reb' | 'Steals';
type SortOrder = 'asc' | 'desc';

const categories: StatCategory[] = ['Points', 'Assists', 'Reb', 'Steals'];

function StatColumn({ title }: { title: string }) {
  const [selected, setSelected] = useState<StatCategory>('Points');
  const [sort, setSort] = useState<SortOrder>('desc');

  return (
    <div className="stat-column">
      <div className="column-header">{title}</div>
      <div className="column-body">
        <div className="filter-buttons">
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-btn ${selected === cat ? 'active' : ''}`}
              onClick={() => setSelected(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="sort-row">
          <span onClick={() => setSort(sort === 'desc' ? 'asc' : 'desc')}>
            Sort {sort === 'desc' ? '▼' : '▲'}
          </span>
        </div>
        <div className="player-list">
          {/* Player data will go here */}
        </div>
      </div>
    </div>
  );
}

export default function Players() {
  return (
    <div className="players-page">
      <nav className="navbar">
        <div className="nav-links">
          <a href="#">Home</a>
          <a href="#">Teams</a>
          <a href="#" className="active">Players</a>
          <a href="#">Favorites</a>
          <a href="#">Standings</a>
          <a href="#">Schedule</a>
          <a href="#">Account</a>
        </div>
        <button className="search-btn">Search</button>
      </nav>
      <div className="columns-container">
        <StatColumn title="All-time" />
        <StatColumn title="Season" />
        <StatColumn title="Week" />
      </div>
    </div>
  );
}