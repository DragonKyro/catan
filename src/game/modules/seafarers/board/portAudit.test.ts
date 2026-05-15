import { describe, it, expect } from 'vitest';
import { generateSeafarersBoard } from './generator';
import { classifyEdge } from './edges';
import { SCENARIO_ORDER } from './scenarios';

// Every Seafarers port must sit on a coastal edge (land hex on one side,
// sea on the other). A port on an all-land edge looks wrong on the board
// and is unreachable from a ship network. This is a tight regression
// guard — easy to break when authoring or tweaking a scenario layout.
describe('seafarers port placement', () => {
  for (const { id, label } of SCENARIO_ORDER) {
    for (const np of [3, 5] as const) {
      it(`${label} (${np}p): every port sits on a coastal edge`, () => {
        const { board } = generateSeafarersBoard(id, 1, np);
        const bad = board.ports
          .map((p) => ({ edge: p.edge, type: p.type, c: classifyEdge(board, p.edge) }))
          .filter((p) => p.c !== 'coastal');
        expect(bad).toEqual([]);
      });
    }
  }
});
