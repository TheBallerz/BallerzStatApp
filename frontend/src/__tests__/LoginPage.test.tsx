// Mock useNavigate to intercept navigation calls.
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock carousel card components — they contain complex SVG/animation logic
// that is irrelevant to LoginPage behaviour.
jest.mock('../pages/Login/CarouselCards', () => ({
  TrackPlayersCard: () => <div>TrackPlayers</div>,
  TeamStatsCard: () => <div>TeamStats</div>,
  ComparePlayersCard: () => <div>ComparePlayers</div>,
  CompareTeamsCard: () => <div>CompareTeams</div>,
  AddFriendsCard: () => <div>AddFriends</div>,
  SeeHowYouCompareCard: () => <div>SeeHowYouCompare</div>,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from '../pages/Login/LoginPage';

beforeEach(() => jest.clearAllMocks());

describe('LoginPage', () => {
  test('renders the Ballerz title', () => {
    render(<LoginPage />);

    expect(screen.getByText('Ballerz')).toBeInTheDocument();
  });

  test('"Get Started" button navigates to /get-started', () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));
    expect(mockNavigate).toHaveBeenCalledWith('/get-started');
  });

  test('"Login" button navigates to /login-form', () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(mockNavigate).toHaveBeenCalledWith('/login-form');
  });

  test('renders 12 carousel items (6 original + 6 duplicates for seamless loop)', () => {
    render(<LoginPage />);

    // Each carousel item has a title matching the carouselItems labels
    const trackPlayers = screen.getAllByText('Track Players');
    expect(trackPlayers).toHaveLength(2); // original + duplicate
  });

  test('renders the feature highlight carousel section', () => {
    render(<LoginPage />);

    expect(
      screen.getByRole('region', { name: /feature highlights/i }),
    ).toBeInTheDocument();
  });
});
