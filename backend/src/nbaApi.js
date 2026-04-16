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
module.exports = {
  nbaGet,
  getPlayers,
  getPlayerCareerStats,
  getTeams,
};