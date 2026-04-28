import { TEAM_LOGOS } from "../../assets/teamLogos";
import "./teamDetailPanel.css";

type SelectedTeam = {
  name: string;
  division: string;
};

type Props = {
  team: SelectedTeam;
  onClose: () => void;
};

export default function TeamDetailPanel({ team, onClose }: Props) {
  const logoSrc = TEAM_LOGOS?.[team.name];

  return (
    <div className="team-detail-panel">
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
            <h2 className="team-detail-name">{team.name}</h2>
            <span className="team-detail-division">{team.division} Division</span>
          </div>
        </div>
        <button className="team-detail-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="team-detail-divider" />
      <div className="team-detail-body">
        <div className="team-stat-row">
          <span className="team-stat-label">Record</span>
          <span className="team-stat-value">—</span>
        </div>
        <div className="team-stat-row">
          <span className="team-stat-label">PPG</span>
          <span className="team-stat-value">—</span>
        </div>
        <div className="team-stat-row">
          <span className="team-stat-label">RPG</span>
          <span className="team-stat-value">—</span>
        </div>
        <div className="team-stat-row">
          <span className="team-stat-label">APG</span>
          <span className="team-stat-value">—</span>
        </div>
        <div className="team-stat-row">
          <span className="team-stat-label">FG%</span>
          <span className="team-stat-value">—</span>
        </div>
      </div>
    </div>
  );
}
