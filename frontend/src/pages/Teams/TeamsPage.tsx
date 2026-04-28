import { useState } from "react";
import DivisionCard from "../../components/teams/DivisionCard";
import TeamDetailPanel from "../../components/teams/TeamDetailPanel";
import { divisions } from "../../__mocks__/mockTeams";
import "./teamsPage.css";

type SelectedTeam = {
  name: string;
  division: string;
};

export default function TeamsPage() {
  const [selectedTeams, setSelectedTeams] = useState<SelectedTeam[]>([]);

  const handleTeamClick = (team: SelectedTeam) => {
    setSelectedTeams((prev) => {
      const alreadySelected = prev.some((s) => s.name === team.name);
      if (alreadySelected) {
        return prev.filter((s) => s.name !== team.name);
      }
      if (prev.length < 2) {
        return [...prev, team];
      }
      // Two panels already open: replace the oldest with the new selection
      return [prev[1], team];
    });
  };

  const handleClose = (teamName: string) => {
    setSelectedTeams((prev) => prev.filter((s) => s.name !== teamName));
  };

  const hasPanel = selectedTeams.length > 0;

  return (
    <div className={`teams-page ${hasPanel ? "has-panel" : ""}`}>
      {/* ── Division list ─────────────────────────────────── */}
      <div className={hasPanel ? "teams-list" : "division-grid"}>
        {divisions.map((division) => (
          <DivisionCard
            key={division.name}
            division={division}
            selectedTeams={selectedTeams}
            onTeamClick={handleTeamClick}
          />
        ))}
      </div>

      {/* ── Team detail panels ────────────────────────────── */}
      {hasPanel && (
        <div className={`team-panels-container panels-${selectedTeams.length}`}>
          {selectedTeams.map((team) => (
            <TeamDetailPanel
              key={team.name}
              team={team}
              onClose={() => handleClose(team.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
