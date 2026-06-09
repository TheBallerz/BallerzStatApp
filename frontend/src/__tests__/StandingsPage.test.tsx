// Mock Object: replace the real service module so import.meta.env is never evaluated
jest.mock('../services/standingsService', () => ({
  fetchStandings: jest.fn(),
}));

import { render, screen } from '@testing-library/react';
import { fetchStandings } from '../services/standingsService';
import StandingsPage from '../pages/Standings/StandingsPage';
import { MemoryRouter } from 'react-router-dom';
const mockFetchStandings = fetchStandings as jest.Mock;

// Stub: static fixture data standing in for a real API response (Fake/Stub pattern)
const MOCK_STANDINGS = {
  season: '2024-25',
  east: [
    {
      teamId: 't1',
      nbaTeamId: 1,
      teamName: 'Boston Celtics',
      wins: 60,
      losses: 22,
      gamesPlayed: 82,
      winPct: 0.732,
      avgPoints: 115.2,
      avgRebounds: 44.1,
      avgAssists: 26.5,
      avgSteals: 7.2,
      avgBlocks: 5.1,
      avgTurnovers: 13.3,
      fgPct: 0.48,
      fg3Pct: 0.38,
      ftPct: 0.78,
    },
  ],
  west: [
    {
      teamId: 't2',
      nbaTeamId: 2,
      teamName: 'OKC Thunder',
      wins: 58,
      losses: 24,
      gamesPlayed: 82,
      winPct: 0.707,
      avgPoints: 118.0,
      avgRebounds: 45.0,
      avgAssists: 28.0,
      avgSteals: 8.0,
      avgBlocks: 4.5,
      avgTurnovers: 12.0,
      fgPct: 0.49,
      fg3Pct: 0.37,
      ftPct: 0.8,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('StandingsPage', () => {
  test('shows the loading message before the fetch resolves', () => {
    // Stub: never-settling promise keeps the component in the loading state
    mockFetchStandings.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <StandingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading standings...')).toBeInTheDocument();
  });

  test('renders both conference section headings after data loads', async () => {
    // Stub: canned successful response
    mockFetchStandings.mockResolvedValue(MOCK_STANDINGS);

    render(
      <MemoryRouter>
        <StandingsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Eastern Conference')).toBeInTheDocument();
    expect(await screen.findByText('Western Conference')).toBeInTheDocument();
  });

  test('renders team names and win/loss record from the stub data', async () => {
    mockFetchStandings.mockResolvedValue(MOCK_STANDINGS);

    render(
      <MemoryRouter>
        <StandingsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Boston Celtics')).toBeInTheDocument();
    expect(await screen.findByText('OKC Thunder')).toBeInTheDocument();

    // Wins and losses appear as plain numbers in table cells
    const allSixties = await screen.findAllByText('60');
    expect(allSixties.length).toBeGreaterThan(0);
  });

  test('formats winPct to exactly 3 decimal places', async () => {
    mockFetchStandings.mockResolvedValue(MOCK_STANDINGS);

    render(
      <MemoryRouter>
        <StandingsPage />
      </MemoryRouter>,
    );

    // The component calls .toFixed(3) — verify the formatted string appears, not a raw float
    expect(await screen.findByText('0.732')).toBeInTheDocument();
    expect(await screen.findByText('0.707')).toBeInTheDocument();
  });

  test('shows the error message when the fetch throws', async () => {
    // Stub: canned error simulating a network or server failure
    mockFetchStandings.mockRejectedValue(
      new Error('Failed to fetch standings'),
    );

    render(
      <MemoryRouter>
        <StandingsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Error: Failed to fetch standings'),
    ).toBeInTheDocument();
  });

  test('shows "Error: Unknown error" when the fetch rejects with a non-Error value', async () => {
    // Stub: a plain string thrown instead of an Error object — covers the else branch
    mockFetchStandings.mockRejectedValue('server blew up');

    render(
      <MemoryRouter>
        <StandingsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Error: Unknown error')).toBeInTheDocument();
  });

  test('renders the page title even when data resolves to null', async () => {
    // Stub: null response — covers the data?.season and data?.east ?? [] null branches
    mockFetchStandings.mockResolvedValue(null);

    render(
      <MemoryRouter>
        <StandingsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('NBA Standings')).toBeInTheDocument();
    // data?.season is undefined, so no season value appears alongside the label
    expect(screen.queryByText('2024-25')).toBeNull();
  });

  test('calls fetchStandings exactly once on mount', async () => {
    mockFetchStandings.mockResolvedValue(MOCK_STANDINGS);

    render(
      <MemoryRouter>
        <StandingsPage />
      </MemoryRouter>,
    );

    // Wait for the async effect to finish before checking call count
    await screen.findByText('Eastern Conference');

    // Mock verification: confirm the service was called and not called again on re-render
    expect(mockFetchStandings).toHaveBeenCalledTimes(1);
  });
});
