import type { ScenarioLayout } from '../../../../board/scenarioTypes';

// Mirrors the Seafarers / base Scenario shape, trimmed to fields meaningful
// for the Traders & Barbarians scenarios we ship in this commit (Rivers of
// Catan only). Per-scenario layouts plus a fixed list of river-edge tuples
// (the bridge sites) are the two T&B-specific extras.

// An axial-coord edge identifier: the edge between hex (q, r) and its
// neighbour in `direction` (0..5, same enum used by port anchors). Used to
// declare river edges declaratively so the generator can resolve them to
// actual EdgeId strings after the board graph is built.
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

// Fishing on Catan declarative entry: anchor + token. Resolved to a
// concrete VertexId in the generator.
export interface FishingGroundDef {
  q: number;
  r: number;
  corner: 0 | 1 | 2 | 3 | 4 | 5;
  token: number;
}

export interface TradersScenario {
  id: string;
  name: string;
  description?: string;
  minPlayers: number;
  maxPlayers: number;
  defaultVpToWin?: number;
  layout3p?: ScenarioLayout;
  // River-edge tuples. Resolved by the generator into a concrete
  // `state.riverEdges` array (EdgeId[]). Edges may belong to either of the
  // two hexes the edge spans — the generator dedupes.
  riverEdges?: ScenarioEdgeRef[];
  // Optional explicit robber start (axial). Falls back to the layout's
  // robberStart, then to a desert/swamp scan. Rivers of Catan uses this to
  // pin the robber to one of the two swamps.
  robberStart?: { q: number; r: number };
  // Fishing on Catan: hex position of the lake. The scenario layout pins
  // the lake terrain + token; this just tells the generator where to
  // resolve `state.lakeHexId` from. Falls back to scanning hexes with
  // `terrain === 'lake'` when absent.
  lake?: { q: number; r: number };
  // Fishing on Catan: six fishing-ground tiles on coastal frame vertices.
  // Resolved into `state.fishingGrounds: FishingGround[]` by the generator.
  fishingGrounds?: FishingGroundDef[];
  // Merchant Trains: hex position of the watering hole (centre, non-
  // producing). Scenario layout pins it via `fixedTerrain: 'wateringHole'`;
  // this field surfaces the coord to the generator for `state.wateringHoleHexId`.
  // Falls back to scanning hexes with `terrain === 'wateringHole'`.
  wateringHole?: { q: number; r: number };
}
