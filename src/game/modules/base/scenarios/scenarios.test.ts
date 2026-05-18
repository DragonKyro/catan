import { describe, expect, it } from 'vitest';
import { createGame } from '../../../createGame';
import { BASE_SCENARIO_ORDER, getBaseScenario } from './index';
import { generateBaseScenarioBoard } from './generator';

// Smoke tests for every Fun Map: each scenario should materialize without
// throwing for every player count in its declared window.

describe('base-game Fun Maps', () => {
  for (const { id } of BASE_SCENARIO_ORDER) {
    if (id === 'standard') continue;
    const scenario = getBaseScenario(id);
    const playerCounts = playerCountsFor(scenario.minPlayers, scenario.maxPlayers);

    for (const n of playerCounts) {
      it(`${id}: builds a board for ${n} players`, () => {
        const { board } = generateBaseScenarioBoard(id, 42, n);
        // Sanity: every hex got a terrain assigned.
        for (const hexId of board.hexIds) {
          const hex = board.hexes[hexId]!;
          expect(hex.terrain).toBeDefined();
          if (hex.terrain !== 'desert' && hex.terrain !== 'sea') {
            expect(hex.numberToken).not.toBeNull();
          }
        }
        // Robber starts somewhere on the board.
        expect(board.robberHex).toBeDefined();
        expect(board.hexes[board.robberHex]).toBeDefined();
      });

      it(`${id}: createGame succeeds for ${n} players`, () => {
        const game = createGame({
          playerNames: Array.from({ length: n }, (_, i) => `P${i + 1}`),
          seed: 42,
          settings: { baseScenarioId: id, expansions: [] },
          randomizeTurnOrder: false,
        });
        expect(game.board).toBeDefined();
        if (id === 'volcano') {
          expect(game.board.volcanoHex).toBeDefined();
          // Volcano fixedToken pins it to 6.
          expect(game.board.hexes[game.board.volcanoHex!]!.numberToken).toBe(6);
        }
      });
    }
  }

  it('standard: createGame uses the legacy generator', () => {
    const game = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 42,
      settings: { baseScenarioId: 'standard', expansions: [] },
      randomizeTurnOrder: false,
    });
    // 19-hex board (3 players → 3-4 variant).
    expect(game.board.hexIds.length).toBe(19);
    expect(game.board.volcanoHex).toBeUndefined();
  });
});

function playerCountsFor(min: number, max: number): number[] {
  const out: number[] = [];
  for (let n = Math.max(min, 3); n <= Math.min(max, 6); n++) out.push(n);
  return out;
}
