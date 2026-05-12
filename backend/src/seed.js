'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/database');
const Team = require('./models/Team');
const Player = require('./models/Player');
const { getTeams, getPlayers } = require('./nbaApi');
const { rowsToObjects } = require('./utils/nbaUtils');

// ---------------------------------------------------------------------------
// Helpers for NBA API enrichment
// ---------------------------------------------------------------------------

/**
 * Normalizes a player name for fuzzy matching between our seed data and the
 * NBA API's display names. Handles accents, apostrophes, dots, and case.
 * Mirrors the normalizeName() function in enrichPlayers.js.
 */
function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks (accents)
    .replace(/[^a-z0-9\s]/gi, '')    // strip punctuation (apostrophes, dots, hyphens)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');           // collapse multiple spaces into one
}

/**
 * The NBA API occasionally returns shortened city names that differ from the
 * full names stored in our seed data. This map resolves known mismatches so
 * the name-based team lookup still finds the correct MongoDB document.
 */
const TEAM_NAME_ALIASES = {
  'LA Clippers': 'Los Angeles Clippers',
};

// ---------------------------------------------------------------------------
// NBA team data — all 30 teams with required schema fields
// ---------------------------------------------------------------------------
const teamsData = [
  // Eastern — Atlantic
  { name: 'Boston Celtics', city: 'Boston', abbreviation: 'BOS', conference: 'Eastern', division: 'Atlantic' },
  { name: 'Brooklyn Nets', city: 'Brooklyn', abbreviation: 'BKN', conference: 'Eastern', division: 'Atlantic' },
  { name: 'New York Knicks', city: 'New York', abbreviation: 'NYK', conference: 'Eastern', division: 'Atlantic' },
  { name: 'Philadelphia 76ers', city: 'Philadelphia', abbreviation: 'PHI', conference: 'Eastern', division: 'Atlantic' },
  { name: 'Toronto Raptors', city: 'Toronto', abbreviation: 'TOR', conference: 'Eastern', division: 'Atlantic' },
  // Eastern — Central
  { name: 'Chicago Bulls', city: 'Chicago', abbreviation: 'CHI', conference: 'Eastern', division: 'Central' },
  { name: 'Cleveland Cavaliers', city: 'Cleveland', abbreviation: 'CLE', conference: 'Eastern', division: 'Central' },
  { name: 'Detroit Pistons', city: 'Detroit', abbreviation: 'DET', conference: 'Eastern', division: 'Central' },
  { name: 'Indiana Pacers', city: 'Indianapolis', abbreviation: 'IND', conference: 'Eastern', division: 'Central' },
  { name: 'Milwaukee Bucks', city: 'Milwaukee', abbreviation: 'MIL', conference: 'Eastern', division: 'Central' },
  // Eastern — Southeast
  { name: 'Atlanta Hawks', city: 'Atlanta', abbreviation: 'ATL', conference: 'Eastern', division: 'Southeast' },
  { name: 'Charlotte Hornets', city: 'Charlotte', abbreviation: 'CHA', conference: 'Eastern', division: 'Southeast' },
  { name: 'Miami Heat', city: 'Miami', abbreviation: 'MIA', conference: 'Eastern', division: 'Southeast' },
  { name: 'Orlando Magic', city: 'Orlando', abbreviation: 'ORL', conference: 'Eastern', division: 'Southeast' },
  { name: 'Washington Wizards', city: 'Washington', abbreviation: 'WAS', conference: 'Eastern', division: 'Southeast' },
  // Western — Northwest
  { name: 'Denver Nuggets', city: 'Denver', abbreviation: 'DEN', conference: 'Western', division: 'Northwest' },
  { name: 'Minnesota Timberwolves', city: 'Minneapolis', abbreviation: 'MIN', conference: 'Western', division: 'Northwest' },
  { name: 'Oklahoma City Thunder', city: 'Oklahoma City', abbreviation: 'OKC', conference: 'Western', division: 'Northwest' },
  { name: 'Portland Trail Blazers', city: 'Portland', abbreviation: 'POR', conference: 'Western', division: 'Northwest' },
  { name: 'Utah Jazz', city: 'Salt Lake City', abbreviation: 'UTA', conference: 'Western', division: 'Northwest' },
  // Western — Pacific
  { name: 'Golden State Warriors', city: 'San Francisco', abbreviation: 'GSW', conference: 'Western', division: 'Pacific' },
  { name: 'Los Angeles Clippers', city: 'Los Angeles', abbreviation: 'LAC', conference: 'Western', division: 'Pacific' },
  { name: 'Los Angeles Lakers', city: 'Los Angeles', abbreviation: 'LAL', conference: 'Western', division: 'Pacific' },
  { name: 'Phoenix Suns', city: 'Phoenix', abbreviation: 'PHX', conference: 'Western', division: 'Pacific' },
  { name: 'Sacramento Kings', city: 'Sacramento', abbreviation: 'SAC', conference: 'Western', division: 'Pacific' },
  // Western — Southwest
  { name: 'Dallas Mavericks', city: 'Dallas', abbreviation: 'DAL', conference: 'Western', division: 'Southwest' },
  { name: 'Houston Rockets', city: 'Houston', abbreviation: 'HOU', conference: 'Western', division: 'Southwest' },
  { name: 'Memphis Grizzlies', city: 'Memphis', abbreviation: 'MEM', conference: 'Western', division: 'Southwest' },
  { name: 'New Orleans Pelicans', city: 'New Orleans', abbreviation: 'NOP', conference: 'Western', division: 'Southwest' },
  { name: 'San Antonio Spurs', city: 'San Antonio', abbreviation: 'SAS', conference: 'Western', division: 'Southwest' },
];

// ---------------------------------------------------------------------------
// Player roster data keyed by team abbreviation
// Fields: firstName, lastName, position, jerseyNumber
// ---------------------------------------------------------------------------
const rosterData = {
  BOS: [
    { firstName: 'Jayson', lastName: 'Tatum', position: 'SF', jerseyNumber: 0 },
    { firstName: 'Jaylen', lastName: 'Brown', position: 'SG', jerseyNumber: 7 },
    { firstName: 'Kristaps', lastName: 'Porzingis', position: 'C', jerseyNumber: 8 },
    { firstName: 'Jrue', lastName: 'Holiday', position: 'PG', jerseyNumber: 4 },
    { firstName: 'Al', lastName: 'Horford', position: 'C', jerseyNumber: 42 },
    { firstName: 'Derrick', lastName: 'White', position: 'SG', jerseyNumber: 9 },
    { firstName: 'Payton', lastName: 'Pritchard', position: 'PG', jerseyNumber: 11 },
    { firstName: 'Sam', lastName: 'Hauser', position: 'SF', jerseyNumber: 30 },
    { firstName: 'Luke', lastName: 'Kornet', position: 'C', jerseyNumber: 2 },
    { firstName: 'Xavier', lastName: 'Tillman', position: 'PF', jerseyNumber: 26 },
  ],
  BKN: [
    { firstName: 'Cam', lastName: 'Thomas', position: 'SG', jerseyNumber: 24 },
    { firstName: 'Ben', lastName: 'Simmons', position: 'PG', jerseyNumber: 10 },
    { firstName: 'Nic', lastName: 'Claxton', position: 'C', jerseyNumber: 33 },
    { firstName: 'Dorian', lastName: 'Finney-Smith', position: 'SF', jerseyNumber: 28 },
    { firstName: 'Dennis', lastName: 'Schroder', position: 'PG', jerseyNumber: 17 },
    { firstName: 'Trendon', lastName: 'Watford', position: 'PF', jerseyNumber: 2 },
    { firstName: 'Day\'Ron', lastName: 'Sharpe', position: 'C', jerseyNumber: 20 },
    { firstName: 'Noah', lastName: 'Clowney', position: 'PF', jerseyNumber: 21 },
  ],
  NYK: [
    { firstName: 'Jalen', lastName: 'Brunson', position: 'PG', jerseyNumber: 11 },
    { firstName: 'Karl-Anthony', lastName: 'Towns', position: 'C', jerseyNumber: 32 },
    { firstName: 'OG', lastName: 'Anunoby', position: 'SF', jerseyNumber: 8 },
    { firstName: 'Mikal', lastName: 'Bridges', position: 'SF', jerseyNumber: 7 },
    { firstName: 'Josh', lastName: 'Hart', position: 'SG', jerseyNumber: 3 },
    { firstName: 'Donte', lastName: 'DiVincenzo', position: 'SG', jerseyNumber: 0 },
    { firstName: 'Mitchell', lastName: 'Robinson', position: 'C', jerseyNumber: 23 },
    { firstName: 'Isaiah', lastName: 'Hartenstein', position: 'C', jerseyNumber: 55 },
    { firstName: 'Miles', lastName: 'McBride', position: 'PG', jerseyNumber: 2 },
    { firstName: 'Precious', lastName: 'Achiuwa', position: 'PF', jerseyNumber: 5 },
  ],
  PHI: [
    { firstName: 'Joel', lastName: 'Embiid', position: 'C', jerseyNumber: 21 },
    { firstName: 'Tyrese', lastName: 'Maxey', position: 'PG', jerseyNumber: 0 },
    { firstName: 'Paul', lastName: 'George', position: 'SF', jerseyNumber: 8 },
    { firstName: 'Kelly', lastName: 'Oubre', position: 'SF', jerseyNumber: 9 },
    { firstName: 'Andre', lastName: 'Drummond', position: 'C', jerseyNumber: 1 },
    { firstName: 'Kyle', lastName: 'Lowry', position: 'PG', jerseyNumber: 7 },
    { firstName: 'Caleb', lastName: 'Martin', position: 'SF', jerseyNumber: 16 },
    { firstName: 'Tobias', lastName: 'Harris', position: 'PF', jerseyNumber: 12 },
    { firstName: 'KJ', lastName: 'Martin', position: 'PF', jerseyNumber: 6 },
  ],
  TOR: [
    { firstName: 'Scottie', lastName: 'Barnes', position: 'SF', jerseyNumber: 4 },
    { firstName: 'Immanuel', lastName: 'Quickley', position: 'PG', jerseyNumber: 5 },
    { firstName: 'RJ', lastName: 'Barrett', position: 'SG', jerseyNumber: 9 },
    { firstName: 'Jakob', lastName: 'Poeltl', position: 'C', jerseyNumber: 19 },
    { firstName: 'Gradey', lastName: 'Dick', position: 'SG', jerseyNumber: 1 },
    { firstName: 'Chris', lastName: 'Boucher', position: 'PF', jerseyNumber: 25 },
    { firstName: 'Bruce', lastName: 'Brown', position: 'SG', jerseyNumber: 11 },
    { firstName: 'Ochai', lastName: 'Agbaji', position: 'SG', jerseyNumber: 30 },
    { firstName: 'Kelly', lastName: 'Olynyk', position: 'C', jerseyNumber: 13 },
  ],
  CHI: [
    { firstName: 'Zach', lastName: 'LaVine', position: 'SG', jerseyNumber: 8 },
    { firstName: 'DeMar', lastName: 'DeRozan', position: 'SF', jerseyNumber: 11 },
    { firstName: 'Nikola', lastName: 'Vucevic', position: 'C', jerseyNumber: 9 },
    { firstName: 'Coby', lastName: 'White', position: 'PG', jerseyNumber: 0 },
    { firstName: 'Patrick', lastName: 'Williams', position: 'PF', jerseyNumber: 44 },
    { firstName: 'Jevon', lastName: 'Carter', position: 'PG', jerseyNumber: 5 },
    { firstName: 'Andre', lastName: 'Drummond', position: 'C', jerseyNumber: 3 },
    { firstName: 'Torrey', lastName: 'Craig', position: 'SF', jerseyNumber: 13 },
  ],
  CLE: [
    { firstName: 'Donovan', lastName: 'Mitchell', position: 'SG', jerseyNumber: 45 },
    { firstName: 'Darius', lastName: 'Garland', position: 'PG', jerseyNumber: 10 },
    { firstName: 'Evan', lastName: 'Mobley', position: 'C', jerseyNumber: 4 },
    { firstName: 'Jarrett', lastName: 'Allen', position: 'C', jerseyNumber: 31 },
    { firstName: 'Max', lastName: 'Strus', position: 'SG', jerseyNumber: 1 },
    { firstName: 'Isaac', lastName: 'Okoro', position: 'SF', jerseyNumber: 35 },
    { firstName: 'Sam', lastName: 'Merrill', position: 'SG', jerseyNumber: 13 },
    { firstName: 'Dean', lastName: 'Wade', position: 'PF', jerseyNumber: 32 },
    { firstName: 'Ty', lastName: 'Jerome', position: 'PG', jerseyNumber: 12 },
  ],
  DET: [
    { firstName: 'Cade', lastName: 'Cunningham', position: 'PG', jerseyNumber: 2 },
    { firstName: 'Jaden', lastName: 'Ivey', position: 'SG', jerseyNumber: 23 },
    { firstName: 'Ausar', lastName: 'Thompson', position: 'SF', jerseyNumber: 5 },
    { firstName: 'Isaiah', lastName: 'Stewart', position: 'C', jerseyNumber: 28 },
    { firstName: 'Bojan', lastName: 'Bogdanovic', position: 'SF', jerseyNumber: 44 },
    { firstName: 'Alec', lastName: 'Burks', position: 'SG', jerseyNumber: 14 },
    { firstName: 'Monte', lastName: 'Morris', position: 'PG', jerseyNumber: 23 },
    { firstName: 'James', lastName: 'Wiseman', position: 'C', jerseyNumber: 13 },
    { firstName: 'Marcus', lastName: 'Sasser', position: 'SG', jerseyNumber: 21 },
  ],
  IND: [
    { firstName: 'Tyrese', lastName: 'Haliburton', position: 'PG', jerseyNumber: 0 },
    { firstName: 'Pascal', lastName: 'Siakam', position: 'PF', jerseyNumber: 43 },
    { firstName: 'Myles', lastName: 'Turner', position: 'C', jerseyNumber: 33 },
    { firstName: 'Andrew', lastName: 'Nembhard', position: 'PG', jerseyNumber: 2 },
    { firstName: 'Bennedict', lastName: 'Mathurin', position: 'SG', jerseyNumber: 0 },
    { firstName: 'Aaron', lastName: 'Nesmith', position: 'SF', jerseyNumber: 23 },
    { firstName: 'Obi', lastName: 'Toppin', position: 'PF', jerseyNumber: 1 },
    { firstName: 'Isaiah', lastName: 'Jackson', position: 'C', jerseyNumber: 22 },
    { firstName: 'T.J.', lastName: 'McConnell', position: 'PG', jerseyNumber: 9 },
  ],
  MIL: [
    { firstName: 'Giannis', lastName: 'Antetokounmpo', position: 'PF', jerseyNumber: 34 },
    { firstName: 'Damian', lastName: 'Lillard', position: 'PG', jerseyNumber: 0 },
    { firstName: 'Khris', lastName: 'Middleton', position: 'SF', jerseyNumber: 22 },
    { firstName: 'Brook', lastName: 'Lopez', position: 'C', jerseyNumber: 11 },
    { firstName: 'Bobby', lastName: 'Portis', position: 'PF', jerseyNumber: 9 },
    { firstName: 'Malik', lastName: 'Beasley', position: 'SG', jerseyNumber: 5 },
    { firstName: 'Patrick', lastName: 'Beverley', position: 'PG', jerseyNumber: 21 },
    { firstName: 'MarJon', lastName: 'Beauchamp', position: 'SF', jerseyNumber: 12 },
    { firstName: 'AJ', lastName: 'Green', position: 'SG', jerseyNumber: 84 },
  ],
  ATL: [
    { firstName: 'Trae', lastName: 'Young', position: 'PG', jerseyNumber: 11 },
    { firstName: 'Dejounte', lastName: 'Murray', position: 'PG', jerseyNumber: 5 },
    { firstName: 'Clint', lastName: 'Capela', position: 'C', jerseyNumber: 15 },
    { firstName: 'De\'Andre', lastName: 'Hunter', position: 'SF', jerseyNumber: 12 },
    { firstName: 'Saddiq', lastName: 'Bey', position: 'SF', jerseyNumber: 41 },
    { firstName: 'Bogdan', lastName: 'Bogdanovic', position: 'SG', jerseyNumber: 13 },
    { firstName: 'Onyeka', lastName: 'Okongwu', position: 'C', jerseyNumber: 17 },
    { firstName: 'Garrison', lastName: 'Mathews', position: 'SG', jerseyNumber: 8 },
    { firstName: 'Kobe', lastName: 'Bufkin', position: 'SG', jerseyNumber: 4 },
  ],
  CHA: [
    { firstName: 'LaMelo', lastName: 'Ball', position: 'PG', jerseyNumber: 1 },
    { firstName: 'Miles', lastName: 'Bridges', position: 'SF', jerseyNumber: 0 },
    { firstName: 'Brandon', lastName: 'Miller', position: 'SF', jerseyNumber: 24 },
    { firstName: 'Mark', lastName: 'Williams', position: 'C', jerseyNumber: 5 },
    { firstName: 'Terry', lastName: 'Rozier', position: 'SG', jerseyNumber: 3 },
    { firstName: 'Grant', lastName: 'Williams', position: 'PF', jerseyNumber: 2 },
    { firstName: 'Tre', lastName: 'Mann', position: 'SG', jerseyNumber: 23 },
    { firstName: 'Nick', lastName: 'Richards', position: 'C', jerseyNumber: 4 },
    { firstName: 'Seth', lastName: 'Curry', position: 'SG', jerseyNumber: 30 },
  ],
  MIA: [
    { firstName: 'Jimmy', lastName: 'Butler', position: 'SF', jerseyNumber: 22 },
    { firstName: 'Bam', lastName: 'Adebayo', position: 'C', jerseyNumber: 13 },
    { firstName: 'Tyler', lastName: 'Herro', position: 'SG', jerseyNumber: 14 },
    { firstName: 'Terry', lastName: 'Rozier', position: 'SG', jerseyNumber: 2 },
    { firstName: 'Kevin', lastName: 'Love', position: 'PF', jerseyNumber: 42 },
    { firstName: 'Caleb', lastName: 'Martin', position: 'SF', jerseyNumber: 16 },
    { firstName: 'Duncan', lastName: 'Robinson', position: 'SG', jerseyNumber: 55 },
    { firstName: 'Haywood', lastName: 'Highsmith', position: 'SF', jerseyNumber: 24 },
    { firstName: 'Josh', lastName: 'Richardson', position: 'SG', jerseyNumber: 0 },
  ],
  ORL: [
    { firstName: 'Paolo', lastName: 'Banchero', position: 'PF', jerseyNumber: 5 },
    { firstName: 'Franz', lastName: 'Wagner', position: 'SF', jerseyNumber: 22 },
    { firstName: 'Wendell', lastName: 'Carter', position: 'C', jerseyNumber: 34 },
    { firstName: 'Markelle', lastName: 'Fultz', position: 'PG', jerseyNumber: 20 },
    { firstName: 'Jalen', lastName: 'Suggs', position: 'PG', jerseyNumber: 4 },
    { firstName: 'Cole', lastName: 'Anthony', position: 'PG', jerseyNumber: 50 },
    { firstName: 'Jonathan', lastName: 'Isaac', position: 'PF', jerseyNumber: 1 },
    { firstName: 'Moritz', lastName: 'Wagner', position: 'C', jerseyNumber: 21 },
    { firstName: 'Joe', lastName: 'Ingles', position: 'SF', jerseyNumber: 7 },
  ],
  WAS: [
    { firstName: 'Kyle', lastName: 'Kuzma', position: 'PF', jerseyNumber: 33 },
    { firstName: 'Bradley', lastName: 'Beal', position: 'SG', jerseyNumber: 3 },
    { firstName: 'Jordan', lastName: 'Poole', position: 'SG', jerseyNumber: 13 },
    { firstName: 'Kristaps', lastName: 'Porzingis', position: 'C', jerseyNumber: 6 },
    { firstName: 'Deni', lastName: 'Avdija', position: 'SF', jerseyNumber: 8 },
    { firstName: 'Tyus', lastName: 'Jones', position: 'PG', jerseyNumber: 5 },
    { firstName: 'Corey', lastName: 'Kispert', position: 'SF', jerseyNumber: 18 },
    { firstName: 'Daniel', lastName: 'Gafford', position: 'C', jerseyNumber: 12 },
    { firstName: 'Richaun', lastName: 'Holmes', position: 'C', jerseyNumber: 22 },
  ],
  DEN: [
    { firstName: 'Nikola', lastName: 'Jokic', position: 'C', jerseyNumber: 15 },
    { firstName: 'Jamal', lastName: 'Murray', position: 'PG', jerseyNumber: 27 },
    { firstName: 'Michael', lastName: 'Porter', position: 'SF', jerseyNumber: 1 },
    { firstName: 'Aaron', lastName: 'Gordon', position: 'PF', jerseyNumber: 50 },
    { firstName: 'Kentavious', lastName: 'Caldwell-Pope', position: 'SG', jerseyNumber: 5 },
    { firstName: 'Reggie', lastName: 'Jackson', position: 'PG', jerseyNumber: 7 },
    { firstName: 'Peyton', lastName: 'Watson', position: 'SF', jerseyNumber: 8 },
    { firstName: 'Julian', lastName: 'Strawther', position: 'SG', jerseyNumber: 3 },
    { firstName: 'DeAndre', lastName: 'Jordan', position: 'C', jerseyNumber: 6 },
  ],
  MIN: [
    { firstName: 'Anthony', lastName: 'Edwards', position: 'SG', jerseyNumber: 5 },
    { firstName: 'Karl-Anthony', lastName: 'Towns', position: 'C', jerseyNumber: 32 },
    { firstName: 'Rudy', lastName: 'Gobert', position: 'C', jerseyNumber: 27 },
    { firstName: 'Mike', lastName: 'Conley', position: 'PG', jerseyNumber: 10 },
    { firstName: 'Jaden', lastName: 'McDaniels', position: 'SF', jerseyNumber: 3 },
    { firstName: 'Nickeil', lastName: 'Alexander-Walker', position: 'SG', jerseyNumber: 9 },
    { firstName: 'Naz', lastName: 'Reid', position: 'C', jerseyNumber: 11 },
    { firstName: 'Kyle', lastName: 'Anderson', position: 'SF', jerseyNumber: 1 },
    { firstName: 'Monte', lastName: 'Morris', position: 'PG', jerseyNumber: 23 },
  ],
  OKC: [
    { firstName: 'Shai', lastName: 'Gilgeous-Alexander', position: 'PG', jerseyNumber: 2 },
    { firstName: 'Jalen', lastName: 'Williams', position: 'SG', jerseyNumber: 8 },
    { firstName: 'Chet', lastName: 'Holmgren', position: 'C', jerseyNumber: 7 },
    { firstName: 'Josh', lastName: 'Giddey', position: 'PG', jerseyNumber: 3 },
    { firstName: 'Luguentz', lastName: 'Dort', position: 'SG', jerseyNumber: 5 },
    { firstName: 'Isaiah', lastName: 'Joe', position: 'SG', jerseyNumber: 11 },
    { firstName: 'Aaron', lastName: 'Wiggins', position: 'SG', jerseyNumber: 21 },
    { firstName: 'Kenrich', lastName: 'Williams', position: 'SF', jerseyNumber: 34 },
    { firstName: 'Ousmane', lastName: 'Dieng', position: 'SF', jerseyNumber: 13 },
  ],
  POR: [
    { firstName: 'Anfernee', lastName: 'Simons', position: 'PG', jerseyNumber: 1 },
    { firstName: 'Jerami', lastName: 'Grant', position: 'SF', jerseyNumber: 9 },
    { firstName: 'Deandre', lastName: 'Ayton', position: 'C', jerseyNumber: 2 },
    { firstName: 'Scoot', lastName: 'Henderson', position: 'PG', jerseyNumber: 0 },
    { firstName: 'Shaedon', lastName: 'Sharpe', position: 'SG', jerseyNumber: 17 },
    { firstName: 'Toumani', lastName: 'Camara', position: 'SF', jerseyNumber: 33 },
    { firstName: 'Matisse', lastName: 'Thybulle', position: 'SG', jerseyNumber: 4 },
    { firstName: 'Robert', lastName: 'Williams', position: 'C', jerseyNumber: 35 },
    { firstName: 'Jabari', lastName: 'Walker', position: 'PF', jerseyNumber: 34 },
  ],
  UTA: [
    { firstName: 'Lauri', lastName: 'Markkanen', position: 'PF', jerseyNumber: 23 },
    { firstName: 'Jordan', lastName: 'Clarkson', position: 'SG', jerseyNumber: 0 },
    { firstName: 'Collin', lastName: 'Sexton', position: 'PG', jerseyNumber: 2 },
    { firstName: 'Keyonte', lastName: 'George', position: 'PG', jerseyNumber: 3 },
    { firstName: 'Walker', lastName: 'Kessler', position: 'C', jerseyNumber: 24 },
    { firstName: 'Taylor', lastName: 'Hendricks', position: 'PF', jerseyNumber: 0 },
    { firstName: 'Ochai', lastName: 'Agbaji', position: 'SG', jerseyNumber: 30 },
    { firstName: 'Talen', lastName: 'Horton-Tucker', position: 'SG', jerseyNumber: 5 },
    { firstName: 'John', lastName: 'Collins', position: 'PF', jerseyNumber: 20 },
  ],
  GSW: [
    { firstName: 'Stephen', lastName: 'Curry', position: 'PG', jerseyNumber: 30 },
    { firstName: 'Klay', lastName: 'Thompson', position: 'SG', jerseyNumber: 11 },
    { firstName: 'Draymond', lastName: 'Green', position: 'PF', jerseyNumber: 23 },
    { firstName: 'Andrew', lastName: 'Wiggins', position: 'SF', jerseyNumber: 22 },
    { firstName: 'Kevon', lastName: 'Looney', position: 'C', jerseyNumber: 5 },
    { firstName: 'Chris', lastName: 'Paul', position: 'PG', jerseyNumber: 3 },
    { firstName: 'Jonathan', lastName: 'Kuminga', position: 'SF', jerseyNumber: 0 },
    { firstName: 'Moses', lastName: 'Moody', position: 'SG', jerseyNumber: 4 },
    { firstName: 'Brandin', lastName: 'Podziemski', position: 'SG', jerseyNumber: 2 },
  ],
  LAC: [
    { firstName: 'Kawhi', lastName: 'Leonard', position: 'SF', jerseyNumber: 2 },
    { firstName: 'Paul', lastName: 'George', position: 'SF', jerseyNumber: 13 },
    { firstName: 'James', lastName: 'Harden', position: 'PG', jerseyNumber: 1 },
    { firstName: 'Ivica', lastName: 'Zubac', position: 'C', jerseyNumber: 40 },
    { firstName: 'Russell', lastName: 'Westbrook', position: 'PG', jerseyNumber: 0 },
    { firstName: 'Norman', lastName: 'Powell', position: 'SG', jerseyNumber: 24 },
    { firstName: 'Terance', lastName: 'Mann', position: 'SG', jerseyNumber: 14 },
    { firstName: 'Mason', lastName: 'Plumlee', position: 'C', jerseyNumber: 44 },
    { firstName: 'Bones', lastName: 'Hyland', position: 'PG', jerseyNumber: 5 },
  ],
  LAL: [
    { firstName: 'LeBron', lastName: 'James', position: 'SF', jerseyNumber: 23 },
    { firstName: 'Anthony', lastName: 'Davis', position: 'C', jerseyNumber: 3 },
    { firstName: 'Austin', lastName: 'Reaves', position: 'SG', jerseyNumber: 15 },
    { firstName: 'D\'Angelo', lastName: 'Russell', position: 'PG', jerseyNumber: 1 },
    { firstName: 'Rui', lastName: 'Hachimura', position: 'PF', jerseyNumber: 28 },
    { firstName: 'Taurean', lastName: 'Prince', position: 'SF', jerseyNumber: 12 },
    { firstName: 'Christian', lastName: 'Wood', position: 'C', jerseyNumber: 35 },
    { firstName: 'Gabe', lastName: 'Vincent', position: 'PG', jerseyNumber: 7 },
    { firstName: 'Cam', lastName: 'Reddish', position: 'SF', jerseyNumber: 5 },
  ],
  PHX: [
    { firstName: 'Kevin', lastName: 'Durant', position: 'SF', jerseyNumber: 35 },
    { firstName: 'Devin', lastName: 'Booker', position: 'SG', jerseyNumber: 1 },
    { firstName: 'Bradley', lastName: 'Beal', position: 'SG', jerseyNumber: 3 },
    { firstName: 'Jusuf', lastName: 'Nurkic', position: 'C', jerseyNumber: 20 },
    { firstName: 'Grayson', lastName: 'Allen', position: 'SG', jerseyNumber: 8 },
    { firstName: 'Eric', lastName: 'Gordon', position: 'SG', jerseyNumber: 10 },
    { firstName: 'Drew', lastName: 'Eubanks', position: 'C', jerseyNumber: 14 },
    { firstName: 'Royce', lastName: 'O\'Neale', position: 'SF', jerseyNumber: 0 },
    { firstName: 'Bol', lastName: 'Bol', position: 'C', jerseyNumber: 11 },
  ],
  SAC: [
    { firstName: 'De\'Aaron', lastName: 'Fox', position: 'PG', jerseyNumber: 5 },
    { firstName: 'Domantas', lastName: 'Sabonis', position: 'C', jerseyNumber: 10 },
    { firstName: 'Keegan', lastName: 'Murray', position: 'SF', jerseyNumber: 13 },
    { firstName: 'Kevin', lastName: 'Huerter', position: 'SG', jerseyNumber: 9 },
    { firstName: 'Harrison', lastName: 'Barnes', position: 'SF', jerseyNumber: 40 },
    { firstName: 'Malik', lastName: 'Monk', position: 'PG', jerseyNumber: 0 },
    { firstName: 'Trey', lastName: 'Lyles', position: 'PF', jerseyNumber: 41 },
    { firstName: 'Alex', lastName: 'Len', position: 'C', jerseyNumber: 25 },
    { firstName: 'Keon', lastName: 'Ellis', position: 'SG', jerseyNumber: 23 },
  ],
  DAL: [
    { firstName: 'Luka', lastName: 'Doncic', position: 'PG', jerseyNumber: 77 },
    { firstName: 'Kyrie', lastName: 'Irving', position: 'PG', jerseyNumber: 11 },
    { firstName: 'Tim', lastName: 'Hardaway', position: 'SG', jerseyNumber: 10 },
    { firstName: 'Dereck', lastName: 'Lively', position: 'C', jerseyNumber: 2 },
    { firstName: 'Maxi', lastName: 'Kleber', position: 'PF', jerseyNumber: 42 },
    { firstName: 'Josh', lastName: 'Green', position: 'SG', jerseyNumber: 8 },
    { firstName: 'Dante', lastName: 'Exum', position: 'PG', jerseyNumber: 0 },
    { firstName: 'Dwight', lastName: 'Powell', position: 'C', jerseyNumber: 7 },
    { firstName: 'Grant', lastName: 'Williams', position: 'PF', jerseyNumber: 3 },
  ],
  HOU: [
    { firstName: 'Alperen', lastName: 'Sengun', position: 'C', jerseyNumber: 28 },
    { firstName: 'Jalen', lastName: 'Green', position: 'SG', jerseyNumber: 4 },
    { firstName: 'Fred', lastName: 'VanVleet', position: 'PG', jerseyNumber: 5 },
    { firstName: 'Dillon', lastName: 'Brooks', position: 'SF', jerseyNumber: 11 },
    { firstName: 'Jabari', lastName: 'Smith', position: 'PF', jerseyNumber: 1 },
    { firstName: 'Amen', lastName: 'Thompson', position: 'SF', jerseyNumber: 1 },
    { firstName: 'Tari', lastName: 'Eason', position: 'PF', jerseyNumber: 17 },
    { firstName: 'Jeff', lastName: 'Green', position: 'PF', jerseyNumber: 32 },
    { firstName: 'Aaron', lastName: 'Holiday', position: 'PG', jerseyNumber: 0 },
  ],
  MEM: [
    { firstName: 'Ja', lastName: 'Morant', position: 'PG', jerseyNumber: 12 },
    { firstName: 'Desmond', lastName: 'Bane', position: 'SG', jerseyNumber: 22 },
    { firstName: 'Jaren', lastName: 'Jackson', position: 'C', jerseyNumber: 13 },
    { firstName: 'Marcus', lastName: 'Smart', position: 'PG', jerseyNumber: 36 },
    { firstName: 'GG', lastName: 'Jackson', position: 'PF', jerseyNumber: 45 },
    { firstName: 'Derrick', lastName: 'Rose', position: 'PG', jerseyNumber: 25 },
    { firstName: 'Luke', lastName: 'Kennard', position: 'SG', jerseyNumber: 3 },
    { firstName: 'Santi', lastName: 'Aldama', position: 'PF', jerseyNumber: 7 },
    { firstName: 'Brandon', lastName: 'Clarke', position: 'PF', jerseyNumber: 15 },
  ],
  NOP: [
    { firstName: 'Zion', lastName: 'Williamson', position: 'PF', jerseyNumber: 1 },
    { firstName: 'Brandon', lastName: 'Ingram', position: 'SF', jerseyNumber: 14 },
    { firstName: 'CJ', lastName: 'McCollum', position: 'SG', jerseyNumber: 3 },
    { firstName: 'Herbert', lastName: 'Jones', position: 'SF', jerseyNumber: 5 },
    { firstName: 'Jonas', lastName: 'Valanciunas', position: 'C', jerseyNumber: 17 },
    { firstName: 'Trey', lastName: 'Murphy', position: 'SF', jerseyNumber: 25 },
    { firstName: 'Larry', lastName: 'Nance', position: 'PF', jerseyNumber: 22 },
    { firstName: 'Dyson', lastName: 'Daniels', position: 'SG', jerseyNumber: 11 },
    { firstName: 'Jose', lastName: 'Alvarado', position: 'PG', jerseyNumber: 15 },
  ],
  SAS: [
    { firstName: 'Victor', lastName: 'Wembanyama', position: 'C', jerseyNumber: 1 },
    { firstName: 'Devin', lastName: 'Vassell', position: 'SG', jerseyNumber: 24 },
    { firstName: 'Jeremy', lastName: 'Sochan', position: 'PF', jerseyNumber: 10 },
    { firstName: 'Keldon', lastName: 'Johnson', position: 'SF', jerseyNumber: 3 },
    { firstName: 'Tre', lastName: 'Jones', position: 'PG', jerseyNumber: 33 },
    { firstName: 'Malaki', lastName: 'Branham', position: 'SG', jerseyNumber: 22 },
    { firstName: 'Blake', lastName: 'Wesley', position: 'SG', jerseyNumber: 14 },
    { firstName: 'Charles', lastName: 'Bassey', position: 'C', jerseyNumber: 7 },
    { firstName: 'Julian', lastName: 'Champagnie', position: 'SF', jerseyNumber: 2 },
  ],
};

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function seed() {
  await connectDB();

  // Clear existing data so the script is safely re-runnable
  await Player.deleteMany({});
  await Team.deleteMany({});
  console.log('Cleared existing teams and players.');

  // Insert all 30 teams
  const insertedTeams = await Team.insertMany(teamsData);
  console.log(`Inserted ${insertedTeams.length} teams.`);

  // Build a lookup map: abbreviation → team _id
  const teamIdByAbbr = {};
  for (const team of insertedTeams) {
    teamIdByAbbr[team.abbreviation] = team._id;
  }

  // Insert players for each team and collect their _ids per team
  let totalPlayers = 0;
  const playerIdsByAbbr = {};
  const allInsertedPlayers = []; // kept for nbaId enrichment below

  for (const [abbr, players] of Object.entries(rosterData)) {
    const teamId = teamIdByAbbr[abbr];
    if (!teamId) {
      console.warn(`No team found for abbreviation: ${abbr}`);
      continue;
    }

    // Attach teamId to each player record before inserting
    const playersWithTeam = players.map((p) => ({ ...p, teamId }));
    const inserted = await Player.insertMany(playersWithTeam);
    playerIdsByAbbr[abbr] = inserted.map((p) => p._id);
    allInsertedPlayers.push(...inserted);
    totalPlayers += inserted.length;
  }
  console.log(`Inserted ${totalPlayers} players.`);

  // Update each team's roster array with the inserted player _ids
  for (const [abbr, playerIds] of Object.entries(playerIdsByAbbr)) {
    await Team.findByIdAndUpdate(teamIdByAbbr[abbr], { roster: playerIds });
  }
  console.log('Updated all team rosters.');

  // ── Phase 4: Populate team nbaIds (one API call — same as sync:team-ids) ────
  // This is the same logic as syncTeamNbaIds.js but inlined so a fresh seed
  // never leaves teams without an nbaId. The nightly sync requires team nbaIds
  // to link incoming game data to the correct Team document.
  console.log('\nFetching team nbaIds from NBA API...');
  try {
    const teamData = await getTeams();
    const teamResultSet =
      teamData.resultSets?.find((s) => s.name === 'LeagueDashTeamStats') ||
      teamData.resultSets?.[0];

    if (!teamResultSet) throw new Error('LeagueDashTeamStats result set not found');

    const apiTeams = rowsToObjects(teamResultSet);
    let teamsUpdated = 0;

    for (const apiTeam of apiTeams) {
      const nbaId    = apiTeam.TEAM_ID;
      const teamName = TEAM_NAME_ALIASES[apiTeam.TEAM_NAME] ?? apiTeam.TEAM_NAME;
      if (!nbaId || !teamName) continue;

      const result = await Team.findOneAndUpdate(
        { name: teamName },
        { $set: { nbaId } },
      );
      if (result) teamsUpdated++;
    }

    console.log(`  ✓ Team nbaIds populated for ${teamsUpdated}/30 teams.`);
  } catch (err) {
    console.warn(`  ⚠ Could not fetch team nbaIds from NBA API: ${err.message}`);
    console.warn('  Run "npm run sync:team-ids" after seeding to populate them.');
  }

  // ── Phase 5: Populate player nbaIds (ONE bulk API call) ─────────────────────
  // commonallplayers returns every active player's PERSON_ID in a single request.
  // We match seeded players to API players by normalized name, then write nbaId
  // and imageUrl in one update per matched player. This replaces the need to run
  // "npm run sync:players" (enrichPlayers.js) for basic nbaId setup — that script
  // still adds extra profile fields (height, weight, birthDate, etc.) if desired.
  console.log('\nFetching player nbaIds from NBA API (single bulk call)...');
  try {
    const playerData = await getPlayers('1');
    const playerResultSet =
      playerData.resultSets?.find((s) => s.name === 'CommonAllPlayers') ||
      playerData.resultSet;

    if (!playerResultSet) throw new Error('CommonAllPlayers result set not found');

    // Filter to only roster-active players (same filter as enrichPlayers.js).
    const apiPlayers = rowsToObjects(playerResultSet).filter(
      (p) => p.ROSTERSTATUS === 1 || p.ROSTERSTATUS === '1',
    );

    // Build a normalized-name → nbaId lookup from the API response.
    const nbaIdByNormalizedName = new Map();
    for (const p of apiPlayers) {
      const key = normalizeName(p.DISPLAY_FIRST_LAST);
      nbaIdByNormalizedName.set(key, p.PERSON_ID);
    }

    let playersEnriched = 0;
    let playersNotFound = 0;

    for (const player of allInsertedPlayers) {
      const key   = normalizeName(`${player.firstName} ${player.lastName}`);
      const nbaId = nbaIdByNormalizedName.get(key);

      if (!nbaId) {
        // Player not on the current active roster (e.g., traded, retired, or a
        // name mismatch between our seed data and the NBA API). Not fatal.
        playersNotFound++;
        continue;
      }

      await Player.findByIdAndUpdate(player._id, {
        $set: {
          nbaId,
          // CDN headshot URL is deterministic from nbaId — no extra API call needed.
          imageUrl: `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`,
        },
      });
      playersEnriched++;
    }

    console.log(`  ✓ Player nbaIds populated: ${playersEnriched} matched, ${playersNotFound} not in active roster.`);
    if (playersNotFound > 0) {
      console.log('  (Unmatched players may be on different teams or retired.');
      console.log('   Run "npm run sync:players" for full roster coverage.)');
    }
  } catch (err) {
    console.warn(`  ⚠ Could not fetch player nbaIds from NBA API: ${err.message}`);
    console.warn('  Run "npm run sync:players" after seeding to populate them.');
  }

  console.log('\nSeeding complete.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
