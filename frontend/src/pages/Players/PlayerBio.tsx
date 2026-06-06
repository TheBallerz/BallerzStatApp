import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3000/api';

type PlayerBioProps = {
  playerId: number | string;
  fullName: string;
  team?: string;
};

type BioResponse = {
  bio: string;
  sourceUrl?: string;
};

export default function PlayerBio({
  playerId,
  fullName,
  team,
}: PlayerBioProps) {
  const [bioData, setBioData] = useState<BioResponse | null>(null);

  useEffect(() => {
    async function loadBio() {
      try {
        const params = new URLSearchParams({
          fullName,
          team: team || '',
        });

        const res = await fetch(
          `${API_BASE}/players/${playerId}/bio?${params}`,
        );

        if (!res.ok) {
          throw new Error(`Bio request failed: ${res.status}`);
        }

        const data = await res.json();
        setBioData(data);
      } catch (err) {
        console.error(err);
        setBioData({
          bio: 'Biography unavailable.',
        });
      }
    }

    loadBio();
  }, [playerId, fullName, team]);

  if (!bioData) return <p>Loading biography...</p>;

  return (
    <section className="player-bio-card">
      <h2>Biography</h2>
      <p>{bioData.bio}</p>

      {bioData.sourceUrl && (
        <a href={bioData.sourceUrl} target="_blank" rel="noreferrer">
          Source: Wikipedia
        </a>
      )}
    </section>
  );
}
