import './favoritePlayerCard.css';
import { getTeamAsset } from '../../assets/teamAssets';

export interface FavoritePlayer {
  _id: string;
  firstName: string;
  lastName: string;
  nbaId: number | null;
  imageUrl: string | null;
  teamId: { abbreviation: string } | null;
}

interface FavoritePlayerCardProps {
  player: FavoritePlayer;
}

/**
 * Favorite player card — same gradient + headshot design as TopPlayerCard
 * but scaled up to 150px to fit the favorites section boxes.
 */
export default function FavoritePlayerCard({
  player,
}: FavoritePlayerCardProps) {
  const abbr = player.teamId?.abbreviation ?? '';
  const asset = getTeamAsset(abbr);

  // Use the NBA CDN headshot if nbaId is available, fall back to imageUrl
  const headshotUrl = player.nbaId
    ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.nbaId}.png`
    : (player.imageUrl ?? '');

  const fullName = `${player.firstName} ${player.lastName}`;

  // Team color fills the left side and fades to dark, matching TopPlayerCard style
  const gradient = `linear-gradient(to right, ${asset.color}dd 0%, #1a1a1a 60%)`;

  return (
    <div className="fpc-card" style={{ background: gradient }}>
      {/* Player headshot — hidden via visibility if the CDN returns a 404 */}
      {headshotUrl && (
        <img
          className="fpc-headshot"
          src={headshotUrl}
          alt={fullName}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
      )}

      {/* Name + team abbreviation anchored to bottom-left */}
      <div className="fpc-info">
        <span className="fpc-name">{fullName}</span>
        {abbr && <span className="fpc-team">{abbr}</span>}
      </div>
    </div>
  );
}
