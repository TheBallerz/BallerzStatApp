// teamAssets.ts
// Maps NBA team abbreviations (as returned by the NBA Stats API) to each team's
// primary brand color and official CDN logo URL.
//
// Colors are the primary jersey/brand color used as the dominant gradient stop
// in game cards. Logo URLs point to the NBA CDN SVGs (same source as teamLogos.ts).

export interface TeamAsset {
  color: string;
  logoUrl: string;
}

export const TEAM_ASSETS: Record<string, TeamAsset> = {
  // ── Atlantic ────────────────────────────────────────────────────────────────
  BOS: { color: '#007A33', logoUrl: 'https://cdn.nba.com/logos/nba/1610612738/global/L/logo.svg' },
  BKN: { color: '#000000', logoUrl: 'https://cdn.nba.com/logos/nba/1610612751/global/L/logo.svg' },
  NYK: { color: '#F58426', logoUrl: 'https://cdn.nba.com/logos/nba/1610612752/global/L/logo.svg' },
  PHI: { color: '#006BB6', logoUrl: 'https://cdn.nba.com/logos/nba/1610612755/global/L/logo.svg' },
  TOR: { color: '#CE1141', logoUrl: 'https://cdn.nba.com/logos/nba/1610612761/global/L/logo.svg' },

  // ── Central ─────────────────────────────────────────────────────────────────
  CHI: { color: '#CE1141', logoUrl: 'https://cdn.nba.com/logos/nba/1610612741/global/L/logo.svg' },
  CLE: { color: '#860038', logoUrl: 'https://cdn.nba.com/logos/nba/1610612739/global/L/logo.svg' },
  DET: { color: '#C8102E', logoUrl: 'https://cdn.nba.com/logos/nba/1610612765/global/L/logo.svg' },
  IND: { color: '#002D62', logoUrl: 'https://cdn.nba.com/logos/nba/1610612754/global/L/logo.svg' },
  MIL: { color: '#00471B', logoUrl: 'https://cdn.nba.com/logos/nba/1610612749/global/L/logo.svg' },

  // ── Southeast ────────────────────────────────────────────────────────────────
  ATL: { color: '#E03A3E', logoUrl: 'https://cdn.nba.com/logos/nba/1610612737/global/L/logo.svg' },
  CHA: { color: '#1D1160', logoUrl: 'https://cdn.nba.com/logos/nba/1610612766/global/L/logo.svg' },
  MIA: { color: '#98002E', logoUrl: 'https://cdn.nba.com/logos/nba/1610612748/global/L/logo.svg' },
  ORL: { color: '#0077C0', logoUrl: 'https://cdn.nba.com/logos/nba/1610612753/global/L/logo.svg' },
  WAS: { color: '#002B5C', logoUrl: 'https://cdn.nba.com/logos/nba/1610612764/global/L/logo.svg' },

  // ── Northwest ────────────────────────────────────────────────────────────────
  DEN: { color: '#0E2240', logoUrl: 'https://cdn.nba.com/logos/nba/1610612743/global/L/logo.svg' },
  MIN: { color: '#0C2340', logoUrl: 'https://cdn.nba.com/logos/nba/1610612750/global/L/logo.svg' },
  OKC: { color: '#007AC1', logoUrl: 'https://cdn.nba.com/logos/nba/1610612760/global/L/logo.svg' },
  POR: { color: '#E03A3E', logoUrl: 'https://cdn.nba.com/logos/nba/1610612757/global/L/logo.svg' },
  UTA: { color: '#002B5C', logoUrl: 'https://cdn.nba.com/logos/nba/1610612762/global/L/logo.svg' },

  // ── Pacific ──────────────────────────────────────────────────────────────────
  GSW: { color: '#1D428A', logoUrl: 'https://cdn.nba.com/logos/nba/1610612744/global/L/logo.svg' },
  LAC: { color: '#C8102E', logoUrl: 'https://cdn.nba.com/logos/nba/1610612746/global/L/logo.svg' },
  LAL: { color: '#552583', logoUrl: 'https://cdn.nba.com/logos/nba/1610612747/global/L/logo.svg' },
  PHX: { color: '#1D1160', logoUrl: 'https://cdn.nba.com/logos/nba/1610612756/global/L/logo.svg' },
  SAC: { color: '#5A2D81', logoUrl: 'https://cdn.nba.com/logos/nba/1610612758/global/L/logo.svg' },

  // ── Southwest ────────────────────────────────────────────────────────────────
  DAL: { color: '#00538C', logoUrl: 'https://cdn.nba.com/logos/nba/1610612742/global/L/logo.svg' },
  HOU: { color: '#CE1141', logoUrl: 'https://cdn.nba.com/logos/nba/1610612745/global/L/logo.svg' },
  MEM: { color: '#5D76A9', logoUrl: 'https://cdn.nba.com/logos/nba/1610612763/global/L/logo.svg' },
  NOP: { color: '#0C2340', logoUrl: 'https://cdn.nba.com/logos/nba/1610612740/global/L/logo.svg' },
  SAS: { color: '#8A8D8F', logoUrl: 'https://cdn.nba.com/logos/nba/1610612759/global/L/logo.svg' },
};

/** Returns the TeamAsset for a given abbreviation, or a neutral fallback. */
export function getTeamAsset(abbr: string): TeamAsset {
  return TEAM_ASSETS[abbr] ?? { color: '#333333', logoUrl: '' };
}
