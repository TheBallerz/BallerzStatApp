import { useEffect, useState } from "react";
import { TEAM_LOGOS } from "../../assets/teamLogos";
import { fetchTeam } from "../../services/nbaApi";
import "./teamDetailPanel.css";

type SelectedTeam = {
  name: string;
  division: string;
  teamId: number;
  primaryColor?: string;
  secondaryColor?: string;
};

type TeamDetail = {
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

type Props = {
  team: SelectedTeam;
  onClose: () => void;
};

export default function TeamDetailPanel({ team, onClose }: Props) {
  const logoSrc = TEAM_LOGOS?.[team.name];
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTeamDetail() {
      try {
        setLoading(true);
        setError("");

        const data = await fetchTeam(team.teamId);
        setTeamDetail(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load team data.");
      } finally {
        setLoading(false);
      }
    }

    loadTeamDetail();
  }, [team.teamId]);

  return (
    <div
        className="team-detail-panel"
        style={
          {
            "--team-primary": team.primaryColor,
            "--team-secondary": team.secondaryColor,
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
              {teamDetail ? `${teamDetail.division} Division` : `${team.division} Division`}
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
            <span className="team-stat-value">{error || "No data found"}</span>
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
              <span className="team-stat-value">{(teamDetail.fgPct * 100).toFixed(1)}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}