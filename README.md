# Ballerz Stat App

[![CI Testing](https://github.com/TheBallerz/BallerzStatApp/actions/workflows/ci-testing.yml/badge.svg)](https://github.com/TheBallerz/BallerzStatApp/actions/workflows/ci-testing.yml)
[![Azure Static Web Apps CI/CD](https://github.com/TheBallerz/BallerzStatApp/actions/workflows/azure-static-web-apps-nice-wave-0b1190a0f.yml/badge.svg)](https://github.com/TheBallerz/BallerzStatApp/actions/workflows/azure-static-web-apps-nice-wave-0b1190a0f.yml)
[![Backend Deploy](https://github.com/TheBallerz/BallerzStatApp/actions/workflows/main_ballerz-backend.yml/badge.svg)](https://github.com/TheBallerz/BallerzStatApp/actions/workflows/main_ballerz-backend.yml)

A full-stack NBA statistics application that lets users create an account, save favorite teams, and browse live team and player stats across the current NBA season. Data is sourced directly from the NBA Stats API and stored in MongoDB, with a nightly sync job that keeps everything current.

---

## Deployment (Azure)

The application is fully deployed using Azure with CI/CD via GitHub Actions.

### Live URLs

- **Frontend:** https://nice-wave-0b1190a0f.7.azurestaticapps.net  
- **Backend:** https://ballerz-backend.azurewebsites.net  

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Getting Started](#getting-started)
- [First-Time Data Setup](#first-time-data-setup)
- [Project Structure](#project-structure)
- [NBA API Data Pipeline](#nba-api-data-pipeline)
- [API Routes](#api-routes)
- [Authentication](#authentication)
- [Testing](#testing)
- [Linting and Formatting](#linting-and-formatting)

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (or a local MongoDB instance)
- npm v9 or higher

---

## Environment Setup

The backend requires a `.env` file at `backend/.env`. Create it before starting the server:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d        # optional, defaults to 7d
PORT=3000                # optional, defaults to 3000
```

The frontend uses an environment variable for API requests.

Create a `.env` file in `frontend/`: VITE_API_BASE=http://localhost:3000/api

For production (Azure deployment), the app uses: VITE_API_BASE=https://ballerz-backend.azurewebsites.net/api

---

## Getting Started

The frontend and backend are separate Node projects. Install and run each one independently.

### Backend

```bash
cd backend
npm install
npm run dev        # starts the Express server at http://localhost:3000 with nodemon
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # starts the Vite dev server at http://localhost:5173
```

---

## First-Time Data Setup

After the backend is running for the first time, the database is empty. Run these three commands **in order** from the `backend/` directory to populate it:

```bash
# 1. Seed the database with all 30 NBA teams and an initial player set
npm run seed

# 2. Fetch the NBA API's numeric team IDs and write them to each Team document.
#    Required before syncing players or running the nightly sync.
npm run sync:team-ids

# 3. Pull the full active NBA roster from the API.
#    Enriches existing players with profile data (height, weight, birthDate, etc.)
#    and creates new Player documents for any player not already in the DB.
npm run sync:players
```

After these three complete, run the initial full data sync:

```bash
# 4. Run the complete sync pipeline immediately (same job the cron runs at 2 AM).
#    On first run this populates season stats from the API baseline, then inserts
#    all game-level box scores for the current season.
npm run sync
```

> **Note:** `sync:players` calls the NBA API once per player with a 600ms delay between requests to avoid rate-limiting. For a full 500+ player roster this takes approximately 5–6 minutes.

---

## Project Structure

```
BallerzStatApp/
├── frontend/                        # React + TypeScript (Vite)
│   └── src/
│       ├── App/
│       │   ├── App.tsx              # Root component, router setup
│       │   ├── App.css
│       │   └── App.test.tsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Layout.tsx       # Page shell with TopNav
│       │   │   ├── TopNav.tsx       # Navigation bar
│       │   │   └── topNav.css
│       │   └── teams/
│       │       ├── DivisionCard.tsx      # Renders one division's team list
│       │       ├── divisionCard.css
│       │       ├── TeamDetailPanel.tsx   # Slide-in team detail / comparison panel
│       │       └── teamDetailPanel.css
│       ├── pages/
│       │   ├── Home/
│       │   │   ├── HomePage.tsx     # Landing page with team/player highlights
│       │   │   └── homePage.css
│       │   ├── Teams/
│       │   │   ├── TeamsPage.tsx    # Teams browser with side-by-side comparison
│       │   │   └── TeamsPage.css
│       │   ├── Players/
│       │   │   ├── Players.tsx      # Player search and roster browser
│       │   │   └── Players.css
│       │   ├── Login/
│       │   │   ├── LoginPage.tsx
│       │   │   ├── LoginFormPage.tsx
│       │   │   └── loginPage.css
│       │   ├── GetStarted/
│       │   │   ├── GetStartedPage.tsx    # Registration flow step 1
│       │   │   ├── GetStartedStep2.tsx   # Registration flow step 2
│       │   │   ├── GetStartedStep3.tsx   # Registration flow step 3
│       │   │   └── getStartedPage.css
│       │   ├── Favorites/
│       │   │   ├── FavoritesPage.tsx
│       │   │   └── FavoritesPage.css
│       │   ├── Schedule/
│       │   │   ├── SchedulePage.tsx
│       │   │   └── SchedulePage.css
│       │   ├── AccountPage.tsx
│       │   └── StandingsPage.tsx
│       ├── services/
│       │   └── authService.ts       # Login / register API calls
│       ├── assets/
│       │   └── teamLogos.ts         # Team abbreviation → logo URL map
│       ├── __mocks__/
│       │   ├── fileMock.ts
│       │   └── mockTeams.ts
│       ├── index.css
│       ├── main.tsx                 # Vite entry point
│       └── setupTests.ts
│
├── backend/                         # Express.js + MongoDB
│   └── src/
│       ├── config/
│       │   └── database.js          # Mongoose connection helper
│       ├── models/                  # Mongoose schemas
│       │   ├── Team.js              # 30 NBA teams, includes nbaId for API linking
│       │   ├── Player.js            # Player profiles, includes nbaId
│       │   ├── User.js              # App user accounts
│       │   ├── TeamGameStats.js     # One doc per (team, game); 2-week TTL
│       │   ├── PlayerGameStats.js   # One doc per (player, game); 2-week TTL
│       │   ├── TeamSeasonStats.js   # Running season totals per team
│       │   └── PlayerSeasonStats.js # Running season totals per player
│       ├── routes/
│       │   ├── teams.js             # GET /api/teams
│       │   ├── players.js           # GET /api/players, GET /api/players/:id/career
│       │   └── auth.js              # POST /api/auth/register, POST /api/auth/login
│       ├── jobs/
│       │   └── nightlySync.js       # node-cron job (2 AM daily) + runSync()
│       ├── services/
│       │   └── seasonStatsService.js  # Baseline ingestion and incremental stat updates
│       ├── scripts/                 # One-time and manual setup scripts
│       │   ├── syncTeamNbaIds.js    # Writes NBA API team IDs to Team documents
│       │   ├── enrichPlayers.js     # Populates / creates Player docs from the API
│       │   └── manualSync.js        # Trigger the nightly sync immediately
│       ├── utils/
│       │   └── nbaUtils.js          # rowsToObjects() header/row converter
│       ├── nbaApi.js                # All NBA Stats API calls (axios + spoofed headers)
│       ├── seed.js                  # Seeds teams and initial player data
│       └── server.js                # Express entry point
│
└── README.md
```

---

## NBA API Data Pipeline

The app pulls live data from the [NBA Stats API](https://stats.nba.com/stats) (`stats.nba.com`). The API does not require an API key but does require browser-like request headers, which `nbaApi.js` handles automatically.

### Three levels of data

| Level | What | When |
|---|---|---|
| **Static** | Team identities, player profiles | One-time setup scripts |
| **Season totals** | Cumulative stats per team/player | Baseline on first sync, then incremental |
| **Game logs** | Per-game box scores | Nightly sync, deduplicated by `nbaGameId` |

### Nightly sync job

A `node-cron` job registered in `server.js` runs `runSync()` automatically at **2:00 AM** every night. 2 AM is chosen so all West Coast games are complete before the sync runs.

The sync pipeline:
1. **First run only** — calls the NBA API for full season totals and writes them to `TeamSeasonStats` and `PlayerSeasonStats` as an accurate baseline.
2. **Every run** — fetches the full season game log, skips any `(team/player, game)` pair already in the database, inserts new game documents, and increments the season stats by exactly one game per new insertion.

This two-phase design means season stats are always accurate: the baseline captures all historical games in a single API call, and the incremental updater adds only new games without re-reading the entire history.

### Manual sync

To trigger the full sync pipeline immediately without waiting for 2 AM:

```bash
cd backend
npm run sync
```

### Game stats TTL

`TeamGameStats` and `PlayerGameStats` documents are automatically deleted by MongoDB after **2 weeks** via a TTL index on `createdAt`. This keeps the collections small — the frontend only needs recent box scores, and historical totals are preserved in the season stats documents.

### npm scripts (backend)

| Script | Command | Description |
|---|---|---|
| `dev` | `nodemon src/server.js` | Start server with auto-restart |
| `start` | `node src/server.js` | Start server (production) |
| `seed` | `node src/seed.js` | Seed teams and initial players |
| `sync:team-ids` | `node src/scripts/syncTeamNbaIds.js` | Write NBA API IDs to Team docs |
| `sync:players` | `node src/scripts/enrichPlayers.js` | Enrich/create Player docs from API |
| `sync` | `node src/scripts/manualSync.js` | Run the full nightly sync now |
| `test` | `jest` | Run all backend tests |
| `test:coverage` | `jest --coverage` | Run tests with coverage report |
| `lint` | `eslint .` | Check for linting errors |
| `lint:fix` | `eslint . --fix` | Auto-fix linting errors |
| `format` | `prettier --write .` | Format all files |
| `format:check` | `prettier --check .` | Check formatting (no changes) |

---

## API Routes

All routes are prefixed with `/api`. The server runs on `http://localhost:3000` by default.

### Teams

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/teams` | Returns per-game averages for all 30 teams (wins, losses, win %, points, rebounds, assists) |

### Players

| Method | Path | Query Params | Description |
|---|---|---|---|
| `GET` | `/api/players` | `currentOnly=0\|1`, `search=<name>` | Returns all players or filters by active roster and/or name search |
| `GET` | `/api/players/:playerId/career` | — | Returns season-by-season career stats for a single player |

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | `{ firstName, lastName, email, password }` | Creates a new user account, returns a JWT |
| `POST` | `/api/auth/login` | `{ email, password }` | Authenticates an existing user, returns a JWT |

### Health check

```
GET /api/health  →  { ok: true, message: "backend is alive" }
```

---

## Authentication

The app uses **JWT (JSON Web Token)** authentication.

- Tokens are signed with `JWT_SECRET` from the environment and expire after `JWT_EXPIRES_IN` (default: 7 days).
- On successful register or login, the API returns a `token` field alongside a sanitized user object (no password hash).
- The frontend stores the token and includes it in the `Authorization` header for protected requests.
- Passwords are hashed with `bcryptjs` (10 salt rounds) — plaintext passwords are never stored.

---

## Testing

### Backend

The backend uses [Jest](https://jestjs.io/) with [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server) to run an in-memory MongoDB instance — no live database connection required.

All tests live in `backend/src/__tests__/models.test.js`. The suite covers all 7 Mongoose models (Team, Player, User, TeamGameStats, PlayerGameStats, TeamSeasonStats, PlayerSeasonStats) with 48 tests total, verifying:

- Document creation and field persistence
- Default values
- Required field validation
- Enum and min/max constraint enforcement
- Unique and compound unique index enforcement
- Read, update, and delete operations

Run from the `backend/` directory:

```bash
npm test                # run all tests
npm run test:coverage   # run tests with coverage report
```

### Frontend

The frontend uses [Jest](https://jestjs.io/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).

Run from the `frontend/` directory:

```bash
npm test
```

---

## Linting and Formatting

This project uses [ESLint](https://eslint.org/) for linting and [Prettier](https://prettier.io/) for formatting.

Run these from either the `frontend/` or `backend/` directory:

```bash
npm run lint           # check for linting errors
npm run lint:fix       # auto-fix linting errors
npm run format         # format all files with Prettier
npm run format:check   # check formatting without making changes
```
---

### Architecture

- Frontend: Azure Static Web Apps (Vite build → `dist/`)
- Backend: Azure App Service (Node.js + Express)
- CI/CD: GitHub Actions (auto deploy on push to `main`)

---

### CI/CD Pipelines

#### Backend
- Installs dependencies
- Runs tests and lint checks
- Deploys to Azure App Service

#### Frontend
- Builds React app (`npm run build`)
- Outputs static files to `dist/`
- Deploys to Azure Static Web Apps

---

### Important Notes

- The frontend does NOT use `localhost` in production
- All API calls go through: https://ballerz-backend.azurewebsites.net/api
- Controlled via: VITE_API_BASE

---

### Troubleshooting

If the frontend loads but no data appears:

- Open DevTools → Network tab
- Ensure requests go to the Azure backend (not localhost)

If CI/CD fails due to formatting:

```bash
cd frontend
npx prettier --write .
