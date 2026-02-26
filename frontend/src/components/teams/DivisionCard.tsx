import type { Division } from "../../__mocks__/mockTeams";
import "./divisionCard.css";

type Props = {
    division: Division;
  };
  
  export default function DivisionCard({ division }: Props) {
    return (
      <div className="division-card">
        <div className="division-title">{division.name}</div>
  
        <ul>
          {division.teams.map((team) => (
            <li key={team.name} className="team-row">
              <div className="team-logo-placeholder" />
              <span>{team.name}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }