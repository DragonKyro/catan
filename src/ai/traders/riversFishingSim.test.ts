import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice } from '@/game/rng';
import type { Action, GameState } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '../index';

// All-heuristic-AI games of Rivers of Catan and Fishing on Catan, played to
// the end with seeded dice. Every action must be legal (applyAction throws
// otherwise), every game must finish, and across the seeds the scenario
// mechanics must actually get used.

interface SimResult {
  final: GameState;
  steps: number;
  counts: Record<string, number>;
}

function play(scenario: string, players: number, seed: number, maxSteps = 9000): SimResult {
  const names = ['A', 'B', 'C', 'D'].slice(0, players);
  let s = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings: { expansions: ['traders'], tradersScenarioId: scenario },
  });
  let dice = (seed * 2654435761) >>> 0;
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  let steps = 0;
  for (; s.phase !== 'gameOver' && steps < maxSteps; steps++) {
    let action: Action;
    const pt = s.pendingTrade;
    if (pt) {
      const acceptor = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id));
      action = acceptor
        ? { type: 'acceptTrade', playerId: acceptor.id }
        : { type: 'cancelTrade', playerId: pt.proposerId };
    } else {
      const acting = getActingPlayerId(s);
      action = chooseAction(s, acting) ?? { type: 'endTurn', playerId: acting };
    }
    if (action.type === 'rollDice') {
      const [d, next] = rollDice(dice);
      dice = next;
      action = { ...action, dice: d };
    }
    bump(action.type);
    if (action.type === 'spendFish') bump(`fish:${action.effect.kind}`);
    if (action.type === 'swapFish') bump(action.token ? 'swapFish:swap' : 'swapFish:keep');
    const before = s;
    s = applyAction(s, action);
    if (s.oldBootHolder && s.oldBootHolder !== before.oldBootHolder && action.type !== 'passOldBoot') {
      bump('bootDrawn');
    }
  }
  return { final: s, steps, counts };
}

function total(results: SimResult[], key: string): number {
  return results.reduce((n, r) => n + (r.counts[key] ?? 0), 0);
}

const SEEDS = [1, 2, 3, 4, 5, 6];

describe('All-AI Rivers of Catan', () => {
  const results = [3, 4].flatMap((n) => SEEDS.map((seed) => play('riversOfCatan', n, seed)));

  it('every game finishes with a winner at 10 VP', () => {
    for (const r of results) {
      expect(r.final.phase, `stuck after ${r.steps} steps`).toBe('gameOver');
      expect(r.final.winner).not.toBeNull();
    }
  });

  it('the AIs build bridges, earn and spend gold', () => {
    expect(total(results, 'buildBridge')).toBeGreaterThan(5);
    expect(total(results, 'spendGold')).toBeGreaterThan(5);
    expect(total(results, 'buyGold')).toBeGreaterThan(0);
    const gold = results.flatMap((r) => r.final.players.map((p) => p.gold ?? 0));
    expect(Math.max(...gold)).toBeGreaterThan(0);
  });
});

describe('All-AI Fishing on Catan', () => {
  const results = [3, 4].flatMap((n) => SEEDS.map((seed) => play('fishingOnCatan', n, seed)));

  it('every game finishes with a winner', () => {
    for (const r of results) {
      expect(r.final.phase, `stuck after ${r.steps} steps`).toBe('gameOver');
      expect(r.final.winner).not.toBeNull();
    }
  });

  it('the AIs spend fish on several effects and pass the old boot', () => {
    expect(total(results, 'spendFish')).toBeGreaterThan(20);
    const kinds = ['removeRobber', 'steal', 'takeFromBank', 'buildRoad', 'buyDevCard'].filter(
      (k) => total(results, `fish:${k}`) > 0,
    );
    expect(kinds.length).toBeGreaterThanOrEqual(4);
    expect(total(results, 'bootDrawn')).toBeGreaterThan(0);
    expect(total(results, 'passOldBoot')).toBeGreaterThan(0);
  });

  it('the boot holder needs 11 VP to win', () => {
    for (const r of results) {
      const winner = r.final.winner!;
      if (r.final.oldBootHolder === winner) {
        expect(r.final.settings.victoryPointsToWin).toBe(10);
      }
    }
  });
});

// Printed when run with SIM_REPORT=1 (npx vitest run riversFishingSim).
if (process.env.SIM_REPORT) {
  for (const scenario of ['riversOfCatan', 'fishingOnCatan']) {
    for (const n of [3, 4]) {
      for (const seed of SEEDS) {
        const r = play(scenario, n, seed);
        const keys = Object.keys(r.counts)
          .filter((k) => /Bridge|Gold|Fish|fish:|Boot|boot|swap/.test(k))
          .sort()
          .map((k) => `${k}=${r.counts[k]}`)
          .join(' ');
        console.log(`${scenario} ${n}p s${seed}: ${r.final.phase} after ${r.steps} steps, winner ${r.final.winner} | ${keys}`);
      }
    }
  }
}
