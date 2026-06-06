import { render, screen } from '@testing-library/react';
import Fantasy from '../pages/Fantasy/Fantasy';

const mockFetch = jest.fn();

const MOCK_PLAYERS = [
  { playerId: 1, fullName: 'Player A', team: 'LAL', position: 'F' },
  { playerId: 2, fullName: 'Player B', team: 'BOS', position: 'G' },
  { playerId: 3, fullName: 'Player C', team: '', position: 'C' },
];

function makeResponse(body: object) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.fetch = mockFetch as typeof window.fetch;
});

describe('Fantasy', () => {
  test('shows loading state before fetch resolves', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<Fantasy />);

    expect(screen.getByText('Loading fantasy page...')).toBeInTheDocument();
  });

  test('renders page heading after data loads', async () => {
    mockFetch.mockReturnValue(makeResponse(MOCK_PLAYERS));

    render(<Fantasy />);

    expect(await screen.findByText('Fantasy Basketball')).toBeInTheDocument();
  });

  test('renders player names in the table', async () => {
    mockFetch.mockReturnValue(makeResponse(MOCK_PLAYERS));

    render(<Fantasy />);

    expect(await screen.findByText('Player A')).toBeInTheDocument();
    expect(await screen.findByText('Player B')).toBeInTheDocument();
  });

  test('shows "FA" when team is empty string', async () => {
    mockFetch.mockReturnValue(makeResponse(MOCK_PLAYERS));

    render(<Fantasy />);

    await screen.findByText('Player C');
    expect(screen.getByText('FA')).toBeInTheDocument();
  });

  test('assigns rank starting at 1', async () => {
    mockFetch.mockReturnValue(makeResponse(MOCK_PLAYERS));

    render(<Fantasy />);

    await screen.findByText('Player A');
    const ranks = screen.getAllByRole('cell').filter((c) => c.textContent === '1');
    expect(ranks.length).toBeGreaterThan(0);
  });

  test('all players start with 0 stats so fantasy score is 0.0', async () => {
    mockFetch.mockReturnValue(makeResponse(MOCK_PLAYERS));

    render(<Fantasy />);

    await screen.findByText('Player A');
    const zeroCells = screen
      .getAllByRole('cell')
      .filter((c) => c.textContent === '0.0');
    // One "0.0" per player
    expect(zeroCells.length).toBe(MOCK_PLAYERS.length);
  });

  test('only takes first 25 players from the API response', async () => {
    const manyPlayers = Array.from({ length: 30 }, (_, i) => ({
      playerId: i,
      fullName: `Player ${i}`,
      team: 'LAL',
    }));
    mockFetch.mockReturnValue(makeResponse(manyPlayers));

    render(<Fantasy />);

    await screen.findByText('Player 0');
    // Players 25-29 should not appear
    expect(screen.queryByText('Player 25')).toBeNull();
  });

  test('calls fetch exactly once on mount', async () => {
    mockFetch.mockReturnValue(makeResponse(MOCK_PLAYERS));

    render(<Fantasy />);

    await screen.findByText('Player A');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
