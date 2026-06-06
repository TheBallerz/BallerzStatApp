

const express = require("express");
const PlayerBio = require("../models/PlayerBio");
const { getWikipediaBio } = require("../services/wikipediaService");

const router = express.Router();

router.get("/:playerId/bio", async (req, res) => {
  try {
    const { playerId } = req.params;
    const { fullName, team } = req.query;

    const existingBio = await PlayerBio.findOne({ playerId });

    if (existingBio) {
      return res.json(existingBio);
    }

    if (!fullName) {
      return res.status(400).json({
        error: "fullName is required when creating a new bio",
      });
    }

    const wikiBio = await getWikipediaBio(fullName);

    const savedBio = await PlayerBio.create({
      playerId,
      fullName,
      team,
      bio: wikiBio.bio,
      sourceUrl: wikiBio.sourceUrl,
    });

    res.status(201).json(savedBio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load player bio" });
  }
});

module.exports = router;