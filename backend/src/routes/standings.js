const express = require("express");
const router = express.Router();
const TeamSeasonStats = require("../models/TeamSeasonStats");
const Team = require("../models/Team");

router.get("/standings", async (req, res) => {
  try {
    const season = req.query.season || "2025-26";

    const standings = await TeamSeasonStats.find({ season })
      .populate("teamId")
      .lean();

    const formatted = standings
      .filter((row) => row.teamId)
      .map((row) => {
        const winPct =
          row.gamesPlayed > 0 ? Number((row.wins / row.gamesPlayed).toFixed(3)) : 0;

        return {
          teamId: row.teamId._id,
          nbaTeamId: row.nbaTeamId,
          teamName: row.teamId.name || row.teamId.teamName,
          abbreviation: row.teamId.abbreviation,
          conference: row.teamId.conference,
          division: row.teamId.division,
          wins: row.wins,
          losses: row.losses,
          gamesPlayed: row.gamesPlayed,
          winPct,
          avgPoints: row.avgPoints,
          avgRebounds: row.avgRebounds,
          avgAssists: row.avgAssists,
          avgSteals: row.avgSteals,
          avgBlocks: row.avgBlocks,
          avgTurnovers: row.avgTurnovers,
          fgPct: row.fgPct,
          fg3Pct: row.fg3Pct,
          ftPct: row.ftPct,
        };
      });

    const east = formatted
      .filter((team) => team.conference === "East" || team.conference === "Eastern")
      .sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);

    const west = formatted
      .filter((team) => team.conference === "West" || team.conference === "Western")
      .sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);

    res.json({ season, east, west });
  } catch (error) {
    console.error("Error fetching standings:", error.message);
    res.status(500).json({
      error: "Failed to fetch standings",
      details: error.message,
    });
  }
});

module.exports = router;