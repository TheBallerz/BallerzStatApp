// Import Express and create a route for teams
const express = require("express");
const router = express.Router();
// GET /api/teams 
router.get("/teams", (req, res) => {
  res.status(501).json({ error: "GET /api/teams not implemented yet" });
});

// Export this router so it can be used under /api in server.js
module.exports = router;
