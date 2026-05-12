import './topPlayerCard.css';
import { getTeamAsset } from '../../assets/teamAssets';

export interface TopPlayer {
  nbaPlayerId: number;
  statValue: number;
  playerName: string;
  teamAbbr: string;
}

interface TopPlayerCardProps {
  player: TopPlayer;
  statLabel: string; // e.g. "PPG", "3PM", "APG", "RPG"
}

/**
 * Player stat card matching the design:
 *   - Team color gradient (left) fading to dark (right)
 *   - Player headshot anchored to the left edge, blending into the gradient
 *   - Full player name in bold white text
 *   - Team abbreviation in small light text below the name
 *   - Per-game stat value pinned to the bottom-right corner
 */
export default function TopPlayerCard({
  player,
  statLabel,
}: TopPlayerCardProps) {
  const asset = getTeamAsset(player.teamAbbr);
  const headshotUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.nbaPlayerId}.png`;

  // Team color fills the left half and fades to the card's dark background color
  const gradient = `linear-gradient(to right, ${asset.color}dd 0%, #1a1a1a 60%)`;

  return (
    <div className="tpc-card" style={{ background: gradient }}>
      {/* Player headshot — hidden via visibility if the CDN returns a 404 */}
      <img
        className="tpc-headshot"
        src={headshotUrl}
        alt={player.playerName}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
        }}
      />

      {/* Name + team abbreviation anchored to bottom-left */}
      <div className="tpc-info">
        <span className="tpc-name">{player.playerName}</span>
        <span className="tpc-team">{player.teamAbbr}</span>
      </div>

      {/* Stat value pinned to bottom-right */}
      <span className="tpc-stat">
        {player.statValue.toFixed(1)} {statLabel}
      </span>
    </div>
  );
}
