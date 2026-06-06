// nbaApi uses import.meta.env — mock the module to prevent evaluation errors.
jest.mock('../services/nbaApi', () => ({
  fetchTeam: jest.fn(),
  fetchPlayers: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { fetchTeam, fetchPlayers } from '../services/nbaApi';
import TeamDetailPanel from '../components/teams/TeamDetailPanel';

const mockFetchTeam = fetchTeam as jest.Mock;
const mockFetchPlayers = fetchPlayers as jest.Mock;

const TEAM = {
  mongoId: 'team-mongo-1',
  name: 'Boston Celtics',
  division: 'Atlantic',
  teamId: 1610612738,
  primaryColor: '#007A33',
  secondaryColor: '#FFFFFF',
};

const TEAM_DETAIL = {
  mongoId: 'team-mongo-1',
  teamId: 1610612738,
  city: 'Boston',
  name: 'Celtics',
  abbreviation: 'BOS',
  conference: 'East',
  division: 'Atlantic',
  wins: 60,
  losses: 22,
  record: '60-22',
  ppg: 117.5,
  rpg: 44.2,
  apg: 26.1,
  fgPct: 0.476,
};

const PLAYER = {
  mongoId: 'player-mongo-1',
  nbaId: 1629029,
  fullName: 'Jayson Tatum',
  firstName: 'Jayson',
  lastName: 'Tatum',
  position: 'F',
  jerseyNumber: 0,
  imageUrl: 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629029.png',
  team: 'BOS',
  seasonStats: {
    ppg: 26.9,
    rpg: 8.1,
    apg: 4.9,
    spg: 1.1,
    bpg: 0.6,
    fgPct: 0.457,
    threePct: 0.371,
  },
};

beforeEach(() => jest.clearAllMocks());

describe('TeamDetailPanel', () => {
  test('shows loading state while fetching', () => {
    mockFetchTeam.mockReturnValue(new Promise(() => {}));
    mockFetchPlayers.mockReturnValue(new Promise(() => {}));

    render(<TeamDetailPanel team={TEAM} onClose={() => {}} />);

    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  test('renders team city + name after data loads', async () => {
    mockFetchTeam.mockResolvedValue(TEAM_DETAIL);
    mockFetchPlayers.mockResolvedValue([PLAYER]);

    render(<TeamDetailPanel team={TEAM} onClose={() => {}} />);

    expect(await screen.findByText('Boston Celtics')).toBeInTheDocument();
  });

  test('renders record and stats rows', async () => {
    mockFetchTeam.mockResolvedValue(TEAM_DETAIL);
    mockFetchPlayers.mockResolvedValue([]);

    render(<TeamDetailPanel team={TEAM} onClose={() => {}} />);

    expect(await screen.findByText('60-22')).toBeInTheDocument();
    expect(screen.getByText('117.5')).toBeInTheDocument();
  });

  test('formats FG% as percentage', async () => {
    mockFetchTeam.mockResolvedValue(TEAM_DETAIL);
    mockFetchPlayers.mockResolvedValue([]);

    render(<TeamDetailPanel team={TEAM} onClose={() => {}} />);

    await screen.findByText('60-22');
    // 0.476 * 100 = 47.6
    expect(screen.getByText('47.6%')).toBeInTheDocument();
  });

  test('renders roster player names', async () => {
    mockFetchTeam.mockResolvedValue(TEAM_DETAIL);
    mockFetchPlayers.mockResolvedValue([PLAYER]);

    render(<TeamDetailPanel team={TEAM} onClose={() => {}} />);

    expect(await screen.findByText('Jayson Tatum')).toBeInTheDocument();
  });

  test('navigates to /players with player state when roster player is clicked', async () => {
    mockFetchTeam.mockResolvedValue(TEAM_DETAIL);
    mockFetchPlayers.mockResolvedValue([PLAYER]);

    render(<TeamDetailPanel team={TEAM} onClose={() => {}} />);

    fireEvent.click(await screen.findByText('Jayson Tatum'));

    expect(mockNavigate).toHaveBeenCalledWith('/players', {
      state: {
        openPlayer: true,
        nbaPlayerId: PLAYER.nbaId,
        playerName: PLAYER.fullName,
        teamAbbr: PLAYER.team,
      },
    });
  });

  test('shows error message when fetch throws', async () => {
    mockFetchTeam.mockRejectedValue(new Error('Network error'));
    mockFetchPlayers.mockRejectedValue(new Error('Network error'));

    render(<TeamDetailPanel team={TEAM} onClose={() => {}} />);

    expect(
      await screen.findByText('Failed to load team data.'),
    ).toBeInTheDocument();
  });

  test('calls onClose when the × button is clicked', () => {
    mockFetchTeam.mockReturnValue(new Promise(() => {}));
    mockFetchPlayers.mockReturnValue(new Promise(() => {}));

    const onClose = jest.fn();
    render(<TeamDetailPanel team={TEAM} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('shows team division in header', () => {
    mockFetchTeam.mockReturnValue(new Promise(() => {}));
    mockFetchPlayers.mockReturnValue(new Promise(() => {}));

    render(<TeamDetailPanel team={TEAM} onClose={() => {}} />);

    expect(screen.getByText('Atlantic Division')).toBeInTheDocument();
  });
});
