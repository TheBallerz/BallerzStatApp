// Import Express and create a route for players
const express = require("express");
const router = express.Router();
const { getPlayers, getPlayerCareerStats } = require('../nbaApi');

// Takes a result set from NBA API and returns an object for each row
function rowsToObjects(resultSet) {
  
  // Take headers property from resultSet and put it into a variable called headers
  // Take the rowSet property and put it into a variable called rowSet
  const { headers, rowSet } = resultSet;

  // Goes through each row and returns a new array
  return rowSet.map((row) => {
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = row[index];
    });

    return obj;
  });
}

// Export this router so it can be used under /api in server.js
module.exports = router;
