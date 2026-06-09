/**
 * Feature: User Login
 *
 * Scenario: Successful login through the UI
 *    GIVEN I navigate to the login form page
 *    WHEN I enter valid credentials and submit
 *    THEN I am redirected to the home page
 */

describe('User Login', () => {
  context('Successful login through the UI', () => {
    it('GIVEN I navigate to the login form page, WHEN I enter valid credentials and submit, THEN I am redirected to the home page', () => {
      // Use cy.session() to cache cookies + localStorage via the custom cy.login()
      // command, working around Cypress clearing browser state between it() blocks
      cy.session('authSession', () => {
        cy.login();
      });
      // Register the intercept alias BEFORE the request is triggered
      cy.intercept('POST', '**/api/auth/login').as('loginRequest');
      // Load test credentials from fixture, then drive the UI
      cy.fixture('user').then((user) => {
        cy.visit('/login-form');
        cy.get('#lf-email').type(user.email);
        cy.get('#lf-password').type(user.password);
        cy.get('[aria-label="Log in"]').click();
      });
      // Wait for the aliased request to resolve, then assert the redirect in
      // the chained .then() — the URL check only runs once the POST is done
      cy.wait('@loginRequest').then(() => {
        cy.url().should('eq', 'http://localhost:5173/');
      });
    });
  });
});

/**
 * Feature: Authenticated User Views Standings
 *
 * Scenario: Authenticated user navigates to the Standings page
 *    GIVEN I am logged in
 *    WHEN I navigate to the Standings page
 *    THEN I can see Eastern and Western conference team data
 */

describe('Authenticated User Views Standings', () => {
  context('Standings page displays conference data', () => {
    it('GIVEN I am logged in, WHEN I navigate to the Standings page, THEN I can see Eastern and Western conference standings', () => {
      // Authenticate via the programmatic login command and cache the session
      cy.session('authSession', () => {
        cy.login();
      });
      // Intercept the standings API call so we can wait for it to resolve
      cy.intercept('GET', '**/api/standings').as('standingsRequest');
      cy.visit('/standings');
      // Wait for the API response before asserting page content
      cy.wait('@standingsRequest').then(() => {
        // Both conference headings should be visible on the standings page
        cy.contains('East').should('exist');
        cy.contains('West').should('exist');
      });
    });
  });
});
