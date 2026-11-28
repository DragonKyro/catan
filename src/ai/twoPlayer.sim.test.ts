// All-AI 2-player games (colonist.io's 1v1 rules: 15 VP, discard above 9
// cards, Friendly Robber, balanced dice) played to the end.
import { describe, it, expect } from 'vitest';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { totalResources } from '@/game/resources';
import { simulate } from './traders/simSupport';

const ONE_V_ONE = { balancedDice: true, tradersVariants: { friendlyRobber: true } };

describe('2-player games (1v1 rules)', () => {
  it('heuristic AIs play them to 15 VP', () => {
    const turns: number[] = [];
    let discards = 0;
    let smallestDiscardHand = Infinity;
    let sevens = 0;
    let rolls = 0;
    let offers = 0;
    let trades = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { final, steps } = simulate(seed, 2, ONE_V_ONE, 12000, (before, action, after) => {
        if (action.type === 'proposeTrade') offers++;
        if (action.type === 'confirmTrade') trades++;
        if (action.type === 'rollDice' && after.lastRoll) {
          rolls++;
          if (after.lastRoll.total === 7) sevens++;
          if (after.discardState) {
            for (const id of Object.keys(after.discardState.required)) {
              discards++;
              smallestDiscardHand = Math.min(smallestDiscardHand, totalResources(before.players.find((p) => p.id === id)!.resources));
            }
          }
        }
      });
      expect(final.phase, `seed ${seed} stalled after ${steps} steps`).toBe('gameOver');
      expect(final.settings.victoryPointsToWin).toBe(15);
      expect(calculateVictoryPoints(final, final.winner!, true)).toBeGreaterThanOrEqual(15);
      turns.push(final.balancedDice!.counts.reduce((a, b) => a + b, 0));
    }
    // A 7 only cuts hands of 10 or more.
    if (discards > 0) expect(smallestDiscardHand).toBeGreaterThanOrEqual(10);
    if (process.env.DIAG) {
      console.log(`rolls per game ${turns.join(', ')}; 7s ${sevens}/${rolls}; discards ${discards}; `
        + `per game ${(offers / 8).toFixed(1)} offers, ${(trades / 8).toFixed(1)} player trades`);
    }
  }, 120_000);
});
