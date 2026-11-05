import type { Scenario } from '../types';
import { generateNewWorldLayout } from '../newWorldBoard';

// New World — Seafarers rulebook p.20 (3-4 players) and Seafarers 5-6 p.12.
//
// No fixed map: every game deals the listed hexes into the frame at random,
// then the number discs, then random harbors on the coasts
// (../newWorldBoard.ts; procedure and judgment calls in
// docs/map-specs/NEWWORLD-SPEC.md).
//
//   3-4p: 42-hex frame — 19 sea, 4 hills, 5 forests, 5 pastures, 5 fields,
//         4 mountains; 23 discs; 5 × 2:1 + 5 × 3:1 harbors.
//   5-6p: 63-hex frame — 21 sea, 4 gold, 7 of each resource terrain,
//         3 deserts; 39 discs; 6 × 2:1 + 5 × 3:1 harbors.
//
// Rules: start on one or two islands (your home islands); your first
// settlement on each other island earns 1 VP, whoever else is already
// there (`bonusOnEveryIsland`); 12 VP wins, at 5-6 players too. The robber
// and the pirate start on the frame: the robber off the board until the
// first 7 / Knight, the pirate on the sea hex touching the least land.
export const newWorld: Scenario = {
  id: 'newWorld',
  name: 'New World',
  hexes: [],
  ports: [],
  defaultIslandBonusVp: 1,
  defaultVpToWin: 12,
  minPlayers: 3,
  maxPlayers: 6,
  startingPlacementZone: 'anyIsland',
  bonusOnEveryIsland: true,
  randomLayout: generateNewWorldLayout,
  robberStartsOffBoard: true,
};
