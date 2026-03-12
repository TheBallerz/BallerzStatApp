import type { Division } from "../../__mocks__/mockTeams";
import { TEAM_LOGOS } from "../../assets/teamLogos";
import "./divisionCard.css";

type Props = {
  division: Division;
};

export default function DivisionCard({ division }: Props) {
  const teams = division?.teams ?? []; 
  // TEMP placeholder (later connect to real state)
  const isSelected = false;

  return (
    <div className="division-card">
      <div className="division-title">{division.name}</div>

      <ul>
        {teams.map((team) => {
          const logoSrc = TEAM_LOGOS?.[team.name];
          
          return (
            <li key={team.name} 
            className={`team-row ${isSelected ? "selected" : ""}`}
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