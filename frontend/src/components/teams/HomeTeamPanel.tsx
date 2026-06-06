import { useEffect, useState } from 'react';
import './homeTeamPanel.css';
import { getTeamAsset } from '../../assets/teamAssets';
import TeamStatChart from './TeamStatChart';

interface TeamData {
  teamId: number;
  city: string;
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  record: string;
  ppg: number;
  rpg: number;
  apg: number;
  fg3m: number;
  fgPct: number;
}

interface HomeTeamPanelProps {
  nbaTeamId: number;
  label: string;
  onClose: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  showCompare?: boolean;
  onCompareYourself?: (stats: {
    pts: number;
    ast: number;
    reb: number;
    fg3m: number;
  }) => void;
}

function fmt(val: number): string {
  return val.toFixed(1);
}

export default function HomeTeamPanel({
  nbaTeamId,
  label,
  onClose,
  isFavorited,
  onToggleFavorite,
  showCompare,
  onCompareYourself,
}: HomeTeamPanelProps) {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setTeam(null);
    setError('');
    setLoading(true);

    async function load() {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_API_BASE}/teams/${nbaTeamId}`,
        );

        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        setTeam(await r.json());
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [nbaTeamId]);

  const abbr = team?.abbreviation ?? label;
  const asset = getTeamAsset(abbr);
  const fullName = team?.name ?? label;
  const headerGradient = `linear-gradient(to bottom, ${asset.color}55 0%, #1a1a1a 100%)`;

  const TILE_STATS: {
    key: keyof TeamData | 'fgPctDisplay';
    label: string;
    isRecord?: boolean;
  }[] = [
    { key: 'record', label: 'Record', isRecord: true },
    { key: 'ppg', label: 'PPG' },
    { key: 'rpg', label: 'RPG' },
    { key: 'apg', label: 'APG' },
    { key: 'fg3m', label: '3PM' },
    { key: 'fgPctDisplay', label: 'FG%' },
  ];

  return (
    <div className="htp-panel">
      <div className="htp-header" style={{ background: headerGradient }}>
        <div className="htp-identity">
          <h2 className="htp-name">{fullName}</h2>
          {team && (
            <span className="htp-division">{team.division} Division</span>
          )}
        </div>

        <div className="htp-header-right">
          <div className="htp-logo-circle">
            <img
              className="htp-logo"
              src={asset.logoUrl}
              alt={abbr}
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden';
              }}
            />
          </div>

          <div className="htp-actions">
            <button className="htp-close" onClick={onClose}>
              ×
            </button>

            {onToggleFavorite && (
              <button
                className={`htp-heart${isFavorited ? ' htp-heart--filled' : ''}`}
                aria-label={
                  isFavorited ? 'Remove from favorites' : 'Add to favorites'
                }
                onClick={onToggleFavorite}
              >
                {isFavorited ? '♥' : '♡'}
              </button>
            )}
          </div>
        </div>
      </div>

      <TeamStatChart nbaTeamId={nbaTeamId} color={asset.color} />

      <div className="htp-divider" />

      <div className="htp-body">
        {loading ? (
          <p className="htp-status">Loading…</p>
        ) : error || !team ? (
          <p className="htp-status">{error || 'No data found'}</p>
        ) : (
          <>
            <p className="htp-section-label">Season Averages</p>

            <div className="htp-stats-grid">
              {TILE_STATS.map(({ key, label: lbl, isRecord }) => {
                if (isRecord) {
                  return (
                    <div key={key} className="htp-stat-tile">
                      <span className="htp-tile-value">{team.record}</span>
                      <span className="htp-tile-label">{lbl}</span>
                    </div>
                  );
                }

                const seasonVal =
                  key === 'fgPctDisplay'
                    ? team.fgPct * 100
                    : (team[key as keyof TeamData] as number);

                const displayVal =
                  key === 'fgPctDisplay'
                    ? `${seasonVal.toFixed(1)}%`
                    : fmt(seasonVal);

                return (
                  <div key={key} className="htp-stat-tile">
                    <span className="htp-tile-value">{displayVal}</span>
                    <span className="htp-tile-label">{lbl}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showCompare && team && onCompareYourself && (
        <div className="htp-compare-wrap">
          <button
            className="htp-compare-btn"
            onClick={() =>
              onCompareYourself({
                pts: team.ppg,
                ast: team.apg,
                reb: team.rpg,
                fg3m: team.fg3m,
              })
            }
          >
            Compare Yourself
          </button>
        </div>
      )}
    </div>
  );
}