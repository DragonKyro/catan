import type { Terrain, PortType } from '../types';
import type {
  ScenarioLayout,
  ScenarioPosition,
  ScenarioPortAnchor,
  ScenarioPools,
} from '../board/scenarioTypes';
import {
  CUSTOM_MAP_FILE_VERSION,
  CUSTOM_MAP_SCHEMA,
  type CustomMap,
} from './types';

const VALID_TERRAIN: Terrain[] = [
  'wood', 'brick', 'sheep', 'wheat', 'ore',
  'desert', 'sea', 'gold',
  // T&B / C&K terrains accepted by the schema for forward-compat but the
  // builder UI never produces them.
  'swamp', 'lake', 'wateringHole', 'castle',
];
const VALID_PORT: PortType[] = ['generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'];
const VALID_KIND = new Set(['land', 'sea', 'desert']);

// Parse a JSON blob into a CustomMap. Throws with a helpful message on any
// shape problem so the file picker can surface the failure. Mirrors the
// style of `parseReplay` in `src/store/replayStore.ts`.
export function parseCustomMap(json: string): CustomMap {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('Map file is empty or malformed.');
  }
  const r = raw as Partial<CustomMap>;

  if (r.schema !== CUSTOM_MAP_SCHEMA) {
    throw new Error(`Not a Catan custom map (schema "${r.schema ?? ''}").`);
  }
  if (typeof r.version !== 'number') {
    throw new Error('Map missing version field.');
  }
  if (r.version > CUSTOM_MAP_FILE_VERSION) {
    throw new Error(
      `Map was created with a newer version (${r.version}); this build supports up to v${CUSTOM_MAP_FILE_VERSION}.`,
    );
  }
  if (typeof r.id !== 'string' || !r.id) throw new Error('Map missing id.');
  if (typeof r.name !== 'string' || !r.name) throw new Error('Map missing name.');
  if (typeof r.minPlayers !== 'number') throw new Error('Map missing minPlayers.');
  if (typeof r.maxPlayers !== 'number') throw new Error('Map missing maxPlayers.');
  if (r.minPlayers < 2 || r.maxPlayers > 8 || r.minPlayers > r.maxPlayers) {
    throw new Error(
      `Player range out of bounds: ${r.minPlayers}..${r.maxPlayers} (must be within 2..8).`,
    );
  }
  if (typeof r.seafarers !== 'boolean') {
    throw new Error('Map missing seafarers flag.');
  }
  if (!Array.isArray(r.fogHexes)) {
    throw new Error('Map missing fogHexes array.');
  }
  const fogHexes = r.fogHexes.map((f, i) => {
    if (!f || typeof f !== 'object' || typeof (f as { q?: unknown }).q !== 'number' || typeof (f as { r?: unknown }).r !== 'number') {
      throw new Error(`fogHexes[${i}] missing q/r.`);
    }
    return { q: (f as { q: number }).q, r: (f as { r: number }).r };
  });

  if (!r.layout || typeof r.layout !== 'object') {
    throw new Error('Map missing layout.');
  }
  const layout = parseLayout(r.layout as Partial<ScenarioLayout>);

  // Cross-field validation.
  validateLayout(layout, fogHexes);
  validateFogHexes(fogHexes, layout);

  let fogPools: import('./types').FogPools | undefined;
  if (r.fogPools != null) {
    fogPools = parseFogPools(r.fogPools as Partial<import('./types').FogPools>);
    validateFogPools(fogPools, fogHexes.length);
  } else if (fogHexes.length > 0) {
    throw new Error(
      'Map has fog hexes but no fogPools — declare a separate terrain + token pool for fog tiles.',
    );
  }

  return {
    schema: CUSTOM_MAP_SCHEMA,
    version: r.version,
    id: r.id,
    name: r.name,
    description: typeof r.description === 'string' ? r.description : undefined,
    minPlayers: r.minPlayers,
    maxPlayers: r.maxPlayers,
    defaultVpToWin:
      typeof r.defaultVpToWin === 'number' ? r.defaultVpToWin : undefined,
    seafarers: r.seafarers,
    fogHexes,
    fogPools,
    layout,
  };
}

function parseFogPools(
  raw: Partial<import('./types').FogPools>,
): import('./types').FogPools {
  if (!raw.terrainCounts || typeof raw.terrainCounts !== 'object') {
    throw new Error('fogPools missing terrainCounts.');
  }
  const terrainCounts: Partial<Record<Terrain, number>> = {};
  for (const [k, v] of Object.entries(raw.terrainCounts)) {
    if (!VALID_TERRAIN.includes(k as Terrain)) {
      throw new Error(`fogPools.terrainCounts has invalid key "${k}".`);
    }
    if (typeof v !== 'number' || v < 0) {
      throw new Error(`fogPools.terrainCounts.${k} must be a non-negative number.`);
    }
    if (v > 0) terrainCounts[k as Terrain] = v;
  }
  if (!Array.isArray(raw.tokens)) throw new Error('fogPools missing tokens array.');
  const tokens = raw.tokens.map((n, i) => {
    if (typeof n !== 'number' || n < 2 || n > 12 || n === 7) {
      throw new Error(`fogPools.tokens[${i}] must be 2..6 or 8..12 (got ${n}).`);
    }
    return n;
  });
  return { terrainCounts, tokens };
}

function validateFogPools(
  pools: import('./types').FogPools,
  fogCount: number,
): void {
  const terrainTotal = Object.values(pools.terrainCounts).reduce(
    (a, b) => a + (b ?? 0),
    0,
  );
  if (terrainTotal !== fogCount) {
    throw new Error(
      `fogPools.terrainCounts sums to ${terrainTotal} but there are ${fogCount} fog hexes.`,
    );
  }
  // Sea, desert, and other non-producing terrains drawn from the fog pool
  // don't take a token (sea reveals as open water; desert reveals as the
  // desert terrain itself).
  const nonProducing =
    (pools.terrainCounts.sea ?? 0) +
    (pools.terrainCounts.desert ?? 0) +
    (pools.terrainCounts.swamp ?? 0) +
    (pools.terrainCounts.wateringHole ?? 0) +
    (pools.terrainCounts.castle ?? 0);
  const expectedTokens = fogCount - nonProducing;
  if (pools.tokens.length !== expectedTokens) {
    throw new Error(
      `fogPools.tokens has ${pools.tokens.length} entries but ${expectedTokens} fog tiles need a token.`,
    );
  }
}

function parseLayout(raw: Partial<ScenarioLayout>): ScenarioLayout {
  if (!Array.isArray(raw.positions) || raw.positions.length === 0) {
    throw new Error('Layout has no positions.');
  }
  const positions: ScenarioPosition[] = raw.positions.map((p, i) => {
    if (!p || typeof p !== 'object') throw new Error(`positions[${i}] is not an object.`);
    const o = p as Partial<ScenarioPosition>;
    if (typeof o.q !== 'number' || typeof o.r !== 'number') {
      throw new Error(`positions[${i}] missing q/r.`);
    }
    if (!o.kind || !VALID_KIND.has(o.kind)) {
      throw new Error(`positions[${i}] has invalid kind "${o.kind}".`);
    }
    if (o.fixedTerrain != null && !VALID_TERRAIN.includes(o.fixedTerrain)) {
      throw new Error(`positions[${i}] has invalid fixedTerrain "${o.fixedTerrain}".`);
    }
    const out: ScenarioPosition = { q: o.q, r: o.r, kind: o.kind };
    if (o.fixedTerrain) out.fixedTerrain = o.fixedTerrain;
    if (o.forceToken) out.forceToken = true;
    if (typeof o.fixedToken === 'number') out.fixedToken = o.fixedToken;
    return out;
  });

  if (!Array.isArray(raw.portAnchors)) {
    throw new Error('Layout missing portAnchors array.');
  }
  const portAnchors: ScenarioPortAnchor[] = raw.portAnchors.map((p, i) => {
    if (!p || typeof p !== 'object') throw new Error(`portAnchors[${i}] is not an object.`);
    const o = p as Partial<ScenarioPortAnchor>;
    if (typeof o.q !== 'number' || typeof o.r !== 'number') {
      throw new Error(`portAnchors[${i}] missing q/r.`);
    }
    const d = o.direction;
    if (typeof d !== 'number' || d < 0 || d > 5 || !Number.isInteger(d)) {
      throw new Error(`portAnchors[${i}] has invalid direction "${d}".`);
    }
    return { q: o.q, r: o.r, direction: d as 0 | 1 | 2 | 3 | 4 | 5 };
  });

  if (!raw.pools || typeof raw.pools !== 'object') {
    throw new Error('Layout missing pools.');
  }
  const pools = parsePools(raw.pools as Partial<ScenarioPools>);

  const layout: ScenarioLayout = { positions, portAnchors, pools };
  if (raw.tokenConstraints?.allow6_8Adjacent) {
    layout.tokenConstraints = { allow6_8Adjacent: true };
  }
  if (raw.robberStart) layout.robberStart = raw.robberStart;
  if (raw.pirateStart) layout.pirateStart = raw.pirateStart;
  return layout;
}

function parsePools(raw: Partial<ScenarioPools>): ScenarioPools {
  if (!raw.terrainCounts || typeof raw.terrainCounts !== 'object') {
    throw new Error('Pools missing terrainCounts.');
  }
  const terrainCounts: Partial<Record<Terrain, number>> = {};
  for (const [k, v] of Object.entries(raw.terrainCounts)) {
    if (!VALID_TERRAIN.includes(k as Terrain)) {
      throw new Error(`terrainCounts has invalid key "${k}".`);
    }
    if (typeof v !== 'number' || v < 0) {
      throw new Error(`terrainCounts.${k} must be a non-negative number.`);
    }
    if (v > 0) terrainCounts[k as Terrain] = v;
  }

  if (!Array.isArray(raw.tokens)) throw new Error('Pools missing tokens array.');
  const tokens = raw.tokens.map((n, i) => {
    if (typeof n !== 'number' || n < 2 || n > 12 || n === 7) {
      throw new Error(`tokens[${i}] must be 2..6 or 8..12 (got ${n}).`);
    }
    return n;
  });

  if (!Array.isArray(raw.portTypes)) throw new Error('Pools missing portTypes array.');
  const portTypes = raw.portTypes.map((t, i) => {
    if (!VALID_PORT.includes(t as PortType)) {
      throw new Error(`portTypes[${i}] is invalid: "${t}".`);
    }
    return t as PortType;
  });

  return { terrainCounts, tokens, portTypes };
}

// Cross-field invariants matching the materializer's expectations. Surfacing
// them here gives a friendly error instead of an opaque mismatch deep in
// `materializeLayout`.
//
// `fogHexes` (when provided) are excluded from the main pool counts because
// they take terrain + token from a separate `fogPools` at game start.
export function validateLayout(
  layout: ScenarioLayout,
  fogHexes: { q: number; r: number }[] = [],
): void {
  const seen = new Set<string>();
  for (const p of layout.positions) {
    const k = `${p.q},${p.r}`;
    if (seen.has(k)) throw new Error(`Duplicate position at (${p.q}, ${p.r}).`);
    seen.add(k);
  }
  const landCount = layout.positions.filter((p) => p.kind === 'land').length;
  if (landCount === 0) throw new Error('Map has no land hexes.');

  const fogKeys = new Set(fogHexes.map((f) => `${f.q},${f.r}`));
  const isFog = (p: { q: number; r: number }) => fogKeys.has(`${p.q},${p.r}`);

  const poolDrawnTerrainCount = layout.positions.filter(
    (p) => p.kind === 'land' && !p.fixedTerrain && !isFog(p),
  ).length;
  const terrainPoolTotal = Object.values(layout.pools.terrainCounts).reduce(
    (a, b) => a + (b ?? 0),
    0,
  );
  if (terrainPoolTotal !== poolDrawnTerrainCount) {
    throw new Error(
      `Terrain pool size ${terrainPoolTotal} doesn't match ${poolDrawnTerrainCount} land positions awaiting terrain. ` +
        `Adjust pools.terrainCounts or pin more positions with fixedTerrain.`,
    );
  }

  // Token pool must match the count of positions that will be tokenized AND
  // not have a fixedToken. The materializer applies fixed tokens first, then
  // draws the rest from the pool — see [src/game/board/layoutMaterializer.ts].
  // Fog cells are excluded — they get their token from `fogPools`.
  let tokenSlots = 0;
  for (const p of layout.positions) {
    if (isFog(p)) continue;
    if (p.fixedToken != null) continue;
    if (p.kind === 'sea') continue;
    if (p.kind === 'desert' && !p.forceToken) continue;
    const terrain = p.fixedTerrain;
    if (terrain === 'swamp' || terrain === 'wateringHole' || terrain === 'castle' || terrain === 'desert') {
      continue;
    }
    if (p.kind === 'land' || (p.kind === 'desert' && p.forceToken)) tokenSlots++;
  }
  // Pool-drawn cells that will land on a non-producing terrain don't take a
  // token — subtract them from the expected count.
  const nonProducingPoolDraws =
    (layout.pools.terrainCounts.desert ?? 0) +
    (layout.pools.terrainCounts.swamp ?? 0) +
    (layout.pools.terrainCounts.wateringHole ?? 0) +
    (layout.pools.terrainCounts.castle ?? 0);
  tokenSlots = Math.max(0, tokenSlots - nonProducingPoolDraws);
  if (layout.pools.tokens.length !== tokenSlots) {
    throw new Error(
      `Token pool size ${layout.pools.tokens.length} doesn't match ${tokenSlots} hexes awaiting a number. ` +
        `Adjust pools.tokens or pin more tokens with fixedToken.`,
    );
  }

  if (layout.pools.portTypes.length !== layout.portAnchors.length) {
    throw new Error(
      `Port type pool size ${layout.pools.portTypes.length} doesn't match ${layout.portAnchors.length} port anchors.`,
    );
  }

  // A port lives on an edge between a land hex and a sea / off-disk hex.
  // The anchor can sit on EITHER side of that edge (the builder lets users
  // click from the sea side too) — what matters is that exactly one of the
  // two hexes is land. We reject only when both sides are non-land.
  const landKeys = new Set(
    layout.positions.filter((p) => p.kind === 'land').map((p) => `${p.q},${p.r}`),
  );
  for (const a of layout.portAnchors) {
    const here = landKeys.has(`${a.q},${a.r}`);
    const n = neighbourAxial(a.q, a.r, a.direction);
    const there = landKeys.has(`${n.q},${n.r}`);
    if (!here && !there) {
      throw new Error(
        `Port at (${a.q}, ${a.r}) dir ${a.direction} doesn't border a land hex on either side.`,
      );
    }
    if (here && there) {
      throw new Error(
        `Port at (${a.q}, ${a.r}) dir ${a.direction} sits between two land hexes — ports must face sea or off-board.`,
      );
    }
  }
}

function validateFogHexes(
  fogHexes: { q: number; r: number }[],
  layout: ScenarioLayout,
): void {
  const landKeys = new Set(
    layout.positions.filter((p) => p.kind === 'land').map((p) => `${p.q},${p.r}`),
  );
  for (const f of fogHexes) {
    if (!landKeys.has(`${f.q},${f.r}`)) {
      throw new Error(`Fog hex (${f.q}, ${f.r}) is not on a land position.`);
    }
  }
}

// Direction → axial neighbour offset. Matches the convention used by every
// shipped scenario (see headingForNewShores.ts comment):
//   0=E (+1,0), 1=SE (0,+1), 2=SW (-1,+1),
//   3=W (-1,0), 4=NW (0,-1), 5=NE (+1,-1).
export function neighbourAxial(
  q: number,
  r: number,
  direction: 0 | 1 | 2 | 3 | 4 | 5,
): { q: number; r: number } {
  const offsets: Array<[number, number]> = [
    [1, 0],   // 0 = E
    [0, 1],   // 1 = SE
    [-1, 1],  // 2 = SW
    [-1, 0],  // 3 = W
    [0, -1],  // 4 = NW
    [1, -1],  // 5 = NE
  ];
  const [dq, dr] = offsets[direction]!;
  return { q: q + dq, r: r + dr };
}
