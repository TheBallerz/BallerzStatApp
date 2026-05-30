/**
 * Feature: Standings API returns data
 *
 * Scenario: Successful GET request
 *    GIVEN the backend is running
 *    WHEN I make a GET request to the standings endpoint
 *    THEN the response status is 200
 *    AND the response body contains an east array and a west array
 *
 * ---
 *
 * Feature: Auth API accepts valid login credentials
 *
 * Scenario: Successful POST request
 *    GIVEN I have valid login credentials
 *    WHEN I make a POST request to the login endpoint
 *    THEN the response status is 200
 *    AND the response body contains a token
 *    AND the response body contains a user object with an email
 */

const BACKEND_URL = "http://localhost:3000";

describe("Standings API returns data", () => {
  context("Successful GET request", () => {
    it("GIVEN the backend is running, WHEN I make a GET request to the standings endpoint, THEN the response is valid", () => {
      // cy.request() is async — chain .then() to access the resolved response
      cy.request(`${BACKEND_URL}/api/standings`).then((response) => {
        assert.equal(
          response.status,
          200,
          "THEN the response status is 200"
        );
        assert.isArray(
          response.body.east,
          "AND the response body contains an east array"
        );
        assert.isArray(
          response.body.west,
          "AND the response body contains a west array"
        );
      });
    });
  });
});

describe("Auth API accepts valid login credentials", () => {
  context("Successful POST request", () => {
    it("GIVEN I have valid login credentials, WHEN I make a POST request to the login endpoint, THEN a token is returned", () => {
      // cy.fixture() is async — the outer .then() resolves the fixture data,
      // the inner .then() resolves the POST request, demonstrating chained
      // async function calls: cy.fixture().then().then()
      cy.fixture("user").then((user) => {
        cy.request("POST", `${BACKEND_URL}/api/auth/login`, {
          email: user.email,
          password: user.password,
        }).then((response) => {
          assert.equal(
            response.status,
            200,
            "THEN the response status is 200"
          );
          assert.exists(
            response.body.token,
            "AND the response body contains a token"
          );
          assert.equal(
            response.body.user.email,
            user.email,
            "AND the response body contains a user object with an email"
          );
        });
      });
    });
  });
});
