import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import { generateSeafarersBoard } from '@/game/modules/seafarers/board/generator';
import { SCENARIO_ORDER } from '@/game/modules/seafarers/board/scenarios';
import { getPortMarkerPosition, getEdgeMidpoint } from './boardLayout';

// Regression guard for the port-direction bug: on Seafarers boards every
// coastal edge has BOTH a land hex and a sea hex as neighbours, so the
// rendering code has to pick the land one when deciding which way to push
// the marker outward — otherwise the port icon ends up sitting on land.
describe('getPortMarkerPosition — port markers face the sea', () => {
  it('base game (3p): every port marker is farther from the land hex than the edge midpoint is', () => {
    const game = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 42,
      randomizeTurnOrder: false,
    });
    for (const port of game.board.ports) {
      const mid = getEdgeMidpoint(game.board, port.edge);
      const marker = getPortMarkerPosition(game.board, port.edge, 26);
      const edge = game.board.edges[port.edge]!;
      const landHex = edge.hexes
        .map((id) => game.board.hexes[id]!)
        .find((h) => h.terrain !== 'sea')!;
      // The marker should be farther from the land hex center than the
      // midpoint is. Otherwise it sits on (or behind) the land hex.
      const dMid = Math.hypot(mid.x - landHex.center.x, mid.y - landHex.center.y);
      const dMarker = Math.hypot(marker.x - landHex.center.x, marker.y - landHex.center.y);
      expect(dMarker).toBeGreaterThan(dMid);
    }
  });

  for (const { id, label } of SCENARIO_ORDER) {
    it(`seafarers ${label}: every port marker is on the sea side of its edge`, () => {
      const { board } = generateSeafarersBoard(id, 1, 3);
      for (const port of board.ports) {
        const mid = getEdgeMidpoint(board, port.edge);
        const marker = getPortMarkerPosition(board, port.edge, 26);
        const edge = board.edges[port.edge]!;
        const landHex = edge.hexes
          .map((hid) => board.hexes[hid]!)
          .find((h) => h.terrain !== 'sea');
        // All Seafarers ports should sit on a land/sea coastal edge.
        expect(landHex).toBeDefined();
        const dMid = Math.hypot(
          mid.x - landHex!.center.x,
          mid.y - landHex!.center.y,
        );
        const dMarker = Math.hypot(
          marker.x - landHex!.center.x,
          marker.y - landHex!.center.y,
        );
        expect(dMarker).toBeGreaterThan(dMid);
      }
    });
  }
});
