// Load variables from the .env file into process.env
require("dotenv").config();

const axios = require('axios');

const NBA_URL = 'https://stats.nba.com/stats';

// Prevents API from blocking user
const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
};

// HTTP GET request to pull from NBA's internal API; Builds URL and returns JSON data
async function nbaGet(path, params = {}) {
   const response = await axios.get(`${NBA_URL}/${path}`, {
    params, headers: NBA_HEADERS,
   });

   return response.data;
}

async function getPlayers(isOnlyCurrentSeason = '1') {
  return nbaGet('commonallplayers', {
    IsOnlyCurrentSeason: isOnlyCurrentSeason,
    LeagueID: '00',
    Season: '2024-25',
  });
}

async function getPlayerCareerStats(playerId) {
  return nbaGet('playercareerstats', {
    PlayerID: playerId,
    PerMode: 'PerGame',
  });
}

async function getTeams() {
  return nbaGet("leaguedashteamstats", {
    Conference: "",
    DateFrom: "",
    DateTo: "",
    Division: "",
    GameScope: "",
    GameSegment: "",
    LastNGames: "0",
    LeagueID: "00",
    Location: "",
    MeasureType: "Base",
    Month: "0",
    OpponentTeamID: "0",
    Outcome: "",
    PORound: "0",
    PaceAdjust: "N",
    PerMode: "PerGame",
    Period: "0",
    PlayerExperience: "",
    PlayerPosition: "",
    PlusMinus: "N",
    Rank: "N",
    Season: "2024-25",
    SeasonType: "Regular Season",
    ShotClockRange: "",
    StarterBench: "",
    TeamID: "0",
    TwoWay: "0",
    VsConference: "",
    VsDivision: "",
  });
}

// Export nbaGet so it can be used in other backend modules
// Returns identity and metadata for a single NBA team from the
// 'teaminfocommon' endpoint.
//
// Input:
//   teamId — NBA team ID (e.g. 1610612738 for Boston Celtics)
//
// Key fields returned in resultSets[0]:
//   TEAM_ID             — unique team identifier
//   TEAM_CITY           — city (e.g. "Boston")
//   TEAM_NAME           — team name (e.g. "Celtics")
//   TEAM_ABBREVIATION   — 3-letter code (e.g. "BOS")
//   TEAM_CONFERENCE     — "East" or "West"
//   TEAM_DIVISION       — division (e.g. "Atlantic")
//   W, L                — wins and losses (also available here)
//
// This function is used to populate:
//   - team header (Boston Celtics)
//   - division label (Atlantic Division)
//   - conference if needed later
//
// Note: This endpoint does NOT include per-game stats like PPG, RPG, APG.
// Those come from getTeams().

async function getTeamInfo(teamId, season = CURRENT_SEASON) {
  return nbaGet('teaminfocommon', {
    LeagueID: '00',
    Season: season,
    SeasonType: 'Regular Season',
    TeamID: teamId,
  });
}

module.exports = {
  nbaGet,
  getPlayers,
  getPlayerCareerStats,
  getTeams,
  getTeamInfo
};
