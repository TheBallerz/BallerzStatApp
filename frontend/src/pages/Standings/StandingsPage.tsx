import { useEffect, useState } from 'react';
import {
  fetchStandings,
  type StandingsResponse,
  type StandingTeam,
} from '../../services/standingsService';
import './standingsPage.css';
import { useNavigate } from 'react-router-dom';

function StandingsTable({
  title,
  teams,
}: {
  title: string;
  teams: StandingTeam[];
}) {
  const navigate = useNavigate();
  return (
    <div className="standings-section">
      <h2>{title}</h2>
      <div className="standings-table-wrapper">
        <table className="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>PCT</th>
              <th>PPG</th>
              <th>RPG</th>
              <th>APG</th>
              <th>FG%</th>
              <th>3P%</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => (
              <tr
              key={team.teamId}
              className="standings-team-row"
              style={
                {
                  '--team-primary': team.primaryColor || '#444',
                  '--team-secondary': team.secondaryColor || '#222',
                } as React.CSSProperties
              }
              onClick={() => navigate(`/teams/${team.teamId}`)}
            >
                <td>{index + 1}</td>
                <td>{team.teamName}</td>
                <td>{team.wins}</td>
                <td>{team.losses}</td>
                <td>{team.winPct.toFixed(3)}</td>
                <td>{team.avgPoints?.toFixed(1) ?? '-'}</td>
                <td>{team.avgRebounds?.toFixed(1) ?? '-'}</td>
                <td>{team.avgAssists?.toFixed(1) ?? '-'}</td>

                <td>
                  {team.fgPct != null
                    ? `${(team.fgPct * 100).toFixed(1)}%`
                    : '-'}
                </td>

                <td>
                  {team.fg3Pct != null
                    ? `${(team.fg3Pct * 100).toFixed(1)}%`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StandingsPage() {
  const [data, setData] = useState<StandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [standingsType, setStandingsType] = useState<'season' | 'finals'>(
    'season',
  );

  useEffect(() => {
    async function loadStandings() {
      try {
        setLoading(true);
        const standings = await fetchStandings(undefined, standingsType);
        setData(standings);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadStandings();
  }, [standingsType]);

  if (loading) {
    return <div className="standings-page">Loading standings...</div>;
  }

  if (error) {
    return <div className="standings-page">Error: {error}</div>;
  }

  return (
    <div className="standings-page">
      <h1 className="page-title">NBA Standings</h1>
      <p className="standings-subtitle">Season: {data?.season}</p>

      <div className="standings-toggle">
        <button onClick={() => setStandingsType('season')}>
          Regular Season
        </button>

        <button onClick={() => setStandingsType('finals')}>Finals</button>
      </div>

      <div className="standings-grid">
        <StandingsTable title="Eastern Conference" teams={data?.east ?? []} />
        <StandingsTable title="Western Conference" teams={data?.west ?? []} />
      </div>
    </div>
  );
}
