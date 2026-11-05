import type { PortType, Terrain } from '../../../types';
import { nextRng, rngInt, shuffle } from '../../../rng';
import type { ScenarioLayout, ScenarioPortAnchor, ScenarioPosition } from './types';

// New World — a fresh random board every game (Seafarers 2025 rulebook p.20,
// Seafarers 5-6 p.12). Design notes and the reasoning behind each choice:
// docs/map-specs/NEWWORLD-SPEC.md.
//
// The rulebook deals the listed hexes face up at random into the frame, lets
// the table "shift the setup of the hexes" to change the number or size of
// islands, deals the number discs on the land (red discs never adjacent,
// gold never red), then the players take turns placing random harbors on
// coastal edges, each at least one edge from the others. The robber and the
// pirate start beside the frame.
//
// Steps here, all on the seeded RNG:
//   1. Shape — grow 3-5 (5-6p: 4-6) islands from spread-out seeds, one hex
//      at a time, never letting two islands touch. This is the "shift the
//      setup" step done up front: a plain random deal is almost always one
//      continent (see the spec). The plain deal is still the fallback.
//   2. Terrain — shuffle the land hexes onto the land positions (every
//      island keeps two producing hexes, so a desert-only islet can't
//      happen).
//   3. Number discs — shuffle them onto the producing land, then move each
//      red disc that touches another red (or sits on gold) to a black
//      disc's hex, preferring an adjacent one, as the rulebook says.
//   4. Harbors — each harbor, in random order, on a random land / sea or
//      land / frame edge that shares no corner with a placed harbor.
//   5. Pirate — on a sea hex touching the least land, on the frame's rim
//      when there's a choice (the nearest thing to "beside the frame" the
//      engine has). The robber starts off the board
//      (`Scenario.robberStartsOffBoard`).
//
// The result is a fully pinned `ScenarioLayout` (fixed terrain and number
// on every hex, fixed harbor types), so the shared materializer draws no
// further randomness.

// Axial neighbour offsets by edge direction: 0 E, 1 SE, 2 SW, 3 W, 4 NW,
// 5 NE (the side between corners d and d + 1).
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

export interface NewWorldSpec {
  // Frame rows, top to bottom: [r, first q, last q].
  rows: ReadonlyArray<readonly [number, number, number]>;
  // Hexes dealt into the frame (sea and deserts included). Sums to the
  // frame size.
  hexes: Partial<Record<Terrain, number>>;
  // Number discs, one per producing (non-desert) land hex.
  discs: readonly number[];
  // Harbor tokens (`generic` = 3:1).
  ports: readonly PortType[];
  // Island counts the shape step aims for; one is drawn per attempt, so a
  // repeated entry is drawn more often.
  islandCounts: readonly number[];
  // Size bounds on every island (in hexes).
  minIslandSize: number;
  maxIslandSize: number;
}

// 3-4 players: the 42-hex frame (rows of 5, 6, 7, 6, 7, 6, 5), 19 sea +
// 23 land, 23 discs, 5 × 2:1 + 5 × 3:1 harbors.
export const NEW_WORLD_3_4: NewWorldSpec = {
  rows: [
    [-3, 0, 4],
    [-2, -1, 4],
    [-1, -2, 4],
    [0, -2, 3],
    [1, -3, 3],
    [2, -3, 2],
    [3, -3, 1],
  ],
  hexes: { sea: 19, brick: 4, wood: 5, sheep: 5, wheat: 5, ore: 4 },
  discs: [2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 12],
  ports: [
    'generic', 'generic', 'generic', 'generic', 'generic',
    'wood', 'brick', 'sheep', 'wheat', 'ore',
  ],
  islandCounts: [3, 4, 4, 5],
  minIslandSize: 2,
  maxIslandSize: 12,
};

// 5-6 players: the 63-hex frame (rows of 8, 9, 10, 9, 10, 9, 8), 21 sea +
// 42 land (3 deserts), 39 discs, 6 × 2:1 (the 5-6 box adds a second wool
// harbor) + 5 × 3:1 harbors.
export const NEW_WORLD_5_6: NewWorldSpec = {
  rows: [
    [-3, -2, 5],
    [-2, -3, 5],
    [-1, -4, 5],
    [0, -4, 4],
    [1, -5, 4],
    [2, -5, 3],
    [3, -5, 2],
  ],
  hexes: { sea: 21, gold: 4, brick: 7, wood: 7, sheep: 7, wheat: 7, ore: 7, desert: 3 },
  discs: [
    2, 2,
    3, 3, 3,
    4, 4, 4, 4,
    5, 5, 5, 5, 5,
    6, 6, 6, 6, 6,
    8, 8, 8, 8, 8,
    9, 9, 9, 9, 9,
    10, 10, 10, 10,
    11, 11, 11, 11,
    12, 12,
  ],
  ports: [
    'generic', 'generic', 'generic', 'generic', 'generic',
    'wood', 'brick', 'sheep', 'sheep', 'wheat', 'ore',
  ],
  islandCounts: [4, 5, 5, 6],
  minIslandSize: 3,
  maxIslandSize: 20,
};

export function newWorldSpec(numPlayers: number): NewWorldSpec {
  return numPlayers >= 5 ? NEW_WORLD_5_6 : NEW_WORLD_3_4;
}

// Seeds of different islands start at least this far apart (hex distance).
const SEED_SPACING = 3;
const MAX_SHAPE_ATTEMPTS = 80;
const MAX_DEALS = 40;
const MAX_TERRAIN_SHUFFLES = 30;
const MAX_DISC_SHUFFLES = 30;

interface Frame {
  coords: Array<{ q: number; r: number }>;
  // neighbours[i][d] = index of the neighbour across edge d, or -1 off the
  // frame.
  neighbours: number[][];
}

function buildFrame(spec: NewWorldSpec): Frame {
  const coords: Array<{ q: number; r: number }> = [];
  for (const [r, q0, q1] of spec.rows) {
    for (let q = q0; q <= q1; q++) coords.push({ q, r });
  }
  const index = new Map(coords.map((c, i) => [`${c.q},${c.r}`, i]));
  const neighbours = coords.map((c) =>
    DIRS.map(([dq, dr]) => index.get(`${c.q + dq},${c.r + dr}`) ?? -1),
  );
  return { coords, neighbours };
}

function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

function landCount(spec: NewWorldSpec): number {
  let n = 0;
  for (const [t, c] of Object.entries(spec.hexes)) if (t !== 'sea') n += c ?? 0;
  return n;
}

// ---------------------------------------------------------------- shape ---

// Grow `k` islands that never touch. Returns island index per frame
// position (-1 = sea), or null when the growth boxes itself in or an island
// ends up outside the size bounds.
function growIslands(
  frame: Frame,
  spec: NewWorldSpec,
  k: number,
  rngIn: number,
): [Int8Array | null, number] {
  let rng = rngIn;
  const n = frame.coords.length;
  const total = landCount(spec);

  let order: number[];
  [order, rng] = shuffle(rng, Array.from({ length: n }, (_, i) => i));
  const seeds: number[] = [];
  for (const i of order) {
    if (seeds.every((s) => hexDistance(frame.coords[i]!, frame.coords[s]!) >= SEED_SPACING)) {
      seeds.push(i);
      if (seeds.length === k) break;
    }
  }
  if (seeds.length < k) return [null, rng];

  const owner = new Int8Array(n).fill(-1);
  const sizes = new Array<number>(k).fill(1);
  // Relative target sizes, so islands come out uneven.
  const weights: number[] = [];
  for (let i = 0; i < k; i++) {
    owner[seeds[i]!] = i;
    let v: number;
    [v, rng] = nextRng(rng);
    weights.push(0.6 + 0.8 * v);
  }
  const active = new Array<boolean>(k).fill(true);
  let placed = k;
  while (placed < total) {
    // The active island furthest below its share grows next (with noise).
    let pick = -1;
    let best = Infinity;
    for (let i = 0; i < k; i++) {
      if (!active[i]) continue;
      let v: number;
      [v, rng] = nextRng(rng);
      const score = sizes[i]! / weights[i]! + 0.5 * v;
      if (score < best) {
        best = score;
        pick = i;
      }
    }
    if (pick < 0) return [null, rng];

    // Free hexes beside the island and not beside any other island,
    // weighted by how many of the island's hexes they touch (squared) so
    // islands come out compact.
    const options: number[] = [];
    const optionWeights: number[] = [];
    for (let p = 0; p < n; p++) {
      if (owner[p] !== -1) continue;
      let own = 0;
      let other = false;
      for (const nb of frame.neighbours[p]!) {
        if (nb < 0) continue;
        const o = owner[nb]!;
        if (o === pick) own++;
        else if (o !== -1) other = true;
      }
      if (own > 0 && !other) {
        options.push(p);
        optionWeights.push(own * own);
      }
    }
    if (options.length === 0) {
      active[pick] = false;
      continue;
    }
    let chosen: number;
    [chosen, rng] = weightedPick(rng, options, optionWeights);
    owner[chosen] = pick;
    sizes[pick]!++;
    placed++;
  }
  if (sizes.some((s) => s < spec.minIslandSize || s > spec.maxIslandSize)) return [null, rng];
  return [owner, rng];
}

// The rulebook's plain deal: land and sea hexes shuffled into the frame.
// Used only if the shape step can't find an archipelago.
function plainDeal(frame: Frame, spec: NewWorldSpec, rngIn: number): [Int8Array, number] {
  const n = frame.coords.length;
  const total = landCount(spec);
  const [order, rng] = shuffle(rngIn, Array.from({ length: n }, (_, i) => i));
  const isLand = new Array<boolean>(n).fill(false);
  for (let i = 0; i < total; i++) isLand[order[i]!] = true;
  return [labelIslands(frame, isLand), rng];
}

// Connected land components, numbered in frame order.
function labelIslands(frame: Frame, isLand: boolean[]): Int8Array {
  const owner = new Int8Array(isLand.length).fill(-1);
  let next = 0;
  for (let s = 0; s < isLand.length; s++) {
    if (!isLand[s] || owner[s] !== -1) continue;
    const stack = [s];
    owner[s] = next;
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nb of frame.neighbours[cur]!) {
        if (nb >= 0 && isLand[nb] && owner[nb] === -1) {
          owner[nb] = next;
          stack.push(nb);
        }
      }
    }
    next++;
  }
  return owner;
}

function shapeIslands(frame: Frame, spec: NewWorldSpec, rngIn: number): [Int8Array, number] {
  let rng = rngIn;
  for (let attempt = 0; attempt < MAX_SHAPE_ATTEMPTS; attempt++) {
    let k: number;
    [k, rng] = pickFrom(rng, spec.islandCounts);
    let owner: Int8Array | null;
    [owner, rng] = growIslands(frame, spec, k, rng);
    if (owner) return [owner, rng];
  }
  return plainDeal(frame, spec, rng);
}

// -------------------------------------------------------------- terrain ---

function dealTerrain(
  frame: Frame,
  spec: NewWorldSpec,
  owner: Int8Array,
  rngIn: number,
): [Terrain[], number] {
  let rng = rngIn;
  const pool: Terrain[] = [];
  for (const [t, c] of Object.entries(spec.hexes)) {
    if (t === 'sea') continue;
    for (let i = 0; i < (c ?? 0); i++) pool.push(t as Terrain);
  }
  const landIdx: number[] = [];
  for (let i = 0; i < owner.length; i++) if (owner[i]! >= 0) landIdx.push(i);
  const islandCount = Math.max(-1, ...owner) + 1;
  const islandSize = new Array<number>(islandCount).fill(0);
  for (const i of landIdx) islandSize[owner[i]!]!++;

  let terrain: Terrain[] = [];
  for (let attempt = 0; attempt < MAX_TERRAIN_SHUFFLES; attempt++) {
    let dealt: Terrain[];
    [dealt, rng] = shuffle(rng, pool);
    terrain = frame.coords.map(() => 'sea' as Terrain);
    landIdx.forEach((p, k) => (terrain[p] = dealt[k]!));
    // Every island keeps at least two producing hexes (or all of them, for
    // a smaller island).
    const producing = new Array<number>(islandCount).fill(0);
    for (const p of landIdx) if (terrain[p] !== 'desert') producing[owner[p]!]!++;
    if (producing.every((c, i) => c >= Math.min(2, islandSize[i]!))) break;
  }
  return [terrain, rng];
}

// ---------------------------------------------------------------- discs ---

const isRed = (d: number | null): boolean => d === 6 || d === 8;

// Deal the discs onto the producing land, then separate the red ones.
// Returns null when no deal could be separated (never seen in practice).
function dealDiscs(
  frame: Frame,
  spec: NewWorldSpec,
  terrain: Terrain[],
  rngIn: number,
): [Array<number | null> | null, number] {
  let rng = rngIn;
  const numbered: number[] = [];
  terrain.forEach((t, i) => {
    if (t !== 'sea' && t !== 'desert') numbered.push(i);
  });
  if (numbered.length !== spec.discs.length) {
    throw new Error(
      `New World: ${spec.discs.length} discs for ${numbered.length} producing hexes`,
    );
  }
  for (let attempt = 0; attempt < MAX_DISC_SHUFFLES; attempt++) {
    let dealt: number[];
    [dealt, rng] = shuffle(rng, spec.discs);
    const disc: Array<number | null> = terrain.map(() => null);
    numbered.forEach((p, k) => (disc[p] = dealt[k]!));
    let ok: boolean;
    [ok, rng] = separateReds(frame, terrain, disc, numbered, rng);
    if (ok) return [disc, rng];
  }
  return [null, rng];
}

// A red disc conflicts when it sits on gold ("Gold fields should not
// receive red number discs") or beside another red disc.
function redConflict(frame: Frame, terrain: Terrain[], disc: Array<number | null>, p: number): boolean {
  if (!isRed(disc[p]!)) return false;
  if (terrain[p] === 'gold') return true;
  return frame.neighbours[p]!.some((nb) => nb >= 0 && isRed(disc[nb]!));
}

// "If 2 red number discs end up on adjacent hexes, swap one of them with an
// adjacent black number hex so that all the red number discs are
// separated." Each swap moves a conflicting red disc to a black disc's hex
// with no red neighbour (other than the hex it leaves) and not gold, so
// the number of conflicts only goes down. Prefers a hex adjacent to the
// red disc; otherwise any such hex.
function separateReds(
  frame: Frame,
  terrain: Terrain[],
  disc: Array<number | null>,
  numbered: number[],
  rngIn: number,
): [boolean, number] {
  let rng = rngIn;
  for (let guard = 0; guard <= numbered.length; guard++) {
    const p = numbered.find((i) => redConflict(frame, terrain, disc, i));
    if (p === undefined) return [true, rng];
    const fits = numbered.filter(
      (c) =>
        !isRed(disc[c]!) &&
        terrain[c] !== 'gold' &&
        frame.neighbours[c]!.every((nb) => nb < 0 || nb === p || !isRed(disc[nb]!)),
    );
    if (fits.length === 0) return [false, rng];
    const adjacent = fits.filter((c) => frame.neighbours[p]!.includes(c));
    let target: number;
    [target, rng] = pickFrom(rng, adjacent.length > 0 ? adjacent : fits);
    const tmp = disc[p]!;
    disc[p] = disc[target]!;
    disc[target] = tmp;
  }
  return [false, rng];
}

// -------------------------------------------------------------- harbors ---

// Corner c of a hex is shared with its neighbours across edges c - 1 and c.
function cornerKey(q: number, r: number, corner: number): string {
  const a = DIRS[(corner + 5) % 6]!;
  const b = DIRS[corner]!;
  return [`${q},${r}`, `${q + a[0]},${r + a[1]}`, `${q + b[0]},${r + b[1]}`].sort().join('|');
}

function placeHarbors(
  frame: Frame,
  spec: NewWorldSpec,
  terrain: Terrain[],
  rngIn: number,
): [ScenarioPortAnchor[] | null, number] {
  let rng = rngIn;
  // Edges between a land hex and a sea hex or the frame, named from the
  // land side (so each appears once).
  const edges: Array<{ p: number; d: number; corners: [string, string] }> = [];
  terrain.forEach((t, p) => {
    if (t === 'sea') return;
    const { q, r } = frame.coords[p]!;
    for (let d = 0; d < 6; d++) {
      const nb = frame.neighbours[p]![d]!;
      if (nb >= 0 && terrain[nb] !== 'sea') continue;
      edges.push({ p, d, corners: [cornerKey(q, r, d), cornerKey(q, r, (d + 1) % 6)] });
    }
  });
  let types: PortType[];
  [types, rng] = shuffle(rng, spec.ports);
  const used = new Set<string>();
  const anchors: ScenarioPortAnchor[] = [];
  for (const type of types) {
    // At least one edge away from every other harbor: no shared corner.
    const open = edges.filter((e) => !used.has(e.corners[0]) && !used.has(e.corners[1]));
    if (open.length === 0) return [null, rng];
    let e: (typeof edges)[number];
    [e, rng] = pickFrom(rng, open);
    used.add(e.corners[0]);
    used.add(e.corners[1]);
    const { q, r } = frame.coords[e.p]!;
    anchors.push({ q, r, direction: e.d as ScenarioPortAnchor['direction'], fixedType: type });
  }
  return [anchors, rng];
}

// --------------------------------------------------------------- pirate ---

// The rulebook parks the pirate on the frame; the engine keeps it on a sea
// hex, so take one touching the least land, on the rim of the frame when
// there's a choice (so it blocks as few ship routes as possible).
function pickPirateHex(frame: Frame, terrain: Terrain[], rngIn: number): [number, number] {
  const sea: number[] = [];
  terrain.forEach((t, i) => {
    if (t === 'sea') sea.push(i);
  });
  const score = (i: number) => {
    const nbs = frame.neighbours[i]!;
    const land = nbs.filter((nb) => nb >= 0 && terrain[nb] !== 'sea').length;
    const rim = nbs.some((nb) => nb < 0);
    return land * 2 + (rim ? 0 : 1);
  };
  const best = Math.min(...sea.map(score));
  return pickFrom(rngIn, sea.filter((i) => score(i) === best));
}

// ------------------------------------------------------------------ deal ---

// Deal a New World board for `numPlayers` players on the seeded RNG.
export function generateNewWorldLayout(
  numPlayers: number,
  rngIn: number,
): [ScenarioLayout, number] {
  const spec = newWorldSpec(numPlayers);
  const frame = buildFrame(spec);
  let rng = rngIn;
  for (let deal = 0; deal < MAX_DEALS; deal++) {
    let owner: Int8Array;
    [owner, rng] = shapeIslands(frame, spec, rng);
    let terrain: Terrain[];
    [terrain, rng] = dealTerrain(frame, spec, owner, rng);
    let disc: Array<number | null> | null;
    [disc, rng] = dealDiscs(frame, spec, terrain, rng);
    if (!disc) continue;
    let harbors: ScenarioPortAnchor[] | null;
    [harbors, rng] = placeHarbors(frame, spec, terrain, rng);
    if (!harbors) continue;
    let pirate: number;
    [pirate, rng] = pickPirateHex(frame, terrain, rng);
    const positions = frame.coords.map(({ q, r }, i): ScenarioPosition => {
      const t = terrain[i]!;
      if (t === 'sea') return { q, r, kind: 'sea' };
      if (t === 'desert') return { q, r, kind: 'desert' };
      return { q, r, kind: 'land', fixedTerrain: t, fixedToken: disc[i]! };
    });
    return [
      {
        positions,
        portAnchors: harbors,
        pools: { terrainCounts: {}, tokens: [], portTypes: [] },
        pirateStart: frame.coords[pirate]!,
      },
      rng,
    ];
  }
  throw new Error(`New World: no valid board after ${MAX_DEALS} deals`);
}

// ----------------------------------------------------------------- rng ---

function pickFrom<T>(rng: number, arr: readonly T[]): [T, number] {
  const [i, next] = rngInt(rng, arr.length);
  return [arr[i]!, next];
}

function weightedPick<T>(rng: number, items: readonly T[], weights: readonly number[]): [T, number] {
  let total = 0;
  for (const w of weights) total += w;
  const [v, next] = nextRng(rng);
  let x = v * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i]!;
    if (x < 0) return [items[i]!, next];
  }
  return [items[items.length - 1]!, next];
}
