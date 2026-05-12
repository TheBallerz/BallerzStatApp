const mongoose = require("mongoose");
const dotenv = require("dotenv");

const PlayerBio = require("../models/PlayerBio");

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

async function getPlayers() {
  const response = await fetch(
    "https://stats.nba.com/stats/commonallplayers?IsOnlyCurrentSeason=1&LeagueID=00&Season=2025-26",
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.nba.com/",
        Origin: "https://www.nba.com",
      },
    }
  );

  const data = await response.json();

  const headers = data.resultSets[0].headers;
  const rows = data.resultSets[0].rowSet;

  return rows.map((row) => {
    const obj = {};

    headers.forEach((h, i) => {
      obj[h] = row[i];
    });

    return {
      playerId: String(obj.PERSON_ID),
      fullName: obj.DISPLAY_FIRST_LAST,
      team: obj.TEAM_ABBREVIATION,
    };
  });
}

async function getWikipediaBio(fullName) {
  try {
    const title = encodeURIComponent(fullName.replaceAll(" ", "_"));

    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "BallerzStatApp/1.0",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (!data.extract) return null;

    return {
      bio: data.extract,
      sourceUrl: data.content_urls?.desktop?.page,
    };
  } catch {
    return null;
  }
}

async function seed() {
  await mongoose.connect(MONGO_URI);

  console.log("Connected to MongoDB");

  const players = await getPlayers();

  console.log(`Found ${players.length} players`);

  for (const player of players) {
    const exists = await PlayerBio.findOne({
      playerId: player.playerId,
    });

    if (exists) {
      console.log(`Skipping ${player.fullName}`);
      continue;
    }

    console.log(`Fetching ${player.fullName}`);

    const wikiBio = await getWikipediaBio(player.fullName);

    if (!wikiBio) {
      console.log(`No bio found for ${player.fullName}`);
      continue;
    }

    await PlayerBio.create({
      playerId: player.playerId,
      fullName: player.fullName,
      team: player.team,
      bio: wikiBio.bio,
      sourceUrl: wikiBio.sourceUrl,
      source: "wikipedia",
    });

    console.log(`Saved ${player.fullName}`);

    // avoid hammering Wikipedia
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("Done");

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});