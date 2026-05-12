import './favoriteTeamCard.css';
import { getTeamAsset } from '../../assets/teamAssets';

export interface FavoriteTeam {
  _id: string;
  name: string;
  abbreviation: string;
  logoUrl: string | null;
}

interface FavoriteTeamCardProps {
  team: FavoriteTeam;
}

/**
 * Favorite team card — team color gradient with large logo on the left,
 * team name + abbreviation stacked on the right. 150px tall to match the
 * favorites section boxes.
 */
export default function FavoriteTeamCard({ team }: FavoriteTeamCardProps) {
  const asset = getTeamAsset(team.abbreviation);
  const logoUrl = team.logoUrl ?? asset.logoUrl;

  // Team color fills the left side and fades to dark
  const gradient = `linear-gradient(to right, ${asset.color}dd 0%, #1a1a1a 65%)`;

  return (
    <div className="ftc-card" style={{ background: gradient }}>
      {/* Team logo anchored to the left edge */}
      {logoUrl && (
        <img
          className="ftc-logo"
          src={logoUrl}
          alt={team.name}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
      )}

      {/* Team name + abbreviation */}
      <div className="ftc-info">
        <span className="ftc-name">{team.name}</span>
        <span className="ftc-abbr">{team.abbreviation}</span>
      </div>
    </div>
  );
}
