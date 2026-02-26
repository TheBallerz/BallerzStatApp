import DivisionCard from "../components/teams/DivisionCard";
import { divisions } from "../__mocks__/mockTeams";
import TopNav from "../components/layout/TopNav";
import "./teamsPage.css";

export default function TeamsPage() {
  return (
    <div className="teams-page">
      <TopNav />
      <div className="division-grid">
        {divisions.map((division) => (
          <DivisionCard key={division.name} division={division} />
        ))}
      </div>
    </div>
  );
}