import './carouselCards.css';

// ── Shared SVG chart helper ───────────────────────────────────────────────

function MiniChart({
  points,
  color = '#ffffff',
}: {
  points: [number, number][];
  color?: string;
}) {
  const W = 200;
  const H = 60;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const mapped = points.map(([x, y]) => [
    ((x - minX) / rangeX) * W,
    H - ((y - minY) / rangeY) * H * 0.85 - H * 0.075,
  ]);

  const polylineStr = mapped.map(([x, y]) => `${x},${y}`).join(' ');

  const guides = [0.2, 0.4, 0.6, 0.8].map((f) => H - f * H);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {guides.map((y, i) => (
        <line
          key={i}
          x1={0}
          y1={y}
          x2={W}
          y2={y}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={0.5}
        />
      ))}
      <polyline
        points={polylineStr}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Player game-log data (approximate, visually representative)
const curryPoints: [number, number][] = [
  [0, 40],
  [1, 38],
  [2, 49],
  [3, 32],
  [4, 27],
  [5, 48],
  [6, 22],
  [7, 30],
  [8, 35],
  [9, 26],
  [10, 41],
  [11, 28],
  [12, 20],
  [13, 33],
  [14, 26],
  [15, 30],
  [16, 22],
  [17, 28],
  [18, 24],
];

const brownPoints: [number, number][] = [
  [0, 38],
  [1, 27],
  [2, 50],
  [3, 35],
  [4, 22],
  [5, 40],
  [6, 30],
  [7, 28],
  [8, 45],
  [9, 24],
  [10, 32],
  [11, 36],
  [12, 20],
  [13, 30],
  [14, 28],
  [15, 35],
  [16, 22],
  [17, 18],
  [18, 22],
];

const clePoints: [number, number][] = [
  [0, 148],
  [1, 118],
  [2, 140],
  [3, 125],
  [4, 138],
  [5, 110],
  [6, 135],
  [7, 122],
  [8, 148],
  [9, 115],
  [10, 130],
  [11, 118],
  [12, 95],
  [13, 128],
  [14, 122],
  [15, 140],
  [16, 108],
  [17, 125],
  [18, 118],
];

const okcPoints: [number, number][] = [
  [0, 140],
  [1, 125],
  [2, 148],
  [3, 118],
  [4, 130],
  [5, 143],
  [6, 122],
  [7, 135],
  [8, 120],
  [9, 148],
  [10, 128],
  [11, 118],
  [12, 88],
  [13, 135],
  [14, 125],
  [15, 145],
  [16, 118],
  [17, 130],
  [18, 128],
];

const userPoints: [number, number][] = [
  [0, 22],
  [1, 14],
  [2, 28],
  [3, 18],
  [4, 12],
  [5, 24],
  [6, 20],
  [7, 16],
  [8, 30],
  [9, 18],
  [10, 22],
  [11, 14],
  [12, 26],
  [13, 20],
  [14, 16],
  [15, 24],
  [16, 18],
  [17, 22],
  [18, 16],
];

// ── Card 1 — Track Players ────────────────────────────────────────────────

function PlayerRow({
  name,
  team,
  cardClass,
  stats,
}: {
  name: string;
  team: string;
  cardClass: string;
  stats: {
    label: string;
    avg: string;
    last: string;
    diff: string;
    pos: boolean;
  }[];
}) {
  return (
    <div className={`cc-tp-card ${cardClass}`}>
      <div className="cc-tp-left">
        <div className="cc-tp-name">{name}</div>
        <div className="cc-tp-team">{team}</div>
      </div>
      <div className="cc-tp-right">
        <table className="cc-tp-table">
          <thead>
            <tr>
              <th className="cc-tp-th">Stat</th>
              <th className="cc-tp-th">Avg</th>
              <th className="cc-tp-th">Last</th>
              <th className="cc-tp-th">Dif</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.label} className="cc-tp-stat-row">
                <td className="cc-tp-stat-label">{s.label}</td>
                <td className="cc-tp-stat-val">{s.avg}</td>
                <td className="cc-tp-stat-val">{s.last}</td>
                <td
                  className={`cc-tp-diff ${s.pos ? 'cc-tp-diff--pos' : 'cc-tp-diff--neg'}`}
                >
                  {s.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TrackPlayersCard() {
  return (
    <div className="cc-tp-wrap">
      <p className="cc-section-label">Your Favorite Players</p>
      <div className="cc-tp-list">
        <PlayerRow
          name="LeBron James"
          team="LAL"
          cardClass="cc-tp-card--lal"
          stats={[
            { label: 'PTS', avg: '21.3', last: '24', diff: '+2.7', pos: true },
            { label: '3PM', avg: '1.3', last: '2', diff: '+0.7', pos: true },
            { label: 'AST', avg: '7.2', last: '3', diff: '-4.2', pos: false },
            { label: 'REB', avg: '6.2', last: '12', diff: '+5.8', pos: true },
          ]}
        />
        <PlayerRow
          name="Stephen Curry"
          team="GSW"
          cardClass="cc-tp-card--gsw"
          stats={[
            { label: 'PTS', avg: '26.6', last: '24', diff: '-2.6', pos: false },
            { label: '3PM', avg: '4.4', last: '4', diff: '-0.4', pos: false },
            { label: 'AST', avg: '4.7', last: '3', diff: '-1.7', pos: false },
            { label: 'REB', avg: '3.6', last: '6', diff: '+2.4', pos: true },
          ]}
        />
      </div>
    </div>
  );
}

// ── Card 2 — Team Stats ───────────────────────────────────────────────────

export function TeamStatsCard() {
  return (
    <div className="cc-ts-panel">
      <div className="cc-ts-header">
        <div className="cc-ts-identity">
          <div className="cc-ts-logo-circle">CLE</div>
          <div>
            <div className="cc-ts-name">Cleveland Cavaliers</div>
            <div className="cc-ts-division">Central Division</div>
          </div>
        </div>
        <span className="cc-ts-close">×</span>
      </div>
      <div className="cc-ts-divider" />
      <div className="cc-ts-body">
        {[
          ['Record', '60-40'],
          ['PPG', '117.5'],
          ['RPG', '43.8'],
          ['APG', '27'],
          ['FG%', '47.7%'],
        ].map(([label, value]) => (
          <div key={label} className="cc-ts-stat-row">
            <span className="cc-ts-stat-label">{label}</span>
            <span className="cc-ts-stat-value">{value}</span>
          </div>
        ))}
        <div className="cc-ts-roster-title">Roster</div>
        {[
          {
            initials: 'DM',
            jersey: '#10 G',
            name: 'D. Mitchell',
            stat: '18.8 PPG',
          },
          {
            initials: 'JA',
            jersey: '#31 C',
            name: 'J. Allen',
            stat: '14.7 PPG',
          },
          {
            initials: 'MG',
            jersey: '#2 G',
            name: 'M. Garland',
            stat: '10.2 PPG',
          },
        ].map((p) => (
          <div key={p.initials} className="cc-ts-roster-row">
            <div className="cc-ts-roster-avatar">{p.initials}</div>
            <div className="cc-ts-roster-info">
              <span className="cc-ts-roster-jersey">{p.jersey}</span>
              <span className="cc-ts-roster-name">{p.name}</span>
            </div>
            <span className="cc-ts-roster-stat">{p.stat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared mini panel (used by Compare Players + Compare Teams) ───────────

type MiniStatTile = {
  value: string;
  label: string;
  diff?: string;
  diffPos?: boolean;
};

function MiniPanel({
  name,
  sub,
  avatarLabel,
  heartFilled,
  chartPoints,
  chartColor,
  stats,
  threeCol,
}: {
  name: string;
  sub: string;
  avatarLabel: string;
  heartFilled?: boolean;
  chartPoints: [number, number][];
  chartColor: string;
  stats: MiniStatTile[];
  threeCol?: boolean;
}) {
  return (
    <div
      className="cc-mini-panel"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    >
      <div className="cc-mini-header">
        <div className="cc-mini-identity">
          <p className="cc-mini-name">{name}</p>
          <span className="cc-mini-team">{sub}</span>
        </div>
        <div className="cc-mini-header-right">
          <div className="cc-mini-avatar">{avatarLabel}</div>
          <div className="cc-mini-actions">
            <div className="cc-mini-btn">×</div>
            <div
              className={`cc-mini-btn ${heartFilled ? 'cc-mini-heart-filled' : ''}`}
            >
              ♥
            </div>
          </div>
        </div>
      </div>
      <div className="cc-mini-select-row">
        <select className="cc-mini-select" defaultValue="Points">
          <option>Points</option>
        </select>
      </div>
      <div className="cc-mini-chart">
        <MiniChart points={chartPoints} color={chartColor} />
      </div>
      <div className="cc-mini-divider" />
      <div className="cc-mini-body">
        <p className="cc-mini-section-label">Season Averages</p>
        <div
          className={`cc-mini-stats-grid${threeCol ? ' cc-mini-stats-grid--3col' : ''}`}
        >
          {stats.map((s) => (
            <div key={s.label} className="cc-mini-stat-tile">
              <span className="cc-mini-tile-value">{s.value}</span>
              <span className="cc-mini-tile-label">{s.label}</span>
              {s.diff && (
                <span
                  className={`cc-mini-tile-diff ${s.diffPos ? 'pos' : 'neg'}`}
                >
                  {s.diff}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="cc-mini-compare-wrap">
        <button className="cc-mini-compare-btn">Compare Yourself</button>
      </div>
    </div>
  );
}

// ── Card 4 — Compare Players ──────────────────────────────────────────────

export function ComparePlayersCard() {
  return (
    <div className="cc-panels-wrap">
      <MiniPanel
        name="S. Curry"
        sub="GSW"
        avatarLabel="SC"
        heartFilled
        chartPoints={curryPoints}
        chartColor="#ffffff"
        stats={[
          { value: '26.6', label: 'PTS', diff: '-2.6', diffPos: false },
          { value: '4.7', label: 'AST', diff: '-1.7', diffPos: false },
          { value: '3.6', label: 'REB', diff: '+2.4', diffPos: true },
          { value: '4.4', label: '3PM', diff: '-0.4', diffPos: false },
        ]}
      />
      <MiniPanel
        name="J. Brown"
        sub="BOS"
        avatarLabel="JB"
        chartPoints={brownPoints}
        chartColor="#ffffff"
        stats={[
          { value: '28.4', label: 'PTS', diff: '+4.6', diffPos: true },
          { value: '5.0', label: 'AST', diff: '-1.0', diffPos: false },
          { value: '6.8', label: 'REB', diff: '+2.2', diffPos: true },
          { value: '2.0', label: '3PM', diff: '+1.0', diffPos: true },
        ]}
      />
    </div>
  );
}

// ── Card 5 — Compare Teams ────────────────────────────────────────────────

export function CompareTeamsCard() {
  return (
    <div className="cc-panels-wrap">
      <MiniPanel
        name="Cleveland"
        sub="Central Division"
        avatarLabel="CLE"
        heartFilled
        chartPoints={clePoints}
        chartColor="#ffffff"
        threeCol
        stats={[
          { value: '60-40', label: 'Record' },
          { value: '117.5', label: 'PPG' },
          { value: '43.8', label: 'RPG' },
          { value: '27.0', label: 'APG' },
          { value: '14.0', label: '3PM' },
          { value: '47.7%', label: 'FG%' },
        ]}
      />
      <MiniPanel
        name="OKC"
        sub="Northwest Div"
        avatarLabel="OKC"
        chartPoints={okcPoints}
        chartColor="#ffffff"
        threeCol
        stats={[
          { value: '74-20', label: 'Record' },
          { value: '118.9', label: 'PPG' },
          { value: '43.8', label: 'RPG' },
          { value: '25.9', label: 'APG' },
          { value: '13.8', label: '3PM', diff: '-3.0', diffPos: false },
          { value: '48.4%', label: 'FG%' },
        ]}
      />
    </div>
  );
}

// ── Card 6 — Add Friends ──────────────────────────────────────────────────

export function AddFriendsCard() {
  return (
    <div className="cc-af-wrap">
      <p className="cc-section-label">Add Friends</p>
      <div className="cc-af-input-wrap">
        <input className="cc-af-input" readOnly value="Tu" />
      </div>
      <div className="cc-af-dropdown">
        {[
          { initials: 'TD', name: 'Tyler Davis', status: 'request' },
          { initials: 'AP', name: 'Alex Park', status: 'request' },
          { initials: 'JL', name: 'Jordan Lee', status: 'friend' },
        ].map((u) => (
          <div key={u.initials} className="cc-af-result-row">
            <div className="cc-af-avatar">{u.initials}</div>
            <span className="cc-af-name">{u.name}</span>
            {u.status === 'request' ? (
              <button className="cc-af-request-btn">Request</button>
            ) : (
              <button className="cc-af-status-friend">Your Friend</button>
            )}
          </div>
        ))}
      </div>
      <p className="cc-af-friends-label">Your Friends</p>
      {[
        { initials: 'MC', name: 'Marcus Cole' },
        { initials: 'KC', name: 'Kayla Chen' },
      ].map((f) => (
        <div key={f.initials} className="cc-af-friend-row">
          <span className="cc-af-dots">···</span>
          <div className="cc-af-friend-avatar">{f.initials}</div>
          <span className="cc-af-friend-name">{f.name}</span>
        </div>
      ))}
    </div>
  );
}

// ── Card 7 — See How You Compare ─────────────────────────────────────────

export function SeeHowYouCompareCard() {
  return (
    <div className="cc-sc-panel">
      <div className="cc-sc-header">
        <div className="cc-sc-identity">
          <p className="cc-sc-title">Jordan Lee</p>
          <span className="cc-sc-subtitle">Your Stats</span>
        </div>
        <div className="cc-sc-header-right">
          <div className="cc-sc-avatar">JL</div>
          <span className="cc-sc-close">×</span>
        </div>
      </div>
      <div className="cc-sc-select-row">
        <select className="cc-sc-select" defaultValue="Points">
          <option>Points</option>
        </select>
      </div>
      <div className="cc-sc-chart">
        <MiniChart points={userPoints} color="#ffffff" />
      </div>
      <div className="cc-sc-divider" />
      <div className="cc-sc-body">
        <p className="cc-sc-section-label">Season Averages</p>
        <div className="cc-sc-stats-grid">
          {[
            { value: '18.2', label: 'PTS', green: true },
            { value: '3.1', label: 'AST', green: false },
            { value: '7.4', label: 'REB', green: true },
            { value: '1.8', label: '3PM', green: false },
          ].map((s) => (
            <div
              key={s.label}
              className={`cc-sc-stat-tile ${s.green ? 'cc-sc-stat-tile--green' : 'cc-sc-stat-tile--red'}`}
            >
              <span className="cc-sc-tile-value">{s.value}</span>
              <span className="cc-sc-tile-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
