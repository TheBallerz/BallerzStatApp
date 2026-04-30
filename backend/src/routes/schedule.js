const express = require('express');
const router  = express.Router();
const { nbaGet, CURRENT_SEASON } = require('../nbaApi');
const { rowsToObjects }          = require('../utils/nbaUtils');

// ── Team metadata (abbreviation → NBA numeric ID + name) ─────────────────────
// Used to build Team-shaped objects without hitting MongoDB.
const NBA_TEAMS = {
  ATL: { id: 1610612737, name: 'Hawks',         city: 'Atlanta'        },
  BOS: { id: 1610612738, name: 'Celtics',        city: 'Boston'         },
  BKN: { id: 1610612751, name: 'Nets',           city: 'Brooklyn'       },
  CHA: { id: 1610612766, name: 'Hornets',        city: 'Charlotte'      },
  CHI: { id: 1610612741, name: 'Bulls',          city: 'Chicago'        },
  CLE: { id: 1610612739, name: 'Cavaliers',      city: 'Cleveland'      },
  DAL: { id: 1610612742, name: 'Mavericks',      city: 'Dallas'         },
  DEN: { id: 1610612743, name: 'Nuggets',        city: 'Denver'         },
  DET: { id: 1610612765, name: 'Pistons',        city: 'Detroit'        },
  GSW: { id: 1610612744, name: 'Warriors',       city: 'Golden State'   },
  HOU: { id: 1610612745, name: 'Rockets',        city: 'Houston'        },
  IND: { id: 1610612754, name: 'Pacers',         city: 'Indiana'        },
  LAC: { id: 1610612746, name: 'Clippers',       city: 'Los Angeles'    },
  LAL: { id: 1610612747, name: 'Lakers',         city: 'Los Angeles'    },
  MEM: { id: 1610612763, name: 'Grizzlies',      city: 'Memphis'        },
  MIA: { id: 1610612748, name: 'Heat',           city: 'Miami'          },
  MIL: { id: 1610612749, name: 'Bucks',          city: 'Milwaukee'      },
  MIN: { id: 1610612750, name: 'Timberwolves',   city: 'Minnesota'      },
  NOP: { id: 1610612740, name: 'Pelicans',       city: 'New Orleans'    },
  NYK: { id: 1610612752, name: 'Knicks',         city: 'New York'       },
  OKC: { id: 1610612760, name: 'Thunder',        city: 'Oklahoma City'  },
  ORL: { id: 1610612753, name: 'Magic',          city: 'Orlando'        },
  PHI: { id: 1610612755, name: '76ers',          city: 'Philadelphia'   },
  PHX: { id: 1610612756, name: 'Suns',           city: 'Phoenix'        },
  POR: { id: 1610612757, name: 'Trail Blazers',  city: 'Portland'       },
  SAC: { id: 1610612758, name: 'Kings',          city: 'Sacramento'     },
  SAS: { id: 1610612759, name: 'Spurs',          city: 'San Antonio'    },
  TOR: { id: 1610612761, name: 'Raptors',        city: 'Toronto'        },
  UTA: { id: 1610612762, name: 'Jazz',           city: 'Utah'           },
  WAS: { id: 1610612764, name: 'Wizards',        city: 'Washington'     },
};

// Reverse lookup: numeric NBA team ID → abbreviation string
const ID_TO_ABBR = Object.fromEntries(
  Object.entries(NBA_TEAMS).map(([abbr, info]) => [info.id, abbr])
);

// Builds a frontend-compatible Team object from an abbreviation.
// _id is the numeric NBA team ID cast to a string so the frontend
// can use it as a React key and for logo CDN lookups.
function buildTeam(abbr) {
  const info = NBA_TEAMS[abbr?.toUpperCase()];
  if (!info) {
    // Unknown abbreviation — return a minimal placeholder so the UI
    // doesn't crash if a game involves a team not in the table.
    return { _id: abbr ?? 'UNK', abbreviation: abbr ?? '?', name: '', city: '' };
  }
  return {
    _id:          String(info.id),
    abbreviation: abbr.toUpperCase(),
    name:         info.name,
    city:         info.city,
  };
}

// Formats a JavaScript Date as "MM/DD/YYYY" — the format stats.nba.com
// GameDate parameters require.
function formatNbaDate(date) {
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// ── GET /api/schedule/today ───────────────────────────────────────────────────
// Returns every NBA game scheduled for today's date using the scoreboardv2
// endpoint. Each game includes both teams, current scores (if in progress or
// final), and a human-readable status string.
//
// scoreboardv2 result sets used:
//   GameHeader  — one row per game: GAME_ID, GAME_DATE_EST, GAME_STATUS_ID,
//                 GAME_STATUS_TEXT, HOME_TEAM_ID, VISITOR_TEAM_ID
//   LineScore   — one row per (game, team): GAME_ID, TEAM_ID, PTS
//
// GAME_STATUS_ID values: 1 = Upcoming, 2 = Live, 3 = Final
router.get('/schedule/today', async (req, res) => {
  try {
    const today = formatNbaDate(new Date());

    const data = await nbaGet('scoreboardv2', {
      GameDate:  today,
      LeagueID:  '00',
      DayOffset: '0',
    });

    const gameHeaderRS = data.resultSets?.find(rs => rs.name === 'GameHeader');
    const lineScoreRS  = data.resultSets?.find(rs => rs.name === 'LineScore');

    if (!gameHeaderRS) return res.json([]);

    const gameHeaders = rowsToObjects(gameHeaderRS);
    const lineScores  = lineScoreRS ? rowsToObjects(lineScoreRS) : [];

    // Map GAME_ID → { [TEAM_ID]: PTS } for O(1) score lookups below.
    const scoreMap = {};
    for (const ls of lineScores) {
      if (!scoreMap[ls.GAME_ID]) scoreMap[ls.GAME_ID] = {};
      scoreMap[ls.GAME_ID][ls.TEAM_ID] = ls.PTS;
    }

    const STATUS = { 1: 'Upcoming', 2: 'Live', 3: 'Final' };

    const games = gameHeaders.map(g => {
      const homeAbbr = ID_TO_ABBR[g.HOME_TEAM_ID]    ?? String(g.HOME_TEAM_ID);
      const awayAbbr = ID_TO_ABBR[g.VISITOR_TEAM_ID] ?? String(g.VISITOR_TEAM_ID);
      const scores   = scoreMap[g.GAME_ID] ?? {};

      return {
        _id:       g.GAME_ID,
        gameDate:  g.GAME_DATE_EST,
        // GAME_STATUS_TEXT is "7:30 pm ET" when upcoming, "Q3 4:22" live, "Final" when done
        startTime: g.GAME_STATUS_TEXT,
        homeTeam:  buildTeam(homeAbbr),
        awayTeam:  buildTeam(awayAbbr),
        homeScore: scores[g.HOME_TEAM_ID]    ?? null,
        awayScore: scores[g.VISITOR_TEAM_ID] ?? null,
        status:    STATUS[g.GAME_STATUS_ID]  ?? 'Upcoming',
      };
    });

    res.json(games);
  } catch (err) {
    console.error("Error fetching today's schedule:", err.message);
    res.status(500).json({ error: "Failed to fetch today's schedule", details: err.message });
  }
});

// ── GET /api/schedule?team=LAL&season=2024-25 ────────────────────────────────
// Returns the full regular-season game log for a single team using the
// teamgamelog endpoint. Each row represents one game result with opponent,
// score, and basic box-score totals.
//
// Query params:
//   team   (required) — team abbreviation, e.g. "LAL"
//   season (optional) — defaults to CURRENT_SEASON
//
// Opponent score is derived as: pts - plus_minus, which is exact.
// Games are returned sorted ascending by date so the frontend can render
// them in chronological order without additional sorting.
router.get('/schedule', async (req, res) => {
  try {
    const abbr   = (req.query.team ?? '').toUpperCase();
    const season = req.query.season ?? CURRENT_SEASON;

    if (!abbr) {
      return res.status(400).json({ error: "'team' query param is required (e.g. ?team=LAL)" });
    }

    const teamInfo = NBA_TEAMS[abbr];
    if (!teamInfo) {
      return res.status(404).json({ error: `Unknown team abbreviation: ${abbr}` });
    }

    const data = await nbaGet('teamgamelog', {
      TeamID:     teamInfo.id,
      Season:     season,
      SeasonType: 'Regular Season',
      LeagueID:   '00',
    });

    const resultSet = data.resultSets?.find(rs => rs.name === 'TeamGameLog');
    if (!resultSet) return res.json([]);

    const rows = rowsToObjects(resultSet);

    const games = rows.map(row => {
      // MATCHUP is "LAL vs. GSW" (home) or "LAL @ GSW" (away).
      // Split on " vs. " or " @ " to extract the opponent abbreviation.
      const isHome      = row.MATCHUP.includes('vs.');
      const parts       = row.MATCHUP.split(/\s+(?:vs\.|@)\s+/);
      const opponentAbbr = (parts[1] ?? '').trim();

      // Opponent score = our points minus our point differential (exact math).
      const oppPoints = Math.round(row.PTS - row.PLUS_MINUS);

      return {
        _id:            String(row.GAME_ID),
        gameDate:       row.GAME_DATE,
        opponentTeamId: buildTeam(opponentAbbr),
        isHome,
        wl:             row.WL,        // "W" or "L"
        points:         row.PTS,
        oppPoints,
        rebounds:       row.REB,
        assists:        row.AST,
        steals:         row.STL,
        blocks:         row.BLK,
        turnovers:      row.TOV,
        plusMinus:      row.PLUS_MINUS,
      };
    });

    // Sort chronologically (NBA API returns newest-first by default).
    games.sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));

    res.json(games);
  } catch (err) {
    console.error('Error fetching team schedule:', err.message);
    res.status(500).json({ error: 'Failed to fetch team schedule', details: err.message });
  }
});

module.exports = router;