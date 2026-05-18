import type { Port, Terrain } from '../types';
import { shuffle } from '../rng';
import type {
  ScenarioHexDef,
  ScenarioLayout,
  ScenarioPortDef,
} from './scenarioTypes';

// Materialize a ScenarioLayout into per-hex (terrain, token) defs and per-port
// (type) defs. Pulls each randomized field from a shuffled pool using the
// seeded RNG, retrying the token shuffle until 6/8 hexes are not adjacent
// (skipped when `layout.tokenConstraints.allow6_8Adjacent` is true).
// Fixed-terrain positions skip the terrain pool draw but still participate in
// token distribution.

const MAX_TOKEN_RETRIES = 500;

export interface MaterializeResult {
  hexDefs: ScenarioHexDef[];
  portDefs: ScenarioPortDef[];
  rngState: number;
}

export function materializeLayout(
  layout: ScenarioLayout,
  rngState: number,
): MaterializeResult {
  let rng = rngState;

  // ----- Terrain assignment -----
  // 1. Sea and desert positions take their kind as terrain (no pool draw).
  // 2. Fixed-terrain land positions take their `fixedTerrain` (no pool draw).
  // 3. Remaining land positions take terrains from a shuffled pool whose
  //    counts come from `pools.terrainCounts`.
  const terrainPool: Terrain[] = [];
  for (const [t, n] of Object.entries(layout.pools.terrainCounts)) {
    for (let i = 0; i < (n ?? 0); i++) terrainPool.push(t as Terrain);
  }
  let shuffledTerrains: Terrain[];
  [shuffledTerrains, rng] = shuffle(rng, terrainPool);

  const hexDefs: ScenarioHexDef[] = [];
  let terrainCursor = 0;
  for (const pos of layout.positions) {
    let terrain: Terrain;
    if (pos.kind === 'sea') {
      terrain = 'sea';
    } else if (pos.kind === 'desert') {
      terrain = 'desert';
    } else if (pos.fixedTerrain) {
      terrain = pos.fixedTerrain;
    } else {
      terrain = shuffledTerrains[terrainCursor++]!;
    }
    hexDefs.push({ q: pos.q, r: pos.r, terrain, token: null });
  }
  if (terrainCursor !== shuffledTerrains.length) {
    throw new Error(
      `Scenario layout terrain pool mismatch: pool has ${shuffledTerrains.length} terrains but only ${terrainCursor} land positions need filling`,
    );
  }

  // ----- Token assignment -----
  const tokenIndices: number[] = [];
  for (let i = 0; i < hexDefs.length; i++) {
    const h = hexDefs[i]!;
    if (h.terrain !== 'sea' && h.terrain !== 'desert') tokenIndices.push(i);
  }
  if (tokenIndices.length !== layout.pools.tokens.length) {
    throw new Error(
      `Scenario layout token pool mismatch: pool has ${layout.pools.tokens.length} tokens but ${tokenIndices.length} non-desert land positions need them`,
    );
  }

  const adj = buildAxialAdjacency(hexDefs, tokenIndices);
  const allow6_8Adjacent = layout.tokenConstraints?.allow6_8Adjacent === true;

  let assigned: number[] | null = null;
  for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
    let shuffledTokens: number[];
    [shuffledTokens, rng] = shuffle(rng, layout.pools.tokens);
    if (allow6_8Adjacent || !hasAdjacentReds(shuffledTokens, adj)) {
      assigned = shuffledTokens;
      break;
    }
  }
  if (!assigned) {
    [assigned, rng] = shuffle(rng, layout.pools.tokens);
  }
  for (let i = 0; i < tokenIndices.length; i++) {
    hexDefs[tokenIndices[i]!]!.token = assigned[i]!;
  }

  // ----- Port type assignment -----
  if (layout.pools.portTypes.length !== layout.portAnchors.length) {
    throw new Error(
      `Scenario layout port pool mismatch: ${layout.portAnchors.length} anchors but ${layout.pools.portTypes.length} types`,
    );
  }
  let shuffledPorts: Port['type'][];
  [shuffledPorts, rng] = shuffle(rng, layout.pools.portTypes);
  const portDefs: ScenarioPortDef[] = layout.portAnchors.map((a, i) => ({
    q: a.q,
    r: a.r,
    direction: a.direction,
    type: shuffledPorts[i]!,
  }));

  return { hexDefs, portDefs, rngState: rng };
}

function buildAxialAdjacency(
  hexDefs: ScenarioHexDef[],
  tokenIndices: number[],
): number[][] {
  const NEIGHBOURS: Array<[number, number]> = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];
  const tokenSet = new Map<string, number>();
  for (let pos = 0; pos < tokenIndices.length; pos++) {
    const h = hexDefs[tokenIndices[pos]!]!;
    tokenSet.set(`${h.q},${h.r}`, pos);
  }
  const adj: number[][] = tokenIndices.map(() => []);
  for (let pos = 0; pos < tokenIndices.length; pos++) {
    const h = hexDefs[tokenIndices[pos]!]!;
    for (const [dq, dr] of NEIGHBOURS) {
      const nKey = `${h.q + dq},${h.r + dr}`;
      const nPos = tokenSet.get(nKey);
      if (nPos != null) adj[pos]!.push(nPos);
    }
  }
  return adj;
}

function hasAdjacentReds(tokens: number[], adj: number[][]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t !== 6 && t !== 8) continue;
    for (const j of adj[i]!) {
      const nt = tokens[j]!;
      if (nt === 6 || nt === 8) return true;
    }
  }
  return false;
}
