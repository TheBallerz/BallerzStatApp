'use strict';

module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/src/__tests__/setup.js',
  testMatch: ['**/*.test.js'], // only run *.test.js files, not setup.js
  testTimeout: 60000, // first run downloads MongoDB binary (~200MB)
  verbose: true,
  maxWorkers: 1, // prevents Mongoose model re-registration conflicts
};
