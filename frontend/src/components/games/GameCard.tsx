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
  isActive: boolean;
  onClick: () => void;
}

/**
 * Pill-shaped game card matching the design:
 *   [LOGO · score/abbr]   VS   [score/abbr · LOGO]
 *
 * The background is a linear-gradient: away team's color fills the left half
 * and fades to dark in the center; home team's color fills the right half and
 * fades to dark in the center — creating two distinct colored halves.
 */
export default function GameCard({
  homeTeam,
  awayTeam,
  isActive,
  onClick,
}: GameCardProps) {
  const homeAsset = getTeamAsset(homeTeam.abbr);
  const awayAsset = getTeamAsset(awayTeam.abbr);

  // Each team's color fills its half and fades toward the dark center.
  const gradient = `linear-gradient(to right, ${awayAsset.color} 0%, #1c1c1c 45%, #1c1c1c 55%, ${homeAsset.color} 100%)`;

  return (
    <div
      className={`game-card${isActive ? ' card-active' : ''}`}
      onClick={onClick}
    >
      <div className="game-card-inner" style={{ background: gradient }}>

        {/* ── Away team: logo on far left, score+abbr to its right ── */}
        <div className="gc-half gc-half--away">
          {awayAsset.logoUrl ? (
            <img className="gc-logo" src={awayAsset.logoUrl} alt={awayTeam.abbr} />
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
        <div className="gc-half gc-half--home">
          {homeAsset.logoUrl ? (
            <img className="gc-logo" src={homeAsset.logoUrl} alt={homeTeam.abbr} />
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
