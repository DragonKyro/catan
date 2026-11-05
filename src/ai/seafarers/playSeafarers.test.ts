import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import type { Action, GameState } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '../index';

// Heuristic AIs play every Seafarers scenario. The point is to exercise the
// engine + AI end to end: every AI action must be legal (applyAction throws
// otherwise) and the game must keep moving.
function play(scenarioId: string, n: number, seed: number, maxSteps = 6000) {
  const names = Array.from({ length: n }, (_, i) => `AI-${i}`);
  let s: GameState = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings: { expansions: ['seafarers'], scenarioId },
  });
  // Deterministic dice so a failure reproduces.
  let rng = seed;
  // mulberry32 — an LCG's low bits cycle far too quickly for dice.
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

const SCENARIOS: Array<[string, number[]]> = [
  ['headingForNewShores', [3, 4, 5]],
  ['fourIslands', [3, 4, 6]],
  ['fogIsland', [3, 4, 5]],
  ['throughTheDesert', [3, 4, 6]],
  ['forgottenTribe', [3, 4, 5]],
  ['clothForCatan', [3, 4, 6]],
  ['pirateIslands', [3, 4, 5, 6]],
  ['wondersOfCatan', [3, 4, 5]],
  ['newWorld', [3, 4]],
];

describe('heuristic AIs play Seafarers', () => {
  for (const [id, counts] of SCENARIOS) {
    for (const n of counts) {
      it(`${id} at ${n}p`, () => {
        for (const seed of [11, 23]) {
          const { state, kinds } = play(id, n, seed);
          expect(state.phase === 'gameOver' || kinds.has('buildShip')).toBe(true);
        }
      }, 120_000);
    }
  }
});
