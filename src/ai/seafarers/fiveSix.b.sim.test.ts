import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import type { Action, GameState } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '../index';

// All-AI 5p / 6p games of the four fixed-setup Seafarers scenarios on their
// 5-6 maps (docs/map-specs/SEAFARERS56-SPEC-B.md) must play to a winner:
// tribe pickups, cloth trade routes, the Pirate Islands line + fortress
// assaults and the wonders all have to work on these boards.
function play(scenarioId: string, n: number, seed: number, maxSteps = 15000) {
  const names = Array.from({ length: n }, (_, i) => `AI-${i}`);
  let s: GameState = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings: { expansions: ['seafarers'], scenarioId },
  });
  // mulberry32 dice, so a failure reproduces.
  let rng = seed;
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
        `${scenarioId} ${n}p seed ${seed} step ${steps} phase ${s.phase}: ${JSON.stringify(action)} -> ${(e as Error).message}`,
      );
    }
  }
  return { state: s, kinds, steps };
}

// Per scenario: an action the AIs must have used, and a mechanic check on
// the finished game.
const SCENARIOS: Array<[string, string[], (s: GameState) => boolean]> = [
  ['forgottenTribe', ['buildShip'], (s) => s.tribeTokens!.some((t) => t.claimedBy !== null)],
  ['clothForCatan', ['buildShip'], (s) => s.clothVillages!.some((v) => v.partners.length > 0)],
  // The win needs a recaptured fortress.
  ['pirateIslands', ['buildShip'], (s) => s.pirateIslands!.fortresses.some((f) => f.lairs === 0)],
  ['wondersOfCatan', ['claimWonder', 'buildWonder'], (s) => s.wonders!.some((w) => w.level > 0)],
];

describe('heuristic AIs finish Seafarers 5-6 games', () => {
  for (const [id, used, mechanic] of SCENARIOS) {
    for (const n of [5, 6]) {
      it(`${id} at ${n}p`, () => {
        for (const seed of [n, 11]) {
          const { state, kinds, steps } = play(id, n, seed);
          const tag = `${id} ${n}p seed ${seed}`;
          expect(state.winner, `${tag}: no winner after ${steps} steps`).not.toBeNull();
          for (const k of used) expect(kinds.has(k), `${tag} never used ${k}`).toBe(true);
          expect(mechanic(state), `${tag}: scenario mechanic unused`).toBe(true);
        }
      }, 180_000);
    }
  }
});
