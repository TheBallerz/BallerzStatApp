// userStatsService uses import.meta.env — mock the module.
jest.mock('../services/userStatsService', () => ({
  getMySeasonStats: jest.fn(),
  getMyGames: jest.fn(),
}));

// recharts uses ResizeObserver which jsdom doesn't support — stub it.
// Using children: unknown so we don't need React in scope inside the factory.
jest.mock('recharts', () => ({
  AreaChart: ({ children }: { children: unknown }) => (
    <div data-testid="area-chart">{children as never}</div>
  ),
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: unknown }) => (
    <div>{children as never}</div>
  ),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { getMySeasonStats, getMyGames } from '../services/userStatsService';
import UserSelfPanel from '../components/home/UserSelfPanel';

const mockGetMySeasonStats = getMySeasonStats as jest.Mock;
const mockGetMyGames = getMyGames as jest.Mock;

const COMPARE_STATS = { pts: 20, ast: 5, reb: 7, fg3m: 2 };

const SEASON_STATS = {
  gamesPlayed: 10,
  avgPoints: 25.0,
  avgAssists: 6.0,
  avgRebounds: 8.0,
  avgFg3m: 3.0,
  avgSteals: 1.2,
  avgBlocks: 0.5,
  avgTurnovers: 2.1,
  avgMinutes: 34.0,
};

const GAMES = [
  {
    _id: 'g1',
    gameDate: '2025-03-01T00:00:00.000Z',
    points: 22,
    assists: 4,
    rebounds: 7,
    threePointersMade: 2,
    opponent: 'LAL',
  },
];

beforeEach(() => jest.clearAllMocks());

describe('UserSelfPanel', () => {
  test('renders user name in header', async () => {
    mockGetMySeasonStats.mockResolvedValue(SEASON_STATS);
    mockGetMyGames.mockResolvedValue(GAMES);

    render(
      <UserSelfPanel
        compareStats={COMPARE_STATS}
        onClose={() => {}}
        userName="LeBron James"
        userAvatar={null}
      />,
    );

    expect(screen.getByText('LeBron James')).toBeInTheDocument();
  });

  test('shows initials when userAvatar is null', async () => {
    mockGetMySeasonStats.mockResolvedValue(SEASON_STATS);
    mockGetMyGames.mockResolvedValue(GAMES);

    render(
      <UserSelfPanel
        compareStats={COMPARE_STATS}
        onClose={() => {}}
        userName="LeBron James"
        userAvatar={null}
      />,
    );

    // "LeBron James" → initials "LJ"
    expect(screen.getByText('LJ')).toBeInTheDocument();
  });

  test('calls onClose when × button is clicked', () => {
    mockGetMySeasonStats.mockReturnValue(new Promise(() => {}));
    mockGetMyGames.mockReturnValue(new Promise(() => {}));

    const onClose = jest.fn();
    render(
      <UserSelfPanel
        compareStats={COMPARE_STATS}
        onClose={onClose}
        userName="Test User"
        userAvatar={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('shows loading state while fetching', () => {
    mockGetMySeasonStats.mockReturnValue(new Promise(() => {}));
    mockGetMyGames.mockReturnValue(new Promise(() => {}));

    render(
      <UserSelfPanel
        compareStats={COMPARE_STATS}
        onClose={() => {}}
        userName="Test User"
        userAvatar={null}
      />,
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('renders season stat averages after data loads', async () => {
    mockGetMySeasonStats.mockResolvedValue(SEASON_STATS);
    mockGetMyGames.mockResolvedValue([]);

    render(
      <UserSelfPanel
        compareStats={COMPARE_STATS}
        onClose={() => {}}
        userName="Test User"
        userAvatar={null}
      />,
    );

    expect(await screen.findByText('25.0')).toBeInTheDocument();
  });

  test('shows "No stats available" when season stats are null', async () => {
    mockGetMySeasonStats.mockResolvedValue(null);
    mockGetMyGames.mockResolvedValue([]);

    render(
      <UserSelfPanel
        compareStats={COMPARE_STATS}
        onClose={() => {}}
        userName="Test User"
        userAvatar={null}
      />,
    );

    expect(await screen.findByText('No stats available')).toBeInTheDocument();
  });

  test('shows "No game data yet" when game log is empty', async () => {
    mockGetMySeasonStats.mockResolvedValue(SEASON_STATS);
    mockGetMyGames.mockResolvedValue([]);

    render(
      <UserSelfPanel
        compareStats={COMPARE_STATS}
        onClose={() => {}}
        userName="Test User"
        userAvatar={null}
      />,
    );

    expect(await screen.findByText('No game data yet')).toBeInTheDocument();
  });

  test('renders chart when game data is present', async () => {
    mockGetMySeasonStats.mockResolvedValue(SEASON_STATS);
    mockGetMyGames.mockResolvedValue(GAMES);

    render(
      <UserSelfPanel
        compareStats={COMPARE_STATS}
        onClose={() => {}}
        userName="Test User"
        userAvatar={null}
      />,
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
  });

  test('stat dropdown has all four options', async () => {
    mockGetMySeasonStats.mockResolvedValue(SEASON_STATS);
    mockGetMyGames.mockResolvedValue([]);

    render(
      <UserSelfPanel
        compareStats={COMPARE_STATS}
        onClose={() => {}}
        userName="Test User"
        userAvatar={null}
      />,
    );

    // Dropdown is always present — no need to wait for async state
    const select = screen.getByRole('combobox');
    const options = Array.from((select as HTMLSelectElement).options).map(
      (o) => o.text,
    );
    expect(options).toEqual(
      expect.arrayContaining(['Points', 'Rebounds', 'Assists', '3-Pointers']),
    );
  });

  test('stat tiles show green class when user stat exceeds compare value', async () => {
    // SEASON_STATS.avgPoints = 25 > COMPARE_STATS.pts = 20 → green
    mockGetMySeasonStats.mockResolvedValue(SEASON_STATS);
    mockGetMyGames.mockResolvedValue([]);

    const { container } = render(
      <UserSelfPanel
        compareStats={COMPARE_STATS}
        onClose={() => {}}
        userName="Test User"
        userAvatar={null}
      />,
    );

    await screen.findByText('25.0');

    const greenTiles = container.querySelectorAll('.usp-stat-tile--green');
    expect(greenTiles.length).toBeGreaterThan(0);
  });
});
