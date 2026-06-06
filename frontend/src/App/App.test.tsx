// Mock authService to control getToken without evaluating import.meta.env
jest.mock('../services/authService', () => ({
  getToken: jest.fn(),
}));

// Stub page components to avoid transitive import.meta.env imports
jest.mock('../pages/Login/LoginPage', () => () => <div>LoginPage</div>);
jest.mock('../pages/Login/LoginFormPage', () => () => <div>LoginFormPage</div>);
jest.mock('../pages/GetStarted/GetStartedPage', () => () => (
  <div>GetStartedPage</div>
));
jest.mock('../pages/Home/HomePage', () => () => <div>HomePage</div>);
jest.mock('../pages/Teams/TeamsPage', () => () => <div>TeamsPage</div>);
jest.mock('../pages/Players/Players', () => () => <div>PlayersPage</div>);
jest.mock('../pages/Favorites/FavoritesPage', () => () => (
  <div>FavoritesPage</div>
));
jest.mock('../pages/Standings/StandingsPage', () => () => (
  <div>StandingsPage</div>
));
jest.mock('../pages/Schedule/SchedulePage', () => () => (
  <div>SchedulePage</div>
));
jest.mock('../pages/AccountPage', () => () => <div>AccountPage</div>);
jest.mock('../pages/Fantasy/Fantasy', () => () => <div>FantasyPage</div>);
jest.mock('../components/layout/TopNav', () => () => <nav>TopNav</nav>);

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { getToken } from '../services/authService';

const mockGetToken = getToken as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('App routing', () => {
  test('renders LoginPage on /login without a token', () => {
    mockGetToken.mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('LoginPage')).toBeInTheDocument();
  });

  test('renders LoginFormPage on /login-form without a token', () => {
    mockGetToken.mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={['/login-form']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('LoginFormPage')).toBeInTheDocument();
  });

  test('renders GetStartedPage on /get-started without a token', () => {
    mockGetToken.mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={['/get-started']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('GetStartedPage')).toBeInTheDocument();
  });

  test('redirects to /login for a protected route when no token', () => {
    mockGetToken.mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={['/teams']}>
        <App />
      </MemoryRouter>,
    );

    // No token → ProtectedRoute redirects to /login → LoginPage renders
    expect(screen.getByText('LoginPage')).toBeInTheDocument();
  });

  test('renders HomePage on / when token is present', () => {
    mockGetToken.mockReturnValue('valid-token');

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('HomePage')).toBeInTheDocument();
  });

  test('renders TeamsPage on /teams when token is present', () => {
    mockGetToken.mockReturnValue('valid-token');

    render(
      <MemoryRouter initialEntries={['/teams']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('TeamsPage')).toBeInTheDocument();
  });

  test('renders TopNav inside Layout for authenticated routes', () => {
    mockGetToken.mockReturnValue('valid-token');

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('TopNav')).toBeInTheDocument();
  });

  test('does not render TopNav on public login route', () => {
    mockGetToken.mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.queryByText('TopNav')).toBeNull();
  });
});
