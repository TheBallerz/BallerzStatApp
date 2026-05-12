import { TEAM_LOGOS } from '../../assets/teamLogos';
import './divisionCard.css';

type SelectedTeam = {
  name: string;
  division: string;
  teamId: number;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
};

type Division = {
  name: string;
  teams: SelectedTeam[];
};

type Props = {
  division: Division;
  selectedTeams?: SelectedTeam[];
  onTeamClick?: (team: SelectedTeam) => void;
};

export default function DivisionCard({
  division,
  selectedTeams = [],
  onTeamClick,
}: Props) {
  const teams = division?.teams ?? [];

  return (
    <div className="division-card">
      <div className="division-title">{division.name}</div>

      <ul>
        {teams.map((team) => {
          const logoSrc = TEAM_LOGOS?.[team.name];
          const isSelected = selectedTeams.some((s) => s.name === team.name);

          return (
            <li
              key={team.name}
              className={`team-row ${isSelected ? 'selected' : ''}`}
              style={
                {
                  '--team-primary': team.primaryColor,
                  '--team-secondary': team.secondaryColor,
                } as React.CSSProperties
              }
              onClick={() => onTeamClick?.(team)}
            >
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={`${team.name} logo`}
                  className="team-logo"
                />
              ) : (
                <div className="team-logo-placeholder" />
              )}
              <span className="team-name">{team.name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
