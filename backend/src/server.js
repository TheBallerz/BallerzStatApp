// Backend entry point that initializes and starts the Express server
const express = require('express');
// Import API route modules
const playersRoutes = require("./routes/players");
const teamsRoutes = require("./routes/teams");
// Create the Express application instance
const app = express();

// Enable automatic parsing of JSON request bodies
app.use(express.json());

// Ensure prefix /api routes to routes
app.use("/api", playersRoutes);
app.use("/api", teamsRoutes);
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
