// Import Express and create a route for players
const express = require("express");
const router = express.Router();
// GET /api/players 
router.get("/players", (req, res) => {
  res.status(501).json({ error: "GET /api/players not implemented yet" });
});

// Export this router so it can be used under /api in server.js
module.exports = router;