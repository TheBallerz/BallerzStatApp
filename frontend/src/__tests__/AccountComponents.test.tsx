// authService and userStatsService use import.meta.env — mock them.
jest.mock('../services/authService', () => ({
  updateProfile: jest.fn(),
  getToken: jest.fn(() => 'mock-token'),
}));

jest.mock('../services/userStatsService', () => ({}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ProfileHeader,
  StatTiles,
  GameLogTable,
  GameLogModal,
} from '../components/account/AccountComponents';

const USER = {
  firstName: 'LeBron',
  lastName: 'James',
  email: 'lbj@lakers.com',
  avatar: null,
};

beforeEach(() => jest.clearAllMocks());

// ── ProfileHeader ──────────────────────────────────────────────────────────────

describe('ProfileHeader', () => {
  test('renders user full name and email', () => {
    render(
      <ProfileHeader
        user={USER}
        friendCount={5}
        favPlayerCount={3}
        favTeamCount={2}
        onEditProfile={() => {}}
        onLogout={() => {}}
      />,
    );

    expect(screen.getByText('LeBron James')).toBeInTheDocument();
    expect(screen.getByText('lbj@lakers.com')).toBeInTheDocument();
  });

  test('shows initials when avatar is null', () => {
    render(
      <ProfileHeader
        user={USER}
        friendCount={0}
        favPlayerCount={0}
        favTeamCount={0}
        onEditProfile={() => {}}
        onLogout={() => {}}
      />,
    );

    expect(screen.getByText('LJ')).toBeInTheDocument();
  });

  test('renders friend, player, and team counts', () => {
    render(
      <ProfileHeader
        user={USER}
        friendCount={7}
        favPlayerCount={4}
        favTeamCount={2}
        onEditProfile={() => {}}
        onLogout={() => {}}
      />,
    );

    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('calls onEditProfile when "Edit Profile" is clicked', () => {
    const onEditProfile = jest.fn();
    render(
      <ProfileHeader
        user={USER}
        friendCount={0}
        favPlayerCount={0}
        favTeamCount={0}
        onEditProfile={onEditProfile}
        onLogout={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
    expect(onEditProfile).toHaveBeenCalledTimes(1);
  });

  test('calls onLogout when "Log Out" is clicked', () => {
    const onLogout = jest.fn();
    render(
      <ProfileHeader
        user={USER}
        friendCount={0}
        favPlayerCount={0}
        favTeamCount={0}
        onEditProfile={() => {}}
        onLogout={onLogout}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

// ── StatTiles ──────────────────────────────────────────────────────────────────

const SEASON_STATS = {
  gamesPlayed: 10,
  avgPoints: 25.5,
  avgAssists: 7.3,
  avgRebounds: 9.2,
  avgFg3m: 2.1,
  avgSteals: 1.0,
  avgBlocks: 0.8,
  avgTurnovers: 3.0,
  avgMinutes: 34.0,
};

describe('StatTiles', () => {
  test('shows skeleton tiles while loading', () => {
    const { container } = render(
      <StatTiles stats={null} loading={true} />,
    );

    const skeletons = container.querySelectorAll('.ast-skeleton');
    expect(skeletons.length).toBe(4);
  });

  test('renders stat values formatted to one decimal place', () => {
    render(<StatTiles stats={SEASON_STATS} loading={false} />);

    expect(screen.getByText('25.5')).toBeInTheDocument();
    expect(screen.getByText('7.3')).toBeInTheDocument();
    expect(screen.getByText('9.2')).toBeInTheDocument();
    expect(screen.getByText('2.1')).toBeInTheDocument();
  });

  test('shows "—" for all tiles when gamesPlayed is 0', () => {
    const noGames = { ...SEASON_STATS, gamesPlayed: 0 };
    render(<StatTiles stats={noGames} loading={false} />);

    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(4);
  });

  test('shows "—" when stats is null', () => {
    render(<StatTiles stats={null} loading={false} />);

    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(4);
  });
});

// ── GameLogTable ───────────────────────────────────────────────────────────────

const GAME: ReturnType<typeof makeGame> = makeGame();

function makeGame(overrides = {}) {
  return {
    _id: 'g1',
    gameDate: '2025-03-15T00:00:00.000Z',
    points: 28,
    assists: 6,
    rebounds: 10,
    threePointersMade: 3,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    minutes: 35,
    opponent: 'GSW',
    ...overrides,
  };
}

describe('GameLogTable', () => {
  test('shows loading text while loading', () => {
    render(
      <GameLogTable games={[]} loading={true} onEdit={() => {}} onDelete={() => {}} />,
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('shows empty message when no games logged', () => {
    render(
      <GameLogTable
        games={[]}
        loading={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText(/No games logged yet/)).toBeInTheDocument();
  });

  test('renders game row with stat values', () => {
    render(
      <GameLogTable
        games={[GAME]}
        loading={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('formats date to short month + day', () => {
    render(
      <GameLogTable
        games={[GAME]}
        loading={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    // Date is formatted as "Mon Day" — exact value is timezone-dependent, so
    // just verify a date-like string appears (month abbreviation + number).
    const cells = screen.getAllByRole('cell');
    const dateCells = cells.filter((c) => /^[A-Z][a-z]+ \d+$/.test(c.textContent ?? ''));
    expect(dateCells.length).toBeGreaterThan(0);
  });

  test('calls onEdit with game when Edit button clicked', () => {
    const onEdit = jest.fn();
    render(
      <GameLogTable
        games={[GAME]}
        loading={false}
        onEdit={onEdit}
        onDelete={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(GAME);
  });

  test('calls onDelete with game id when delete button clicked', () => {
    const onDelete = jest.fn();
    render(
      <GameLogTable
        games={[GAME]}
        loading={false}
        onEdit={() => {}}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(onDelete).toHaveBeenCalledWith('g1');
  });
});

// ── GameLogModal ───────────────────────────────────────────────────────────────

describe('GameLogModal', () => {
  test('shows "Log Game" title in add mode', () => {
    render(
      <GameLogModal mode="add" onSave={jest.fn()} onClose={() => {}} />,
    );

    expect(screen.getByText('Log Game')).toBeInTheDocument();
  });

  test('shows "Edit Game" title in edit mode', () => {
    render(
      <GameLogModal
        mode="edit"
        initial={GAME}
        onSave={jest.fn()}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('Edit Game')).toBeInTheDocument();
  });

  test('shows validation error when game date is missing on submit', async () => {
    const { container } = render(
      <GameLogModal mode="add" onSave={jest.fn()} onClose={() => {}} />,
    );

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() =>
      expect(screen.getByText('Game date is required.')).toBeInTheDocument(),
    );
  });

  test('calls onSave with form values when date is provided', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { container } = render(
      <GameLogModal mode="add" onSave={onSave} onClose={() => {}} />,
    );

    // The date label is not associated via htmlFor — query the input by type
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2025-03-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ gameDate: '2025-03-20' }),
    );
  });

  test('calls onClose when Cancel button is clicked', () => {
    const onClose = jest.fn();
    render(
      <GameLogModal mode="add" onSave={jest.fn()} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
