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
}
