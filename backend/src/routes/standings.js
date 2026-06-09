const express = require("express");
const router = express.Router();
const TeamSeasonStats = require("../models/TeamSeasonStats");
const Team = require("../models/Team");
const TeamGameStats = require("../models/TeamGameStats");

router.get("/standings", async (req, res) => {
  try {
    const season = req.query.season || "2025-26";
    const type = req.query.type || "season";

    const seasonType =
      type === "finals"
        ? "Playoffs"
        : "Regular Season";

    const gameRows = await TeamGameStats.find({
      season,
      seasonType,
    }).lean();

    const teams = await Team.find().lean();

    const seasonStatsRows = await TeamSeasonStats.find({ season }).lean();

    const seasonStatsByTeamId = {};
    seasonStatsRows.forEach((row) => {
      seasonStatsByTeamId[String(row.teamId)] = row;
    });

    const teamById = {};
    teams.forEach((team) => {
      teamById[String(team._id)] = team;
    });

    const recordByTeamId = {};

    gameRows.forEach((game) => {
      const key = String(game.teamId);

      if (!recordByTeamId[key]) {
        recordByTeamId[key] = {
          wins: 0,
          losses: 0,
          gamesPlayed: 0,
        };
      }

      recordByTeamId[key].gamesPlayed += 1;

      if (game.result === "W") {
        recordByTeamId[key].wins += 1;
      } else if (game.result === "L") {
        recordByTeamId[key].losses += 1;
      }
    });

    const formatted = Object.entries(recordByTeamId)
      .map(([teamId, record]) => {
        const team = teamById[teamId];
        const seasonStats = seasonStatsByTeamId[teamId] || {};
        if (!team) return null;

        const winPct =
          record.gamesPlayed > 0
            ? Number((record.wins / record.gamesPlayed).toFixed(3))
            : 0;

        return {
          teamId: team._id,
          nbaTeamId: team.nbaId,
          teamName: team.name,
          abbreviation: team.abbreviation,
          conference: team.conference,
          division: team.division,
          wins: record.wins,
          losses: record.losses,
          gamesPlayed: record.gamesPlayed,
          winPct,
        
          avgPoints: seasonStats.avgPoints ?? 0,
          avgRebounds: seasonStats.avgRebounds ?? 0,
          avgAssists: seasonStats.avgAssists ?? 0,
          avgSteals: seasonStats.avgSteals ?? 0,
          avgBlocks: seasonStats.avgBlocks ?? 0,
          avgTurnovers: seasonStats.avgTurnovers ?? 0,
          fgPct: seasonStats.fgPct ?? 0,
          fg3Pct: seasonStats.fg3Pct ?? 0,
          ftPct: seasonStats.ftPct ?? 0,
          primaryColor: team.primaryColor,
          secondaryColor: team.secondaryColor,
          logoUrl: team.logoUrl,
        };
      })
      .filter(Boolean);

    const east = formatted
      .filter((team) => team.conference === "East" || team.conference === "Eastern")
      .sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);

    const west = formatted
      .filter((team) => team.conference === "West" || team.conference === "Western")
      .sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);

    res.json({ season, type, seasonType, east, west });
  } catch (error) {
    console.error("Error fetching standings:", error.message);
    res.status(500).json({
      error: "Failed to fetch standings",
      details: error.message,
    });
  }
});
module.exports = router;