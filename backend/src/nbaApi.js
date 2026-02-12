// Load variables from the .env file into process.env
require("dotenv").config();
// Load the URL from the .env 
const NBA_URL = process.env.NBA_API_BASE_URL;
// Load the password from the .env
const NBA_API_KEY = process.env.NBA_API_KEY;


// Skeleton for the get request function
async function nbaGet(path) {
    // Checking for api URL before making request
  if (!NBA_URL) {
    throw new Error("NBA_API_URL is not defined");
  }
  // To indicate the function isnt completed
  throw new Error("NBA api not implemented yet");
}
// Export nbaGet so it can be used in other backend modules
module.exports = { nbaGet };