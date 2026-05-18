import type {
  BoardState,
  Hex,
  HexId,
  Port,
  Terrain,
} from '../../../types';
import type { IslandChip, PirateFleet, TribeToken } from '../../../types';
import { buildGraphFromCoords, type BaseGraph } from '../../../board/graph';
import { shuffle } from '../../../rng';
import { getScenario } from './scenarios';
import { identifyIslands } from './islands';
import type {
  Scenario,
  ScenarioHexDef,
  ScenarioLayout,
  ScenarioPortDef,
} from './types';

export interface SeafarersBoardResult {
  board: BoardState;
  rngState: number;
  islandChips: IslandChip[];
  tribeTokens: TribeToken[];
  unrevealedFogHexes: HexId[];
  pirateFleet?: PirateFleet;
  clothHexes: HexId[];
}

// Build a Seafarers BoardState from a scenario id. When `numPlayers >= 5`
// and the scenario declares a `hexes5_6` variant, the larger 5-6 player
// layout is used. Falls back to the 3-4 layout otherwise.
export function generateSeafarersBoard(
  scenarioId: string | undefined,
  rngState: number,
  numPlayers = 3,
): SeafarersBoardResult {
  const scenario = getScenario(scenarioId);
  // Track this for the legacy mechanic-data lookups below (tribeTokens5_6,
  // fogHexes5_6, etc.). The actual hex/port source switches based on whether
  // a modular layout exists.
  const useLarge = numPlayers >= 5;

  // Modular path: when the scenario provides a `layout3p` (and optional
  // layout4p / layout5_6p), materialize hexes + ports by drawing terrains,
  // tokens and port types from the pool. Otherwise fall back to the legacy
  // fixed-content `hexes` / `ports` arrays.
  const layout = pickLayout(scenario, numPlayers);
  let hexDefs: ScenarioHexDef[];
  let portDefs: { q: number; r: number; direction: number; type: Port['type'] }[];
  let layoutRobberHint: { q: number; r: number } | undefined;
  let layoutPirateHint: { q: number; r: number } | undefined;
  if (layout) {
    const m = materializeLayout(layout, rngState);
    hexDefs = m.hexDefs;
    portDefs = m.portDefs;
    rngState = m.rngState;
    layoutRobberHint = layout.robberStart;
    layoutPirateHint = layout.pirateStart;
  } else {
    hexDefs = useLarge && scenario.hexes5_6 ? scenario.hexes5_6 : scenario.hexes;
    portDefs = useLarge && scenario.ports5_6 ? scenario.ports5_6 : scenario.ports;
  }
  const coords = hexDefs.map((h) => ({ q: h.q, r: h.r }));
  const graph = buildGraphFromCoords(coords);

  const hexes: Record<HexId, Hex> = {};
  let robberHex: HexId | null = null;
  let pirateHex: HexId | null = null;

  // Map scenario defs onto the graph hex ids.
  const defByKey = new Map(hexDefs.map((h) => [`${h.q},${h.r}`, h]));

  for (const hexId of graph.hexIds) {
    const coord = graph.hexCoords.get(hexId)!;
    const key = `${coord.q},${coord.r}`;
    const def = defByKey.get(key)!;
    const corners = graph.hexCorners.get(hexId)!;
    const center = hexCenter(graph, corners);
    hexes[hexId] = {
      id: hexId,
      coord,
      terrain: def.terrain,
      numberToken: def.token,
      corners,
      center,
    };
    if (def.terrain === 'desert' && robberHex === null) robberHex = hexId;
    if (def.terrain === 'sea' && pirateHex === null) pirateHex = hexId;
  }

  // Modular layouts may override the default robber/pirate placement.
  if (layoutRobberHint) {
    const hint = `${layoutRobberHint.q},${layoutRobberHint.r}`;
    if (hexes[hint]) robberHex = hint;
  }
  if (layoutPirateHint) {
    const hint = `${layoutPirateHint.q},${layoutPirateHint.r}`;
    if (hexes[hint]) pirateHex = hint;
  }

  // Fallbacks: scenarios with no desert place the robber on any non-sea hex
  // outside play (we'd never use it, but the engine requires a HexId).
  if (robberHex === null) {
    robberHex = graph.hexIds.find((id) => hexes[id]!.terrain !== 'sea') ?? graph.hexIds[0]!;
  }
  if (pirateHex === null) {
    pirateHex = graph.hexIds.find((id) => hexes[id]!.terrain === 'sea') ?? graph.hexIds[0]!;
  }

  const ports = resolvePorts(portDefs, graph);

  // Identify islands so the rendering layer can highlight them and so the
  // settlement-handler intercept (phase 6) can award the right chip.
  const partialBoard: BoardState = {
    hexes,
    vertices: graph.vertices,
    edges: graph.edges,
    ports,
    robberHex,
    hexIds: graph.hexIds,
    vertexIds: graph.vertexIds,
    edgeIds: graph.edgeIds,
    pirateHex,
    islandOfHex: {},
  };
  const islands = identifyIslands(partialBoard, {
    desertIsBoundary: scenario.desertIsBoundary === true,
  });
  partialBoard.islandOfHex = islands.hexToIsland;

  const islandChips: IslandChip[] = islands.outerIslandIds.map((id) => ({
    islandId: id,
    vp: scenario.islandBonusVp?.[id] ?? scenario.defaultIslandBonusVp,
    firstSettler: null,
  }));

  // Forgotten Tribe: instantiate tribe-token defs onto the actual hex ids.
  // Quietly drop any token whose anchor hex isn't on the generated board
  // (e.g. a 3-4p-only token for a 5-6p generation).
  const tokenDefs = useLarge && scenario.tribeTokens5_6
    ? scenario.tribeTokens5_6
    : scenario.tribeTokens ?? [];
  const tribeTokens: TribeToken[] = [];
  for (const def of tokenDefs) {
    const hexId = `${def.q},${def.r}`;
    if (!partialBoard.hexes[hexId]) continue;
    tribeTokens.push({ hexId, type: def.type, claimedBy: null });
  }

  // Fog Island: collect the starting fog set. Coords that aren't actually
  // on the generated board are quietly dropped (matches tribeToken handling).
  const fogDefs = useLarge && scenario.fogHexes5_6
    ? scenario.fogHexes5_6
    : scenario.fogHexes ?? [];
  const unrevealedFogHexes: HexId[] = [];
  for (const def of fogDefs) {
    const hexId = `${def.q},${def.r}`;
    if (partialBoard.hexes[hexId]) unrevealedFogHexes.push(hexId);
  }

  // Pirate Islands: anchor the fleet on the scenario's designated sea hex.
  // If the coord doesn't resolve to a board hex (unusual — shouldn't happen
  // for shipped scenarios), pirateFleet stays undefined.
  const fleetDef = useLarge && scenario.pirateFleet5_6
    ? scenario.pirateFleet5_6
    : scenario.pirateFleet;
  let pirateFleet: PirateFleet | undefined;
  if (fleetDef) {
    const hexId = `${fleetDef.q},${fleetDef.r}`;
    if (partialBoard.hexes[hexId]) {
      pirateFleet = {
        hexId,
        strength: fleetDef.strength,
        maxStrength: fleetDef.strength,
        defeatedBy: null,
      };
    }
  }

  // Cloth for Catan: resolve cloth-hex coordinates to live hex ids. Quietly
  // drop coords that aren't on the generated board.
  const clothDefs = useLarge && scenario.clothHexes5_6
    ? scenario.clothHexes5_6
    : scenario.clothHexes ?? [];
  const clothHexes: HexId[] = [];
  for (const def of clothDefs) {
    const hexId = `${def.q},${def.r}`;
    if (partialBoard.hexes[hexId]) clothHexes.push(hexId);
  }

  return {
    board: partialBoard,
    rngState,
    islandChips,
    tribeTokens,
    unrevealedFogHexes,
    pirateFleet,
    clothHexes,
  };
}

function hexCenter(
  graph: BaseGraph,
  corners: ReturnType<BaseGraph['hexCorners']['get']> & {},
): { x: number; y: number } {
  let cx = 0;
  let cy = 0;
  for (const vid of corners) {
    cx += graph.vertices[vid]!.position.x;
    cy += graph.vertices[vid]!.position.y;
  }
  cx /= corners.length;
  cy /= corners.length;
  return { x: Math.round(cx * 100) / 100, y: Math.round(cy * 100) / 100 };
}

// Pick the modular layout for the current player count. 4p falls back to the
// 3p layout when the scenario doesn't ship a separate 4p frame (most don't —
// Heading for New Shores and Through the Desert are the exceptions). Returns
// `null` when the scenario hasn't migrated to the modular format yet.
function pickLayout(scenario: Scenario, numPlayers: number): ScenarioLayout | null {
  if (numPlayers >= 5) return scenario.layout5_6p ?? null;
  if (numPlayers === 4) return scenario.layout4p ?? scenario.layout3p ?? null;
  return scenario.layout3p ?? null;
}

// Materialize a ScenarioLayout into the (terrain, token) per-hex defs and
// port-type-per-anchor defs that the rest of the generator already knows how
// to consume. Pulls each randomized field from a shuffled pool using the
// seeded RNG, retrying the token shuffle a few times if 6/8 hexes end up
// adjacent. Fixed-terrain positions skip the terrain pool draw but still
// participate in token distribution.
const MAX_TOKEN_RETRIES = 500;

function materializeLayout(
  layout: ScenarioLayout,
  rngState: number,
): {
  hexDefs: ScenarioHexDef[];
  portDefs: ScenarioPortDef[];
  rngState: number;
} {
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
    // Tokens are filled in below — leave null for now.
    hexDefs.push({ q: pos.q, r: pos.r, terrain, token: null });
  }
  if (terrainCursor !== shuffledTerrains.length) {
    throw new Error(
      `Scenario layout terrain pool mismatch: pool has ${shuffledTerrains.length} terrains but only ${terrainCursor} land positions need filling`,
    );
  }

  // ----- Token assignment -----
  // Tokens go on every non-desert, non-sea hex. Retry the shuffle if the
  // placement puts two reds (6 or 8) adjacent — the standard Catan rule.
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

  // Precompute axial-adjacency between non-desert positions so the retry can
  // cheaply check 6/8 adjacency.
  const adj = buildAxialAdjacency(hexDefs, tokenIndices);

  let assigned: number[] | null = null;
  for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
    let shuffledTokens: number[];
    [shuffledTokens, rng] = shuffle(rng, layout.pools.tokens);
    if (!hasAdjacentReds(shuffledTokens, adj)) {
      assigned = shuffledTokens;
      break;
    }
  }
  // Fallback: accept whatever the last shuffle produced. Extremely rare in
  // practice — 500 attempts on a typical Seafarers token mix is plenty.
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

// Build q,r → indices-of-axial-neighbours-in-tokenIndices map, used by the
// 6/8 adjacency retry.
function buildAxialAdjacency(
  hexDefs: ScenarioHexDef[],
  tokenIndices: number[],
): number[][] {
  const NEIGHBOURS = [
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
      const nKey = `${h.q + dq!},${h.r + dr!}`;
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

// Resolve a port anchor (q, r, direction) to an actual edge id. Direction 0
// is the upper-right edge (between corners 0 and 1) clockwise around a
// pointy-top hex. We look up the edge by finding the two corners (i, i+1) of
// the anchor hex.
function resolvePorts(
  portDefs: { q: number; r: number; direction: number; type: Port['type'] }[],
  graph: BaseGraph,
): Port[] {
  const out: Port[] = [];
  for (const p of portDefs) {
    const hexId = `${p.q},${p.r}`;
    const corners = graph.hexCorners.get(hexId);
    if (!corners) continue;
    const v1 = corners[p.direction]!;
    const v2 = corners[(p.direction + 1) % 6]!;
    const edge = Object.values(graph.edges).find(
      (e) =>
        (e.vertices[0] === v1 && e.vertices[1] === v2) ||
        (e.vertices[0] === v2 && e.vertices[1] === v1),
    );
    if (!edge) continue;
    out.push({ edge: edge.id, type: p.type });
  }
  // Dedupe in case two anchors resolved to the same edge.
  const seen = new Set<string>();
  return out.filter((p) => (seen.has(p.edge) ? false : (seen.add(p.edge), true)));
}
