import type { Terrain } from '../types';
import { shuffle } from '../rng';
import type { ScenarioLayout, ScenarioPosition } from './scenarioTypes';

// A terrain + token pool consumed only by fog cells. No port pool — fog
// tiles never carry ports. Shape mirrors `CustomMap.fogPools` but lives in
// the board layer so both the custom-map generator and the Seafarers
// generator can use it.
export interface FogPoolDef {
  terrainCounts: Partial<Record<Terrain, number>>;
  tokens: number[];
}

// Terrains drawn from the fog pool that don't consume a token slot. Sea
// reveals as open water; desert reveals as the desert terrain itself.
const NON_PRODUCING_FOG_TERRAINS = new Set<Terrain>([
  'sea',
  'desert',
  'swamp',
  'wateringHole',
  'castle',
]);

// Materialize fog cells: pre-shuffles `pool` with the seeded RNG and pins
// each fog hex's terrain (+ optional token) on the layout. The regular
// `materializeLayout` then sees those cells as pinned and skips them from
// the main terrain / token pool draws.
export function injectFogPools(
  layout: ScenarioLayout,
  fogHexes: { q: number; r: number }[],
  pool: FogPoolDef,
  rngState: number,
): { layout: ScenarioLayout; rngState: number } {
  let rng = rngState;

  const terrainPool: Terrain[] = [];
  for (const [t, n] of Object.entries(pool.terrainCounts)) {
    for (let i = 0; i < (n ?? 0); i++) terrainPool.push(t as Terrain);
  }
  let shuffledTerrains: Terrain[];
  [shuffledTerrains, rng] = shuffle(rng, terrainPool);
  let shuffledTokens: number[];
  [shuffledTokens, rng] = shuffle(rng, pool.tokens);

  const fogKey = (q: number, r: number) => `${q},${r}`;
  const fogIndex = new Map<string, number>();
  fogHexes.forEach((f, i) => fogIndex.set(fogKey(f.q, f.r), i));

  let tokenCursor = 0;
  const fogTerrain = new Map<string, Terrain>();
  const fogToken = new Map<string, number>();
  shuffledTerrains.forEach((terrain, i) => {
    const f = fogHexes[i]!;
    fogTerrain.set(fogKey(f.q, f.r), terrain);
    if (!NON_PRODUCING_FOG_TERRAINS.has(terrain)) {
      fogToken.set(fogKey(f.q, f.r), shuffledTokens[tokenCursor++]!);
    }
  });

  const nextPositions: ScenarioPosition[] = layout.positions.map((p) => {
    if (!fogIndex.has(fogKey(p.q, p.r))) return p;
    const key = fogKey(p.q, p.r);
    const terrain = fogTerrain.get(key)!;
    const tok = fogToken.get(key);
    const kind: ScenarioPosition['kind'] =
      terrain === 'sea' ? 'sea' : terrain === 'desert' ? 'desert' : 'land';
    const fixedTerrain =
      terrain === 'sea' || terrain === 'desert' ? undefined : terrain;
    return {
      ...p,
      kind,
      ...(fixedTerrain ? { fixedTerrain } : { fixedTerrain: undefined }),
      ...(tok != null ? { fixedToken: tok } : {}),
    };
  });

  return {
    layout: { ...layout, positions: nextPositions },
    rngState: rng,
  };
}
