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
  // Standard rule: every non-sea, non-desert hex gets a token. Volcano-style
  // scenarios opt into a token on a desert position via `forceToken: true`.
  // Positions with `fixedToken` skip the pool draw and take their pinned
  // value instead (used to pin the volcano's number so it erupts on a
  // common roll).
  const poolIndices: number[] = []; // positions taking a token from the pool
  const fixedAssignments: Array<{ index: number; token: number }> = [];
  for (let i = 0; i < hexDefs.length; i++) {
    const h = hexDefs[i]!;
    const pos = layout.positions[i]!;
    if (h.terrain === 'sea') continue;
    if (h.terrain === 'desert' && !pos.forceToken) continue;
    // Swamp (T&B Rivers of Catan) — non-producing like desert. Never takes a
    // token; `forceToken` doesn't apply since swamps don't roll for events.
    if (h.terrain === 'swamp') continue;
    if (pos.fixedToken != null) {
      fixedAssignments.push({ index: i, token: pos.fixedToken });
    } else {
      poolIndices.push(i);
    }
  }
  if (poolIndices.length !== layout.pools.tokens.length) {
    throw new Error(
      `Scenario layout token pool mismatch: pool has ${layout.pools.tokens.length} tokens but ${poolIndices.length} pool-drawn token positions need them`,
    );
  }

  // Apply fixed assignments first so the 6/8 retry sees them.
  for (const { index, token } of fixedAssignments) {
    hexDefs[index]!.token = token;
  }

  // Build adjacency over ALL tokenized positions (pool-drawn + fixed) so
  // 6/8 constraints account for the volcano.
  const allTokenized = [...poolIndices, ...fixedAssignments.map((a) => a.index)];
  const adj = buildAxialAdjacency(hexDefs, allTokenized);
  const allow6_8Adjacent = layout.tokenConstraints?.allow6_8Adjacent === true;

  let assigned: number[] | null = null;
  for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
    let shuffledTokens: number[];
    [shuffledTokens, rng] = shuffle(rng, layout.pools.tokens);
    const combined = [
      ...shuffledTokens,
      ...fixedAssignments.map((a) => a.token),
    ];
    if (allow6_8Adjacent || !hasAdjacentReds(combined, adj)) {
      assigned = shuffledTokens;
      break;
    }
  }
  if (!assigned) {
    [assigned, rng] = shuffle(rng, layout.pools.tokens);
  }
  for (let i = 0; i < poolIndices.length; i++) {
    hexDefs[poolIndices[i]!]!.token = assigned[i]!;
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
