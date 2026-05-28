// Backend entry point that initializes and starts the Express server
require('dotenv').config();
const express = require('express');
const { connectDB } = require('./config/database');
// Import API route modules
const playersRoutes = require('./routes/players');
const teamsRoutes = require('./routes/teams');
const scheduleRoutes = require('./routes/schedule');
const authRoutes = require('./routes/auth');
const gamesRoutes = require('./routes/games');
const standingsRoutes = require("./routes/standings");
const adminRoutes = require('./routes/admin');
// Import the nightly sync job scheduler.
// startNightlySync() registers a node-cron task that runs at 2:00 AM every night
// to ingest new game stats from the NBA API and update season averages in MongoDB.
const { startNightlySync } = require('./jobs/nightlySync');


// Connect to MongoDB first, then start the scheduled sync job.
// Chaining on .then() ensures the cron job is only registered after the database
// connection is confirmed, so the first sync attempt won't fail due to no DB connection.
connectDB().then(() => {
  startNightlySync();
});

// Create the Express application instance
const app = express();

// Allow cross-origin requests from the Vite dev server
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Enable automatic parsing of JSON request bodies.
// Limit raised to 5mb to accommodate base64-encoded profile picture uploads.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Ensure prefix /api routes to routes
app.use("/api", playersRoutes);
app.use("/api", teamsRoutes);
app.use("/api", scheduleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", gamesRoutes);
app.use("/api", standingsRoutes);
app.use('/api/admin', adminRoutes);
const userStatsRoutes = require('./routes/userStats');
const friendsRoutes   = require('./routes/friends');
app.use('/api/user', userStatsRoutes);
app.use('/api/friends', friendsRoutes);
//hard coded used for testing front to back response
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'backend is alive' });
});

// Select port from environment variables or default to 3000 for local development
const PORT = process.env.PORT || 3000;

// Start the HTTP server and listen for incoming requests
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
