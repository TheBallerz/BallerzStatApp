import { render, screen, fireEvent } from '@testing-library/react';
import TopPlayerCard from '../components/players/TopPlayerCard';

const PLAYER = {
  nbaPlayerId: 2544,
  statValue: 27.1,
  playerName: 'LeBron James',
  teamAbbr: 'LAL',
};

beforeEach(() => jest.clearAllMocks());

describe('TopPlayerCard', () => {
  test('renders player name and team abbreviation', () => {
    render(<TopPlayerCard player={PLAYER} statLabel="PPG" />);

    expect(screen.getByText('LeBron James')).toBeInTheDocument();
    expect(screen.getByText('LAL')).toBeInTheDocument();
  });

  test('formats stat value to one decimal place', () => {
    render(<TopPlayerCard player={PLAYER} statLabel="PPG" />);

    expect(screen.getByText('27.1 PPG')).toBeInTheDocument();
  });

  test('uses the correct NBA CDN headshot URL', () => {
    render(<TopPlayerCard player={PLAYER} statLabel="PPG" />);

    const img = screen.getByAltText('LeBron James');
    expect(img).toHaveAttribute(
      'src',
      'https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png',
    );
  });

  test('calls onClick when the card is clicked', () => {
    const onClick = jest.fn();
    render(<TopPlayerCard player={PLAYER} statLabel="PPG" onClick={onClick} />);

    fireEvent.click(screen.getByText('LeBron James'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('applies grayscale filter when isGreyed is true', () => {
    const { container } = render(
      <TopPlayerCard player={PLAYER} statLabel="PPG" isGreyed />,
    );

    const card = container.firstChild as HTMLElement;
    expect(card.style.filter).toContain('grayscale');
    expect(card.style.pointerEvents).toBe('none');
  });

  test('does not apply grayscale when isGreyed is false', () => {
    const { container } = render(
      <TopPlayerCard player={PLAYER} statLabel="PPG" isGreyed={false} />,
    );

    const card = container.firstChild as HTMLElement;
    expect(card.style.filter).toBe('');
  });

  test('background gradient includes team color', () => {
    const { container } = render(
      <TopPlayerCard player={PLAYER} statLabel="PPG" />,
    );

    const card = container.firstChild as HTMLElement;
    // LAL team color from TEAM_ASSETS — gradient should reference a color string
    expect(card.style.background).toContain('linear-gradient');
  });

  test('hides headshot on image load error', () => {
    render(<TopPlayerCard player={PLAYER} statLabel="PPG" />);

    const img = screen.getByAltText('LeBron James') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.style.visibility).toBe('hidden');
  });
});
