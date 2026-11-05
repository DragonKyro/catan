import type { ScenarioLayout } from '../../../../board/scenarioTypes';

// Mirrors the Seafarers / base Scenario shape, trimmed to fields meaningful
// for the Traders & Barbarians scenarios we ship in this commit (Rivers of
// Catan only). Per-scenario layouts plus a fixed list of river-edge tuples
// (the bridge sites) are the two T&B-specific extras.

// An axial-coord edge identifier: edge `direction` of hex (q, r), i.e. the
// edge between its corners `direction` and `direction + 1`. Same enum as
// ScenarioPortAnchor: 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE (corners run 0 NE,
// 1 SE, 2 S, 3 SW, 4 NW, 5 N). Resolved to an EdgeId by the generator.
export interface ScenarioEdgeRef {
  q: number;
  r: number;
  direction: 0 | 1 | 2 | 3 | 4 | 5;
}

// A vertex specified by which hex it touches and which corner index (0..5,
// clockwise from the top-right corner — same enum as port anchors). Used
// to declare fishing-ground anchors before VertexId strings exist.
export interface ScenarioVertexRef {
  q: number;
  r: number;
  corner: 0 | 1 | 2 | 3 | 4 | 5;
}

// Fishing on Catan: one fishing-ground frame tile, named by the two coastal
// edges of the notch it fills. The generator resolves the edges and their
// three corners, and deals the tile a random number from
// `fishingGroundTokens`.
export interface FishingGroundDef {
  edges: [ScenarioEdgeRef, ScenarioEdgeRef];
}

// Rivers of Catan: one river tile — the hexes it flows through (source
// first) and the coastal edge where it reaches the sea. The shared edges
// between consecutive hexes plus the mouth are the bridge sites.
export interface RiverDef {
  hexes: Array<{ q: number; r: number }>;
  mouth?: ScenarioEdgeRef;
}

// Barbarian Attack board facts: the castle hex, the coastal hexes in expel
// order (clockwise from the 4 next to the castle) and the hexes that start
// with a barbarian. Resolved to hex ids by the generator.
export interface BarbarianAttackDef {
  castle: { q: number; r: number };
  // 5-6 players: a second castle (oriented the same way as the first).
  extraCastles?: Array<{ q: number; r: number }>;
  expelOrder: Array<{ q: number; r: number }>;
  startBarbarians: Array<{ q: number; r: number }>;
}

export interface TradersScenario {
  id: string;
  name: string;
  description?: string;
  minPlayers: number;
  maxPlayers: number;
  defaultVpToWin?: number;
  layout3p?: ScenarioLayout;
  // Rivers of Catan: the river tiles. Resolved into `state.rivers` and the
  // bridge sites `state.riverEdges`.
  rivers?: RiverDef[];
  // Coins are in play (`state.coinsInPlay`: spendGold / buyGold).
  coins?: boolean;
  // Wealthiest / Poor Catanian tiles are in play (`state.wealthTiles`).
  wealthTiles?: boolean;
  // Optional explicit robber start (axial). Falls back to the layout's
  // robberStart, then to a desert/swamp scan. Rivers of Catan uses this to
  // pin the robber to one of the two swamps.
  robberStart?: { q: number; r: number };
  // Fishing on Catan: hex position of the lake. The scenario layout pins
  // the lake terrain + token; this just tells the generator where to
  // resolve `state.lakeHexId` from. Falls back to scanning hexes with
  // `terrain === 'lake'` when absent.
  lake?: { q: number; r: number };
  // Fishing on Catan: the six fishing-ground tiles in the frame notches and
  // the numbers dealt to them at random (one each). Resolved into
  // `state.fishingGrounds` by the generator.
  fishingGrounds?: FishingGroundDef[];
  fishingGroundTokens?: number[];
  // Merchant Trains: hex position of the watering hole (centre, non-
  // producing). Scenario layout pins it via `fixedTerrain: 'wateringHole'`;
  // this field surfaces the coord to the generator for `state.wateringHoleHexId`.
  // Falls back to scanning hexes with `terrain === 'wateringHole'`.
  wateringHole?: { q: number; r: number };
  // Optional per-game layout step run before materialization (seeded RNG
  // in, RNG out). Barbarian Attack deals its coastal and inner terrain
  // pools separately here.
  prepareLayout?: (layout: ScenarioLayout, rngState: number) => [ScenarioLayout, number];
  // Barbarian Attack: see BarbarianAttackDef.
  barbarianAttack?: BarbarianAttackDef;
  // Merchant Trains 5-6: several watering holes (each with its own three
  // train starts). Takes precedence over `wateringHole`.
  wateringHoles?: Array<{ q: number; r: number }>;
  // Traders & Barbarians 5-6 (Phase 11): the 30-hex board for 5-6 players
  // and the board facts that differ there. The generator reads the
  // scenario as `{ ...scenario, ...board5_6 }` at 5+ players (see
  // `scenarioForPlayers`), so only the fields that change are listed.
  layout5_6p?: ScenarioLayout;
  board5_6?: TradersBoardOverrides;
}

// Per-board-size overrides (the fields of a scenario that depend on the
// board, not on the rules).
export type TradersBoardOverrides = Partial<
  Pick<
    TradersScenario,
    | 'rivers'
    | 'robberStart'
    | 'lake'
    | 'fishingGrounds'
    | 'fishingGroundTokens'
    | 'wateringHole'
    | 'wateringHoles'
    | 'prepareLayout'
    | 'barbarianAttack'
  >
>;
