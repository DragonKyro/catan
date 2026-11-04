import { describe, expect, it } from 'vitest';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { simulateCK } from './testSupport';

// Heuristic AIs play whole Cities & Knights games against each other. Every
// action goes through the reducer (an illegal AI move throws), every game
// must reach gameOver inside the step cap, and across the games the AIs
// must actually use the expansion: knights, improvements, walls, progress
// cards, commodity trades.

const STEP_CAP = 8000;

describe('heuristic AIs play Cities & Knights', () => {
  const totals: Record<string, number> = {};
  const add = (counts: Record<string, number>) => {
    for (const [k, v] of Object.entries(counts)) totals[k] = (totals[k] ?? 0) + v;
  };

  for (const players of [3, 4]) {
    it(`finishes ${players}-player games`, () => {
      for (const seed of [1, 2, 3, 4]) {
        const r = simulateCK(players, seed, STEP_CAP);
        expect(r.state.phase, `${players}p seed ${seed} stuck after ${r.steps} steps`).toBe('gameOver');
        const winner = r.state.winner!;
        expect(calculateVictoryPoints(r.state, winner, true)).toBeGreaterThanOrEqual(
          r.state.settings.victoryPointsToWin,
        );
        add(r.counts);
      }
    }, 120_000);
  }

  it('finishes a 5-player game (paired turns)', () => {
    const r = simulateCK(5, 11, STEP_CAP);
    expect(r.state.phase).toBe('gameOver');
    add(r.counts);
  }, 120_000);

  it('uses the expansion rules', () => {
    for (const kind of [
      'recruitKnight',
      'activateKnight',
      'promoteKnight',
      'buildCityImprovement',
      'buildCityWall',
      'playProgressCard',
      'bankTradeCK',
      'chaseRobber',
      'discardCK',
    ]) {
      expect(totals[kind] ?? 0, kind).toBeGreaterThan(0);
    }
    // A spread of progress cards, not one favourite.
    const cardKinds = Object.keys(totals).filter((k) => k.startsWith('playProgressCard:'));
    expect(cardKinds.length).toBeGreaterThanOrEqual(12);
  });
});
