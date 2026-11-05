import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import type { Action, GameState } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '../index';

// Heuristic AIs play New World's random boards to the end at 3-6 players:
// every AI move must be legal on a freshly dealt board, the robber must
// come onto the board, and someone must reach 12 VP.
function play(n: number, seed: number, maxSteps = 12000) {
  const names = Array.from({ length: n }, (_, i) => `AI-${i}`);
  let s: GameState = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings: { expansions: ['seafarers'], scenarioId: 'newWorld' },
  });
  let rng = seed;
  // mulberry32 dice so a failure reproduces.
  const die = () => {
    rng = (rng + 0x6d2b79f5) >>> 0;
    let t = rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return 1 + (((t ^ (t >>> 14)) >>> 0) % 6);
  };
  const kinds = new Set<string>();
  let steps = 0;
  for (; steps < maxSteps && s.winner === null; steps++) {
    if (s.pendingTrade) {
      const pt = s.pendingTrade;
      const taker = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id));
      s = applyAction(
        s,
        taker
          ? { type: 'acceptTrade', playerId: taker.id }
          : { type: 'cancelTrade', playerId: pt.proposerId },
      );
      continue;
    }
    const acting = getActingPlayerId(s);
    let action: Action | null = chooseAction(s, acting);
    if (action?.type === 'rollDice') action = { ...action, dice: [die(), die()] };
    action ??= { type: 'endTurn', playerId: acting };
    kinds.add(action.type);
    try {
      s = applyAction(s, action);
    } catch (e) {
      throw new Error(
        `newWorld ${n}p seed ${seed} step ${steps} phase ${s.phase}: ${JSON.stringify(action)} -> ${(e as Error).message}`,
      );
    }
  }
  return { state: s, kinds, steps };
}

describe('heuristic AIs play New World', () => {
  for (const n of [3, 4, 5, 6]) {
    it(`finishes at ${n}p`, () => {
      let bonuses = 0;
      for (const seed of [3, 17]) {
        const { state, kinds } = play(n, seed);
        expect(state.winner, `seed ${seed}`).not.toBeNull();
        expect(kinds.has('buildShip'), `seed ${seed}`).toBe(true);
        // The robber came onto the board (a 7 or a Knight).
        expect(state.robberActive, `seed ${seed}`).toBe(true);
        bonuses += state.islandChips!.reduce((a, c) => a + c.claimedBy.length, 0);
      }
      // Someone sailed to an island they didn't start on for its 1 VP.
      expect(bonuses).toBeGreaterThan(0);
    });
  }
});
