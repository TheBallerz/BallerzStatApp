'use strict';

module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/src/__tests__/real/setup.js',
  testMatch: ['**/real/**/*.test.js'],
  testTimeout: 60000, // first run downloads MongoDB binary (~200MB)
  verbose: true,
  maxWorkers: 1, // prevents Mongoose model re-registration conflicts
};
