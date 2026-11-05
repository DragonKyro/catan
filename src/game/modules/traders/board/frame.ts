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

// The 5-6 player frame ("assemble the frame using all the frame pieces
// from CATAN and CATAN 5-6"): eleven printed harbors, identical on all four
// T&B 5-6 scenario pictures (2025 T&B 5-6 rulebook pp. 5-8; TB56-MAP-SPEC).
// Six signs sit over a coastal notch, where the pier directions decide
// which of the two edges it is (noted per entry). Unlike
// STANDARD_PORT_ANCHORS_5_6 (the base game's), every type is printed.
export const TB_FRAME_PORTS_5_6: ScenarioPortAnchor[] = [
  { q: 1, r: -3, direction: 4, fixedType: 'ore' }, // top, NW edge (piers: notch + N)
  { q: 2, r: -3, direction: 5, fixedType: 'generic' }, // top right, NE edge
  { q: 2, r: -2, direction: 0, fixedType: 'sheep' }, // upper right, E edge (piers: NE + SE)
  { q: 1, r: 1, direction: 0, fixedType: 'generic' }, // lower right, E edge
  { q: -1, r: 3, direction: 0, fixedType: 'sheep' }, // bottom right, E edge (piers: NE + SE)
  { q: -2, r: 3, direction: 1, fixedType: 'wood' }, // bottom, SE edge (piers: S + SE)
  { q: -3, r: 3, direction: 2, fixedType: 'generic' }, // bottom left, SW edge
  { q: -3, r: 2, direction: 3, fixedType: 'brick' }, // lower left, W edge (piers: NW + SW)
  { q: -3, r: 0, direction: 3, fixedType: 'generic' }, // left, W edge
  { q: -2, r: -1, direction: 4, fixedType: 'wheat' }, // upper left, NW edge (piers: NW + N)
  { q: 0, r: -3, direction: 3, fixedType: 'generic' }, // top left, W edge
];
