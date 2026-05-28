import { useEffect, useState } from 'react';
import { TEAM_LOGOS } from '../../assets/teamLogos';
import { fetchTeam, fetchPlayers } from '../../services/nbaApi';
import { useNavigate } from 'react-router-dom';
import './teamDetailPanel.css';

type SelectedTeam = {
  mongoId: string;
  name: string;
  division: string;
  teamId: number;
  primaryColor?: string;
  secondaryColor?: string;
};

type TeamDetail = {
  mongoId: string;
  teamId: number;
  city: string;
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  record: string;
  ppg: number;
  rpg: number;
  apg: number;
  fgPct: number;
};

type TeamPlayer = {
  mongoId: string;
  nbaId: number;
  fullName: string;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  imageUrl: string;
  team: string;
  seasonStats?: {
    ppg: number;
    rpg: number;
    apg: number;
    spg: number;
    bpg: number;
    fgPct: number;
    threePct: number;
  };
};

type Props = {
  team: SelectedTeam;
  onClose: () => void;
};

export default function TeamDetailPanel({ team, onClose }: Props) {
  const logoSrc = TEAM_LOGOS?.[team.name];
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [roster, setRoster] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function loadTeamDetail() {
      try {
        setLoading(true);
        setError('');

        const [teamData, rosterData] = await Promise.all([
          fetchTeam(team.teamId),
          fetchPlayers(team.mongoId),
        ]);

        setTeamDetail(teamData);
        setRoster(rosterData);
      } catch (err) {
        console.error(err);
        setError('Failed to load team data.');
      } finally {
        setLoading(false);
      }
    }

    loadTeamDetail();
  }, [team.teamId, team.mongoId]);

  return (
    <div
      className="team-detail-panel"
      style={
        {
          '--team-primary': team.primaryColor,
          '--team-secondary': team.secondaryColor,
        } as React.CSSProperties
      }
    >
      <div className="team-detail-header">
        <div className="team-detail-identity">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={`${team.name} logo`}
              className="team-detail-logo"
            />
          ) : (
            <div className="team-detail-logo-placeholder" />
          )}
          <div>
            <h2 className="team-detail-name">
              {teamDetail ? `${teamDetail.city} ${teamDetail.name}` : team.name}
            </h2>
            <span className="team-detail-division">
              {teamDetail
                ? `${teamDetail.division} Division`
                : `${team.division} Division`}
            </span>
          </div>
        </div>

        <button className="team-detail-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="team-detail-divider" />

      <div className="team-detail-body">
        {loading ? (
          <div className="team-stat-row">
            <span className="team-stat-label">Loading</span>
            <span className="team-stat-value">...</span>
          </div>
        ) : error || !teamDetail ? (
          <div className="team-stat-row">
            <span className="team-stat-label">Error</span>
            <span className="team-stat-value">{error || 'No data found'}</span>
          </div>
        ) : (
          <>
            <div className="team-stat-row">
              <span className="team-stat-label">Record</span>
              <span className="team-stat-value">{teamDetail.record}</span>
            </div>

            <div className="team-stat-row">
              <span className="team-stat-label">PPG</span>
              <span className="team-stat-value">{teamDetail.ppg}</span>
            </div>

            <div className="team-stat-row">
              <span className="team-stat-label">RPG</span>
              <span className="team-stat-value">{teamDetail.rpg}</span>
            </div>

            <div className="team-stat-row">
              <span className="team-stat-label">APG</span>
              <span className="team-stat-value">{teamDetail.apg}</span>
            </div>

            <div className="team-stat-row">
              <span className="team-stat-label">FG%</span>
              <span className="team-stat-value">
                {(teamDetail.fgPct * 100).toFixed(1)}%
              </span>
            </div>

            <div className="team-roster-section">
              <h3 className="team-roster-title">Roster</h3>

              <div className="team-roster-list">
                {roster.map((player) => (
                  <button
                    key={player.mongoId}
                    className="team-roster-player"
                    onClick={() =>
                      navigate('/players', {
                        state: {
                          openPlayer: true,
                          nbaPlayerId: player.nbaId,
                          playerName: player.fullName,
                          teamAbbr: player.team,
                        },
                      })
                    }
                  >
                    <img
                      src={player.imageUrl}
                      alt={player.fullName}
                      className="team-roster-headshot"
                    />
                    <span className="team-roster-number">
                      #{player.jerseyNumber} {player.position}
                    </span>

                    <span className="team-roster-name">{player.fullName}</span>

                    <span className="team-roster-stat">
                      {player.seasonStats?.ppg?.toFixed(1) ?? '0.0'} PPG
                    </span>

                    <span className="team-roster-stat">
                      {player.seasonStats?.rpg?.toFixed(1) ?? '0.0'} RPG
                    </span>

                    <span className="team-roster-stat">
                      {player.seasonStats?.apg?.toFixed(1) ?? '0.0'} APG
                    </span>

                    <span className="team-roster-stat">
                      {player.seasonStats?.spg?.toFixed(1) ?? '0.0'} SPG
                    </span>

                    <span className="team-roster-stat">
                      {player.seasonStats?.bpg?.toFixed(1) ?? '0.0'} BPG
                    </span>

                    <span className="team-roster-stat">
                      {((player.seasonStats?.fgPct ?? 0) * 100).toFixed(1)} FG%
                    </span>

                    <span className="team-roster-stat">
                      {((player.seasonStats?.threePct ?? 0) * 100).toFixed(1)}{' '}
                      3P%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
