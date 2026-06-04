import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { identifyIslands } from './islands';

// Through the Desert sets `desertIsBoundary` on its scenario definition.
// The expected effect: the three central desert hexes act as island
// boundaries during connected-component detection, so the far side of the
// desert becomes its own outer-island chip target. Without the flag, the
// whole land mass would be a single island and no chip would be awarded
// for crossing the desert.
describe('throughTheDesert: desert acts as island boundary', () => {
  it('partitions the main island into multiple components', () => {
    const game = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 42,
      settings: { expansions: ['seafarers'], scenarioId: 'throughTheDesert' },
    });

    // Verify the chip system saw multiple islands (the desert split).
    expect(game.islandChips).toBeDefined();
    expect(game.islandChips!.length).toBeGreaterThanOrEqual(1);

    // Re-run identifyIslands with the flag OFF for comparison: it should
    // produce strictly fewer components, confirming the flag is what
    // creates the partition.
    const withFlag = identifyIslands(game.board, { desertIsBoundary: true });
    const withoutFlag = identifyIslands(game.board);
    const flaggedCount = withFlag.outerIslandIds.length + 1;
    const unflaggedCount = withoutFlag.outerIslandIds.length + 1;
    expect(flaggedCount).toBeGreaterThan(unflaggedCount);

    // Desert hexes themselves get NO island id when the flag is on.
    for (const hex of Object.values(game.board.hexes)) {
      if (hex.terrain === 'desert') {
        expect(game.board.islandOfHex![hex.id]).toBeUndefined();
      }
    }
  });
});
