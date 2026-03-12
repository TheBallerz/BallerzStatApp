// Import Express and create a route for players
const express = require("express");
const router = express.Router();

// GET /api/players - not yet implemented
router.get("/players", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// Export this router so it can be used under /api in server.js
module.exports = router;
