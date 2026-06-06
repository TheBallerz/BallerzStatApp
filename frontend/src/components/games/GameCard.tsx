import './gameCard.css';
import { getTeamAsset } from '../../assets/teamAssets';

interface TeamInfo {
  abbr: string;
  score: number | null;
}

interface GameCardProps {
  gameId: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  /** Which half (if any) has an open detail panel */
  activeHalf?: 'away' | 'home' | null;
  /** When true the whole card is dimmed and non-interactive */
  isGreyed?: boolean;
  onAwayClick: () => void;
  onHomeClick: () => void;
}

/**
 * Pill-shaped game card matching the design:
 *   [LOGO · score/abbr]   VS   [score/abbr · LOGO]
 *
 * Each half is independently clickable: clicking the left half triggers
 * onAwayClick; clicking the right half triggers onHomeClick.
 */
export default function GameCard({
  homeTeam,
  awayTeam,
  activeHalf,
  isGreyed,
  onAwayClick,
  onHomeClick,
}: GameCardProps) {
  const homeAsset = getTeamAsset(homeTeam.abbr);
  const awayAsset = getTeamAsset(awayTeam.abbr);

  // Each team's color fills its half and fades toward the dark center.
  const gradient = `linear-gradient(to right, ${awayAsset.color} 0%, #1c1c1c 45%, #1c1c1c 55%, ${homeAsset.color} 100%)`;

  const isActive = activeHalf !== null && activeHalf !== undefined;

  return (
    <div
      className={`game-card${isActive ? ' card-active' : ''}`}
      style={
        isGreyed
          ? { filter: 'grayscale(0.8) opacity(0.4)', pointerEvents: 'none' }
          : undefined
      }
    >
      <div className="game-card-inner" style={{ background: gradient }}>
        {/* ── Away team: logo on far left, score+abbr to its right ── */}
        <div
          className={`gc-half gc-half--away${activeHalf === 'away' ? ' gc-half--active' : ''}`}
          onClick={onAwayClick}
        >
          {awayAsset.logoUrl ? (
            <img
              className="gc-logo"
              src={awayAsset.logoUrl}
              alt={awayTeam.abbr}
            />
          ) : (
            <div className="gc-logo-placeholder" />
          )}
          <div className="gc-info">
            <span className="gc-score">{awayTeam.score ?? '—'}</span>
            <span className="gc-abbr">{awayTeam.abbr}</span>
          </div>
        </div>

        {/* ── Center VS ─────────────────────────────────────────── */}
        <span className="gc-vs">VS</span>

        {/* ── Home team: score+abbr on left, logo on far right ───── */}
        <div
          className={`gc-half gc-half--home${activeHalf === 'home' ? ' gc-half--active' : ''}`}
          onClick={onHomeClick}
        >
          {homeAsset.logoUrl ? (
            <img
              className="gc-logo"
              src={homeAsset.logoUrl}
              alt={homeTeam.abbr}
            />
          ) : (
            <div className="gc-logo-placeholder" />
          )}
          <div className="gc-info">
            <span className="gc-score">{homeTeam.score ?? '—'}</span>
            <span className="gc-abbr">{homeTeam.abbr}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
