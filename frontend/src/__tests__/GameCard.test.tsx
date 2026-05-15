// Mock Object: replace teamAssets so we control what getTeamAsset returns
jest.mock('../assets/teamAssets', () => ({ getTeamAsset: jest.fn() }));

import { render, screen, fireEvent } from '@testing-library/react';
import { getTeamAsset } from '../assets/teamAssets';
import GameCard from '../components/games/GameCard';

const mockGetTeamAsset = getTeamAsset as jest.Mock;

const defaultProps = {
  gameId: 'g1',
  homeTeam: { abbr: 'LAL', score: 110 },
  awayTeam: { abbr: 'BOS', score: 105 },
  onHomeClick: jest.fn(),
  onAwayClick: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // Stub: both teams have a logo URL by default
  mockGetTeamAsset.mockReturnValue({
    color: '#333333',
    logoUrl: 'https://cdn.nba.com/logos/nba/fake/logo.svg',
  });
});

describe('GameCard', () => {
  test('renders both team abbreviations and scores', () => {
    render(<GameCard {...defaultProps} />);

    expect(screen.getByText('LAL')).toBeInTheDocument();
    expect(screen.getByText('BOS')).toBeInTheDocument();
    expect(screen.getByText('110')).toBeInTheDocument();
    expect(screen.getByText('105')).toBeInTheDocument();
  });

  test('shows "—" for both teams when scores are null', () => {
    render(
      <GameCard
        {...defaultProps}
        homeTeam={{ abbr: 'LAL', score: null }}
        awayTeam={{ abbr: 'BOS', score: null }}
      />,
    );

    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(2);
  });

  test('renders <img> logos when logoUrl is non-empty', () => {
    render(<GameCard {...defaultProps} />);

    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('alt', 'BOS'); // away
    expect(imgs[1]).toHaveAttribute('alt', 'LAL'); // home
  });

  test('renders placeholder divs instead of <img> when logoUrl is empty', () => {
    // Stub: no logo URL — triggers the fallback branch
    mockGetTeamAsset.mockReturnValue({ color: '#333333', logoUrl: '' });

    const { container } = render(<GameCard {...defaultProps} />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelectorAll('.gc-logo-placeholder')).toHaveLength(2);
  });

  test('applies greyed-out inline style when isGreyed is true', () => {
    const { container } = render(<GameCard {...defaultProps} isGreyed />);

    const card = container.querySelector('.game-card') as HTMLElement;
    expect(card.style.filter).toContain('grayscale');
    expect(card.style.pointerEvents).toBe('none');
  });

  test('does not apply inline style when isGreyed is false', () => {
    const { container } = render(<GameCard {...defaultProps} isGreyed={false} />);

    const card = container.querySelector('.game-card') as HTMLElement;
    expect(card.style.filter).toBe('');
  });

  test('calls onAwayClick when the away half is clicked', () => {
    const onAwayClick = jest.fn();
    render(<GameCard {...defaultProps} onAwayClick={onAwayClick} />);

    // The away abbr lives inside the away half — click its parent
    fireEvent.click(screen.getByText('BOS').closest('.gc-half')!);
    expect(onAwayClick).toHaveBeenCalledTimes(1);
  });

  test('calls onHomeClick when the home half is clicked', () => {
    const onHomeClick = jest.fn();
    render(<GameCard {...defaultProps} onHomeClick={onHomeClick} />);

    fireEvent.click(screen.getByText('LAL').closest('.gc-half')!);
    expect(onHomeClick).toHaveBeenCalledTimes(1);
  });

  test('adds gc-half--active class to the active half only', () => {
    const { container } = render(<GameCard {...defaultProps} activeHalf="home" />);

    expect(container.querySelector('.gc-half--home')).toHaveClass('gc-half--active');
    expect(container.querySelector('.gc-half--away')).not.toHaveClass('gc-half--active');
  });

  test('adds card-active class to the wrapper when any half is active', () => {
    const { container } = render(<GameCard {...defaultProps} activeHalf="away" />);

    expect(container.querySelector('.game-card')).toHaveClass('card-active');
  });

  test('does not add card-active class when activeHalf is null', () => {
    const { container } = render(<GameCard {...defaultProps} activeHalf={null} />);

    expect(container.querySelector('.game-card')).not.toHaveClass('card-active');
  });
});
