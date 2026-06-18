import type { PortType, Resource, Terrain } from '@/game/types';
import type { ScenarioLayout } from '@/game/board/scenarioTypes';
import './SidePanel.css';

const TERRAIN_KEYS: Terrain[] = [
  'wood', 'brick', 'sheep', 'wheat', 'ore', 'desert', 'gold',
];
const TOKEN_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const PORT_KEYS: PortType[] = ['generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'];

interface Props {
  pools: ScenarioLayout['pools'];
  onPoolsChange: (
    next: (p: ScenarioLayout['pools']) => ScenarioLayout['pools'],
  ) => void;
  derived: {
    poolDrawnTerrain: number;
    terrainPoolTotal: number;
    tokenSlots: number;
    tokenPoolTotal: number;
    portCount: number;
    portPoolTotal: number;
  };
  seafarers: boolean;
  // Click to fill the pools with rulebook-standard defaults sized to the
  // current frame. We pass the actual slot counts in so this just maps.
  onAutofill: () => void;
}

export function PoolTunerPanel({ pools, onPoolsChange, derived, seafarers, onAutofill }: Props) {
  const terrainOk = derived.terrainPoolTotal === derived.poolDrawnTerrain;
  const tokenOk = derived.tokenPoolTotal === derived.tokenSlots;
  const portOk = derived.portPoolTotal === derived.portCount;

  const setTerrainCount = (t: Terrain, n: number) => {
    onPoolsChange((p) => {
      const next = { ...p.terrainCounts };
      if (n <= 0) delete next[t];
      else next[t] = n;
      return { ...p, terrainCounts: next };
    });
  };

  const tokenCounts: Record<number, number> = {};
  for (const n of pools.tokens) tokenCounts[n] = (tokenCounts[n] ?? 0) + 1;
  const setTokenCount = (n: number, count: number) => {
    onPoolsChange((p) => {
      const without = p.tokens.filter((t) => t !== n);
      const additions = Array(Math.max(0, count)).fill(n);
      return { ...p, tokens: [...without, ...additions].sort((a, b) => a - b) };
    });
  };

  const portCounts: Record<string, number> = {};
  for (const t of pools.portTypes) portCounts[t] = (portCounts[t] ?? 0) + 1;
  const setPortCount = (t: PortType, count: number) => {
    onPoolsChange((p) => {
      const without = p.portTypes.filter((x) => x !== t);
      const additions = Array(Math.max(0, count)).fill(t) as PortType[];
      return { ...p, portTypes: [...without, ...additions] };
    });
  };

  const visibleTerrains = TERRAIN_KEYS.filter((t) => seafarers || t !== 'gold');

  return (
    <div className="mb-panel">
      <h3>Pool Tuner</h3>
      <button className="mb-tool mb-tool-autofill" onClick={onAutofill}>
        ⚙ Auto-fill from frame
      </button>

      <h4 className={terrainOk ? '' : 'mb-bad'}>
        Terrain pool ({derived.terrainPoolTotal} / {derived.poolDrawnTerrain})
      </h4>
      <div className="mb-pool-grid">
        {visibleTerrains.map((t) => (
          <label key={t} className="mb-pool-cell">
            <span>{t}</span>
            <input
              type="number"
              min={0}
              value={pools.terrainCounts[t as Resource] ?? 0}
              onChange={(e) => setTerrainCount(t, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <h4 className={tokenOk ? '' : 'mb-bad'}>
        Token pool ({derived.tokenPoolTotal} / {derived.tokenSlots})
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

      <h4 className={portOk ? '' : 'mb-bad'}>
        Port pool ({derived.portPoolTotal} / {derived.portCount})
      </h4>
      <div className="mb-pool-grid">
        {PORT_KEYS.map((p) => (
          <label key={p} className="mb-pool-cell">
            <span>{p}</span>
            <input
              type="number"
              min={0}
              value={portCounts[p] ?? 0}
              onChange={(e) => setPortCount(p, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
