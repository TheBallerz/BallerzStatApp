import { useEffect, useState } from "react";
import DivisionCard from "../../components/teams/DivisionCard";
import TeamDetailPanel from "../../components/teams/TeamDetailPanel";
import { fetchTeams } from "../../services/nbaApi";
import "./teamsPage.css";

type SelectedTeam = {
  name: string;
  division: string;
  teamId: number;
};

type Team = {
  teamId: number;
  teamName: string;
  teamAbbreviation: string;
  wins?: number;
  losses?: number;
  record?: string;
  ppg?: number;
  rpg?: number;
  apg?: number;
  fgPct?: number;
};

type Division = {
  name: string;
  teams: SelectedTeam[];
};

function groupTeamsByDivision(teams: Team[]): Division[] {
  const divisionMap: Record<string, string[]> = {
    Atlantic: ["BOS", "BKN", "NYK", "PHI", "TOR"],
    Central: ["CHI", "CLE", "DET", "IND", "MIL"],
    Southeast: ["ATL", "CHA", "MIA", "ORL", "WAS"],
    Northwest: ["DEN", "MIN", "OKC", "POR", "UTA"],
    Pacific: ["GSW", "LAC", "LAL", "PHX", "SAC"],
    Southwest: ["DAL", "HOU", "MEM", "NOP", "SAS"],
  };

  return Object.entries(divisionMap).map(([divisionName, abbreviations]) => ({
    name: divisionName,
    teams: teams
      .filter((team) => abbreviations.includes(team.teamAbbreviation))
      .map((team) => ({
        name: team.teamName,
        division: divisionName,
        teamId: team.teamId,
      })),
  }));
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<SelectedTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTeams() {
      try {
        setLoading(true);
        setError("");

        const data = await fetchTeams();

        console.log("RAW TEAMS API:", data);

        const mappedTeams: Team[] = data.map((team: Team) => ({
          teamId: team.teamId,
          teamName: team.teamName,
          teamAbbreviation: team.teamAbbreviation,
          wins: team.wins,
          losses: team.losses,
          record: team.record,
          ppg: team.ppg,
          rpg: team.rpg,
          apg: team.apg,
          fgPct: team.fgPct,
        }));

        console.log("MAPPED TEAMS:", mappedTeams);
        console.log("GROUPED DIVISIONS:", groupTeamsByDivision(mappedTeams));

        setTeams(mappedTeams);
      } catch (err) {
        console.error(err);
        setError("Failed to load teams.");
      } finally {
        setLoading(false);
      }
    }

    loadTeams();
  }, []);

  const handleTeamClick = (team: SelectedTeam) => {
    setSelectedTeams((prev) => {
      const alreadySelected = prev.some((s) => s.name === team.name);

      if (alreadySelected) {
        return prev.filter((s) => s.name !== team.name);
      }

      if (prev.length < 2) {
        return [...prev, team];
      }

      return [prev[1], team];
    });
  };

  const handleClose = (teamName: string) => {
    setSelectedTeams((prev) => prev.filter((s) => s.name !== teamName));
  };

  const hasPanel = selectedTeams.length > 0;
  const divisions = groupTeamsByDivision(teams);

  if (loading) {
    return <div className="teams-page">Loading teams...</div>;
  }

  if (error) {
    return <div className="teams-page">{error}</div>;
  }

  return (
    <div className={`teams-page ${hasPanel ? "has-panel" : ""}`}>
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