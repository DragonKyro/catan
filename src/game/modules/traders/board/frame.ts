import type { ScenarioPortAnchor } from '../../../board/scenarioTypes';

// The 2025 Traders & Barbarians frame: the same nine harbors, at the same
// places with the same types, appear in every scenario picture of the
// rulebook (Fishing, Rivers, Merchant Trains, Barbarian Attack). Directions
// follow ScenarioPortAnchor: 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE (the edge the
// harbor sits on, seen from the land hex). These differ from the base game's
// STANDARD_PORT_ANCHORS_3_4, which stay as they are.
export const TB_FRAME_PORTS_3_4: ScenarioPortAnchor[] = [
  { q: 0, r: -2, direction: 4, fixedType: 'generic' }, // top-left, NW edge
  { q: 1, r: -2, direction: 5, fixedType: 'brick' }, // top, NE edge
  { q: 2, r: -1, direction: 5, fixedType: 'wood' }, // upper right, NE edge
  { q: 2, r: 0, direction: 0, fixedType: 'generic' }, // right, E edge
  { q: 1, r: 1, direction: 1, fixedType: 'wheat' }, // lower right, SE edge
  { q: -1, r: 2, direction: 1, fixedType: 'ore' }, // bottom, SE edge
  { q: -2, r: 2, direction: 2, fixedType: 'generic' }, // bottom-left, SW edge
  { q: -2, r: 1, direction: 3, fixedType: 'sheep' }, // left, W edge
  { q: -1, r: -1, direction: 3, fixedType: 'generic' }, // upper left, W edge
];
