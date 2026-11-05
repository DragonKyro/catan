import { describe, expect, it } from 'vitest';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { simulateCK, type SimResult } from './testSupport';

// Heuristic AIs play whole Cities & Knights games against each other. Every
// action goes through the reducer (an illegal AI move throws), every game
// must reach gameOver inside the step cap, and across the games the AIs
// must actually use the expansion: knights, improvements, walls, progress
// cards, commodity trades.

const STEP_CAP = 8000;
const SEEDS = [1, 2, 3, 4, 5];

const games = new Map<number, SimResult[]>();
function gamesAt(players: number): SimResult[] {
  if (!games.has(players)) games.set(players, SEEDS.map((seed) => simulateCK(players, seed, STEP_CAP)));
  return games.get(players)!;
}

describe('heuristic AIs play Cities & Knights', () => {
  for (const players of [3, 4]) {
    it(`finishes ${players}-player games`, () => {
      gamesAt(players).forEach((r, i) => {
        expect(r.state.phase, `${players}p seed ${SEEDS[i]} stuck after ${r.steps} steps`).toBe('gameOver');
        const winner = r.state.winner!;
        expect(calculateVictoryPoints(r.state, winner, true)).toBeGreaterThanOrEqual(
          r.state.settings.victoryPointsToWin,
        );
      });
    }, 120_000);
  }

  it('finishes 5- and 6-player games (paired turns)', () => {
    for (const players of [5, 6]) {
      const r = simulateCK(players, 11, STEP_CAP);
      expect(r.state.phase, `${players}p stuck after ${r.steps} steps`).toBe('gameOver');
    }
  }, 120_000);

  it("finishes on the rulebook's first-game board", () => {
    const r = simulateCK(4, 12, STEP_CAP, { baseScenarioId: 'ckFirstGame' });
    expect(r.state.phase).toBe('gameOver');
  }, 120_000);

  it('uses the expansion rules', () => {
    const totals: Record<string, number> = {};
    for (const r of [...gamesAt(3), ...gamesAt(4)]) {
      for (const [k, v] of Object.entries(r.counts)) totals[k] = (totals[k] ?? 0) + v;
    }
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
  }, 120_000);
});
