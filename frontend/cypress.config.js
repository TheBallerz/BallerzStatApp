const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {},
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
    defaultCommandTimeout: 10000,
  },
});
