import { render, screen, fireEvent } from '@testing-library/react';
import DivisionCard from '../components/teams/DivisionCard';

const TEAM_A = {
  mongoId: 'abc',
  name: 'Boston Celtics',
  division: 'Atlantic',
  teamId: 1,
  primaryColor: '#007A33',
  secondaryColor: '#FFFFFF',
};

const TEAM_B = {
  mongoId: 'def',
  name: 'Brooklyn Nets',
  division: 'Atlantic',
  teamId: 2,
  primaryColor: '#000000',
  secondaryColor: '#FFFFFF',
};

const DIVISION = {
  name: 'Atlantic',
  teams: [TEAM_A, TEAM_B],
};

beforeEach(() => jest.clearAllMocks());

describe('DivisionCard', () => {
  test('renders the division name', () => {
    render(<DivisionCard division={DIVISION} />);

    expect(screen.getByText('Atlantic')).toBeInTheDocument();
  });

  test('renders all team names', () => {
    render(<DivisionCard division={DIVISION} />);

    expect(screen.getByText('Boston Celtics')).toBeInTheDocument();
    expect(screen.getByText('Brooklyn Nets')).toBeInTheDocument();
  });

  test('renders team logos for known teams', () => {
    render(<DivisionCard division={DIVISION} />);

    const logos = screen.getAllByRole('img');
    expect(logos.length).toBeGreaterThanOrEqual(1);
  });

  test('applies selected class to teams in selectedTeams', () => {
    render(<DivisionCard division={DIVISION} selectedTeams={[TEAM_A]} />);

    const items = screen.getAllByRole('listitem');
    const celtics = items.find((li) =>
      li.textContent?.includes('Boston Celtics'),
    );
    const nets = items.find((li) => li.textContent?.includes('Brooklyn Nets'));

    expect(celtics).toHaveClass('selected');
    expect(nets).not.toHaveClass('selected');
  });

  test('does not apply selected class when selectedTeams is empty', () => {
    render(<DivisionCard division={DIVISION} selectedTeams={[]} />);

    screen.getAllByRole('listitem').forEach((li) => {
      expect(li).not.toHaveClass('selected');
    });
  });

  test('calls onTeamClick with the correct team when a row is clicked', () => {
    const onTeamClick = jest.fn();
    render(<DivisionCard division={DIVISION} onTeamClick={onTeamClick} />);

    fireEvent.click(screen.getByText('Boston Celtics'));
    expect(onTeamClick).toHaveBeenCalledWith(TEAM_A);
  });

  test('calls onTeamClick with the second team when that row is clicked', () => {
    const onTeamClick = jest.fn();
    render(<DivisionCard division={DIVISION} onTeamClick={onTeamClick} />);

    fireEvent.click(screen.getByText('Brooklyn Nets'));
    expect(onTeamClick).toHaveBeenCalledWith(TEAM_B);
  });

  test('renders without crashing when division has no teams', () => {
    render(<DivisionCard division={{ name: 'Empty', teams: [] }} />);

    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
