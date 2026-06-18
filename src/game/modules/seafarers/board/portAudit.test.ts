import { describe, it, expect } from 'vitest';
import { generateSeafarersBoard } from './generator';
import { isPortEligibleEdge } from './edges';
import { SCENARIO_ORDER } from './scenarios';

// Every Seafarers port must sit on either a coastal edge (land + sea) or a
// disk-perimeter edge whose adjacent hex is land (a main-island face opening
// onto the painted water border, same as base-game port placements). Both
// look correct on the board; an all-land port (between two land hexes) does
// not.
describe('seafarers port placement', () => {
  for (const { id, label } of SCENARIO_ORDER) {
    for (const np of [3, 5] as const) {
      it(`${label} (${np}p): every port sits on a water-facing edge`, () => {
        const { board } = generateSeafarersBoard(id, 1, np);
        const bad = board.ports
          .map((p) => ({ edge: p.edge, type: p.type, ok: isPortEligibleEdge(board, p.edge) }))
          .filter((p) => !p.ok);
        expect(bad).toEqual([]);
      });
    }
  }
});
