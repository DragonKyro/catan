import type { Resource, Terrain } from '@/game/types';
import type { FogPools } from '@/game/customMap/types';
import './SidePanel.css';

// Fog tiles may reveal as any of these terrains. 'sea' is allowed so a
// foggy hex can turn out to be open water — useful for hiding the actual
// coastline of an outer island until exploration reaches it.
const TERRAIN_KEYS: Terrain[] = [
  'wood', 'brick', 'sheep', 'wheat', 'ore', 'desert', 'gold', 'sea',
];
const TOKEN_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

interface Props {
  pools: FogPools | undefined;
  onPoolsChange: (next: (p: FogPools) => FogPools) => void;
  derived: {
    fogCount: number;
    fogTerrainTotal: number;
    fogTokenTotal: number;
    fogTokenSlots: number;
  };
}

// Separate terrain + token pool that fog tiles draw from at game start.
// Identical layout to the main PoolTunerPanel but without ports.
export function FogPoolTunerPanel({ pools, onPoolsChange, derived }: Props) {
  const safe: FogPools = pools ?? { terrainCounts: {}, tokens: [] };
  const terrainOk = derived.fogTerrainTotal === derived.fogCount;
  const tokenOk = derived.fogTokenTotal === derived.fogTokenSlots;

  const setTerrainCount = (t: Terrain, n: number) => {
    onPoolsChange((p) => {
      const next = { ...p.terrainCounts };
      if (n <= 0) delete next[t];
      else next[t] = n;
      return { ...p, terrainCounts: next };
    });
  };

  const tokenCounts: Record<number, number> = {};
  for (const n of safe.tokens) tokenCounts[n] = (tokenCounts[n] ?? 0) + 1;
  const setTokenCount = (n: number, count: number) => {
    onPoolsChange((p) => {
      const without = p.tokens.filter((t) => t !== n);
      const additions = Array(Math.max(0, count)).fill(n);
      return { ...p, tokens: [...without, ...additions].sort((a, b) => a - b) };
    });
  };

  if (derived.fogCount === 0) {
    return (
      <div className="mb-panel">
        <h3>Fog pool</h3>
        <p style={{ fontSize: 12, color: '#ffffff80', margin: 0 }}>
          Paint a hex with the ☁ Toggle fog tool to enable the fog pool.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-panel">
      <h3>Fog pool</h3>
      <p style={{ fontSize: 12, color: '#ffffff80', margin: '0 0 8px 0' }}>
        Fog tiles draw terrain + token from this pool (separate from the
        main map). {derived.fogCount} fog tile{derived.fogCount === 1 ? '' : 's'}.
      </p>

      <h4 className={terrainOk ? '' : 'mb-bad'}>
        Fog terrain ({derived.fogTerrainTotal} / {derived.fogCount})
      </h4>
      <div className="mb-pool-grid">
        {TERRAIN_KEYS.map((t) => (
          <label key={t} className="mb-pool-cell">
            <span>{t}</span>
            <input
              type="number"
              min={0}
              value={safe.terrainCounts[t as Resource] ?? 0}
              onChange={(e) => setTerrainCount(t, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <h4 className={tokenOk ? '' : 'mb-bad'}>
        Fog tokens ({derived.fogTokenTotal} / {derived.fogTokenSlots})
      </h4>
      <div className="mb-pool-grid">
        {TOKEN_NUMBERS.map((n) => (
          <label key={n} className="mb-pool-cell">
            <span>{n}</span>
            <input
              type="number"
              min={0}
              value={tokenCounts[n] ?? 0}
              onChange={(e) => setTokenCount(n, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
