// ***********************************************
// Custom Cypress commands for BallerzStatApp
// ***********************************************

// cy.login() — authenticates programmatically by calling the login endpoint directly.
// Takes the token from the response and sets it as a cookie AND in localStorage
// so both the app's ProtectedRoute (which reads localStorage) and Cypress session
// caching (which preserves cookies) are satisfied.
// Wrap in cy.session() to persist auth state across it() blocks.
Cypress.Commands.add('login', () => {
  cy.fixture('user').then((user) => {
    cy.request('POST', 'http://localhost:3000/api/auth/login', {
      email: user.email,
      password: user.password,
    }).then((response) => {
      cy.setCookie('token', response.body.token);
      cy.window().then((win) => {
        win.localStorage.setItem('ballerz_token', response.body.token);
        win.localStorage.setItem(
          'ballerz_user',
          JSON.stringify(response.body.user),
        );
      });
    });
  });
});
