'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');

// Starts the in-memory MongoDB server before any tests run
// and writes the connection URI to process.env for the test file to use
module.exports = async function globalSetup() {
  const mongod = await MongoMemoryServer.create();
  global.__MONGOD__ = mongod;
  process.env.MONGO_TEST_URI = mongod.getUri();
};
