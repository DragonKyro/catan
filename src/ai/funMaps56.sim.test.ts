import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import type { GameState } from '@/game/types';
import { simulate } from './traders/simSupport';
import { vertexScore } from './value';

// The Fun Maps that gained 5-6 player boards: all-heuristic-AI games at 5
// and 6 players (paired turns) must reach gameOver with a winner, without a
// rejected action, on each map.
const MAPS = ['blackForest', 'diamond', 'gear', 'lakes', 'twirl', 'volcano'];

describe('Fun Maps at 5-6 players, all-AI', () => {
  for (const id of MAPS) {
    for (const players of [5, 6]) {
      it(`${id} at ${players}p finishes`, () => {
        const r = simulate(3 + players, players, { baseScenarioId: id, expansions: [] }, 15000);
        expect(r.final.phase).toBe('gameOver');
        expect(r.final.winner).toBeTruthy();
        expect(r.final.boardVariant).toBe('5-6');
      }, 120_000);
    }
  }

  it('the AI still shuns the 5-6 volcano', () => {
    const game = createGame({
      playerNames: ['A', 'B', 'C', 'D', 'E'],
      playerTypes: ['ai', 'ai', 'ai', 'ai', 'ai'],
      seed: 3,
      settings: { baseScenarioId: 'volcano', expansions: [] },
      randomizeTurnOrder: false,
    });
    const corner = game.board.hexes[game.board.volcanoHex!]!.corners[0]!;
    const noVolcano: GameState = { ...game, board: { ...game.board, volcanoHex: undefined } };
    expect(vertexScore(noVolcano, corner, 'p0') - vertexScore(game, corner, 'p0')).toBeCloseTo(3.5);
  });
});
