import { useEffect, useState } from 'react';
import './Fantasy.css';

interface FantasyPlayer {
  playerId: number;
  fullName: string;
  team: string;
  position?: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
}

const API_BASE = 'http://localhost:3000/api';

function fantasyScore(p: FantasyPlayer): number {
  return (
    p.points +
    p.rebounds * 1.2 +
    p.assists * 1.5 +
    p.steals * 3 +
    p.blocks * 3 -
    p.turnovers
  );
}

export default function Fantasy() {
  const [players, setPlayers] = useState<FantasyPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlayers() {
      try {
        const res = await fetch(`${API_BASE}/players?currentOnly=1`);
        const data = await res.json();

        const mapped = data.slice(0, 25).map((p: any) => ({
          playerId: p.playerId,
          fullName: p.fullName,
          team: p.team,
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
        }));

        setPlayers(mapped);
      } finally {
        setLoading(false);
      }
    }

    loadPlayers();
  }, []);

  if (loading) return <p>Loading fantasy page...</p>;

  return (
    <main className="fantasy-page">
      <section className="fantasy-header">
        <h1>Fantasy Basketball</h1>
        <p>Compare players using a simple fantasy scoring formula.</p>
      </section>

      <section className="fantasy-card">
        <h2>Fantasy Formula</h2>
        <p>
          Points + 1.2×Rebounds + 1.5×Assists + 3×Steals + 3×Blocks − Turnovers
        </p>
      </section>

      <section className="fantasy-table-card">
        <h2>Player Rankings</h2>

        <table className="fantasy-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Team</th>
              <th>Fantasy Score</th>
            </tr>
          </thead>
          <tbody>
            {[...players]
              .sort((a, b) => fantasyScore(b) - fantasyScore(a))
              .map((player, index) => (
                <tr key={player.playerId}>
                  <td>{index + 1}</td>
                  <td>{player.fullName}</td>
                  <td>{player.team || 'FA'}</td>
                  <td>{fantasyScore(player).toFixed(1)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}