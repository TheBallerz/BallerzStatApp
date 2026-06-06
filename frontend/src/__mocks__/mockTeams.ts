export type Team = {
  name: string;
};

export type Division = {
  name: string;
  teams: Team[];
};

export const divisions: Division[] = [
  {
    name: 'Atlantic',
    teams: [
      { name: 'Boston Celtics' },
      { name: 'Brooklyn Nets' },
      { name: 'New York Knicks' },
      { name: 'Philadelphia 76ers' },
      { name: 'Toronto Raptors' },
    ],
  },
  {
    name: 'Central',
    teams: [
      { name: 'Chicago Bulls' },
      { name: 'Cleveland Cavaliers' },
      { name: 'Detroit Pistons' },
      { name: 'Indiana Pacers' },
      { name: 'Milwaukee Bucks' },
    ],
  },
  {
    name: 'Southeast',
    teams: [
      { name: 'Atlanta Hawks' },
      { name: 'Charlotte Hornets' },
      { name: 'Miami Heat' },
      { name: 'Orlando Magic' },
      { name: 'Washington Wizards' },
    ],
  },
  {
    name: 'Northwest',
    teams: [
      { name: 'Denver Nuggets' },
      { name: 'Minnesota Timberwolves' },
      { name: 'Oklahoma City Thunder' },
      { name: 'Portland Trail Blazers' },
      { name: 'Utah Jazz' },
    ],
  },
  {
    name: 'Pacific',
    teams: [
      { name: 'Golden State Warriors' },
      { name: 'Los Angeles Clippers' },
      { name: 'Los Angeles Lakers' },
      { name: 'Phoenix Suns' },
      { name: 'Sacramento Kings' },
    ],
  },
  {
    name: 'Southwest',
    teams: [
      { name: 'Dallas Mavericks' },
      { name: 'Houston Rockets' },
      { name: 'Memphis Grizzlies' },
      { name: 'New Orleans Pelicans' },
      { name: 'San Antonio Spurs' },
    ],
  },
];
