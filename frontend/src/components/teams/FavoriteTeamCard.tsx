import { useEffect, useState } from 'react';
import './favoriteTeamCard.css';
import { getTeamAsset } from '../../assets/teamAssets';

export interface FavoriteTeam {
  _id: string;
  name: string;
  abbreviation: string;
  logoUrl: string | null;
  nbaId: number | null;
}

interface TeamSummary {
  record:   { wins: number; losses: number };
  rank:     string;
  lastGame: { result: string; teamScore: number; oppScore: number; oppAbbr: string } | null;
  nextGame: { oppAbbr: string; gameDate: string; startTime: string } | null;
}

interface FavoriteTeamCardProps {
  team: FavoriteTeam;
  onClick?: () => void;
  /** When true the card is dimmed and non-interactive */
  isGreyed?: boolean;
}

export default function FavoriteTeamCard({ team, onClick, isGreyed }: FavoriteTeamCardProps) {
  const asset  = getTeamAsset(team.abbreviation);
  const logoUrl = team.logoUrl ?? asset.logoUrl;
  const gradient = `linear-gradient(to right, ${asset.color}cc 0%, #1a1a1a 52%)`;

  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(!!team.nbaId);

  useEffect(() => {
    if (!team.nbaId) return;
    setLoading(true);
    fetch(`/api/teams/${team.nbaId}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [team.nbaId]);

  // ── Formatted display strings ───────────────────────────────────────────────
  const lastGameStr = summary?.lastGame
    ? `${summary.lastGame.result === 'W' ? 'Win' : 'Loss'} ${summary.lastGame.teamScore}–${summary.lastGame.oppScore} vs ${summary.lastGame.oppAbbr}`
    : '--';

  const nextGameStr = summary?.nextGame
    ? `vs ${summary.nextGame.oppAbbr} · ${summary.nextGame.gameDate}${summary.nextGame.startTime ? ` · ${summary.nextGame.startTime}` : ''}`
    : '--';

  return (
    <div
      className="ftc-card"
      style={{
        background: gradient,
        ...(isGreyed ? { filter: 'grayscale(0.8) opacity(0.4)', pointerEvents: 'none' } : {}),
      }}
      onClick={onClick}
    >
      {/* Left column — name + logo */}
      <div className="ftc-left">
        <div className="ftc-info">
          <span className="ftc-name">{team.name}</span>
        </div>
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
      </div>

      {/* Right column — stats + schedule */}
      <div className="ftc-right">
        {loading ? (
          <div className="ftc-loading" />
        ) : summary ? (
          <>
            {/* Stats section */}
            <div className="ftc-section">
              <div className="ftc-section-header">Stats</div>
              <table className="ftc-table">
                <tbody>
                  <tr className="ftc-row">
                    <td className="ftc-label">Win - Loss</td>
                    <td className="ftc-value">{summary.record.wins} - {summary.record.losses}</td>
                  </tr>
                  <tr className="ftc-row">
                    <td className="ftc-label">Rank</td>
                    <td className="ftc-value">{summary.rank}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="ftc-divider" />

            {/* Schedule section */}
            <div className="ftc-section">
              <div className="ftc-section-header">Schedule</div>
              <table className="ftc-table">
                <tbody>
                  <tr className="ftc-row">
                    <td className="ftc-label">Last Game</td>
                    <td className="ftc-value">{lastGameStr}</td>
                  </tr>
                  <tr className="ftc-row">
                    <td className="ftc-label">Next Game</td>
                    <td className="ftc-value">{nextGameStr}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
