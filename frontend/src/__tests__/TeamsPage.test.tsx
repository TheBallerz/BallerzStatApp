// Mock Objects: replace service and child components so import.meta.env is never evaluated
// and so child-component internals don't interfere with TeamsPage-level assertions.
jest.mock('../services/nbaApi', () => ({ fetchTeams: jest.fn() }));
jest.mock('../components/teams/DivisionCard', () => ({
  __esModule: true,
  default: ({ division }: { division: { name: string } }) => (
    <div data-testid="division-card">{division.name}</div>
  ),
}));
jest.mock('../components/teams/TeamDetailPanel', () => ({
  __esModule: true,
  default: ({
    team,
    onClose,
  }: {
    team: { name: string };
    onClose: () => void;
  }) => (
    <div data-testid="team-detail-panel">
      {team.name}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import { render, screen } from '@testing-library/react';
import { fetchTeams } from '../services/nbaApi';
import TeamsPage from '../pages/Teams/TeamsPage';
import { MemoryRouter } from 'react-router-dom';

const mockFetchTeams = fetchTeams as jest.Mock;

// Stub: two teams that land in distinct divisions (Atlantic and Northwest)
const MOCK_TEAMS = [
  {
    teamId: 1,
    teamName: 'Boston Celtics',
    teamAbbreviation: 'BOS',
    wins: 60,
    losses: 22,
  },
  {
    teamId: 2,
    teamName: 'Oklahoma City Thunder',
    teamAbbreviation: 'OKC',
    wins: 58,
    losses: 24,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TeamsPage', () => {
  test('shows the loading message before fetchTeams resolves', () => {
    // Stub: never-settling promise keeps the component in the loading state
    mockFetchTeams.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading teams...')).toBeInTheDocument();
  });

  test('renders all six division cards after data loads', async () => {
    mockFetchTeams.mockResolvedValue(MOCK_TEAMS);

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    // groupTeamsByDivision always produces all six divisions
    const cards = await screen.findAllByTestId('division-card');
    expect(cards).toHaveLength(6);
  });

  test('passes the correct division names to DivisionCard', async () => {
    mockFetchTeams.mockResolvedValue(MOCK_TEAMS);

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    for (const name of [
      'Atlantic',
      'Central',
      'Southeast',
      'Northwest',
      'Pacific',
      'Southwest',
    ]) {
      expect(await screen.findByText(name)).toBeInTheDocument();
    }
  });

  test('shows the error message when fetchTeams throws', async () => {
    // Stub: canned error simulating a network failure
    mockFetchTeams.mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Failed to load teams.'),
    ).toBeInTheDocument();
  });

  test('calls fetchTeams exactly once on mount', async () => {
    mockFetchTeams.mockResolvedValue(MOCK_TEAMS);

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    // Wait for the effect to complete before checking call count
    await screen.findAllByTestId('division-card');

    // Mock verification: one call on mount, not on every re-render
    expect(mockFetchTeams).toHaveBeenCalledTimes(1);
  });

  test('shows the hero section when no team is selected', async () => {
    mockFetchTeams.mockResolvedValue(MOCK_TEAMS);

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    await screen.findAllByTestId('division-card');

    // The hero <h1> is the heading-level "Teams" element (not the summary stat span)
    expect(screen.getByRole('heading', { name: 'Teams' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Explore NBA teams by division, view stats, and compare matchups.',
      ),
    ).toBeInTheDocument();
  });
});
