import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase } from '@/game/__testHelpers';
import type { Action, GameState } from '@/game/types';
import { tradersBarbariansLogLines } from './tradersBarbariansLog';

function game(): GameState {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 2,
      randomizeTurnOrder: false,
      settings: { expansions: ['traders'], tradersScenarioId: 'tradersAndBarbarians' },
    }),
  );
}

function lines(before: GameState, action: Action): [GameState, string[]] {
  const after = applyAction(before, action);
  return [after, tradersBarbariansLogLines(before, action, after).map((l) => l.text)];
}

describe('Traders & Barbarians scenario log', () => {
  it('logs a 2 / 12 re-roll', () => {
    const [, out] = lines(game(), { type: 'rollDice', playerId: 'p0', dice: [6, 6] });
    expect(out[0]).toMatch(/^🎲 12 re-rolled → \d+$/);
  });

  it('logs a barbarian moved after a 7 and the delivery / pick-up', () => {
    let s = applyAction(game(), { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    while (s.phase === 'discard') {
      const pid = Object.keys(s.discardState!.required)[0]!;
      const n = s.discardState!.required[pid]!;
      const p = s.players.find((pl) => pl.id === pid)!;
      const res: Record<string, number> = {};
      let left = n;
      for (const r of ['wood', 'brick', 'sheep', 'wheat', 'ore'] as const) {
        const k = Math.min(left, p.resources[r]);
        if (k > 0) res[r] = k;
        left -= k;
      }
      s = applyAction(s, { type: 'discard', playerId: pid, resources: res });
    }
    expect(s.phase).toBe('moveBarbarian');
    const edge = s.board.edgeIds.find(
      (e) => !s.tradersBarbarians!.barbarians.includes(e) && s.players.every((p) => !p.roads.includes(e)),
    )!;
    let out: string[];
    [s, out] = lines(s, { type: 'moveTbBarbarian', playerId: 'p0', barbarian: 0, edge });
    expect(out).toEqual(['🪓 moved a barbarian (7)']);
    // Deliver at the quarry plaza.
    const q = s.tradersBarbarians!.locations.find((l) => l.id === 'quarry')!;
    const corner = s.board.edges[q.paths[0]!]!.vertices.find((v) => v !== q.plaza)!;
    s = {
      ...s,
      tradersBarbarians: {
        ...s.tradersBarbarians!,
        wagons: { ...s.tradersBarbarians!.wagons, p0: { vertex: corner, level: 1, cargo: { good: 'tools', from: 'castle' }, delivered: 0 } },
      },
    };
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    [s, out] = lines(s, { type: 'moveWagon', playerId: 'p0', to: q.plaza });
    expect(out[0]).toBe('📦 delivered tools to the quarry: +1 VP, +1 gold');
    expect(out[1]).toMatch(/^🛒 picked up (sand|marble) at the quarry \(for the (glassworks|castle)\)$/);
    [, out] = lines(s, { type: 'endTurn', playerId: 'p0' });
    expect(out).toEqual(['🛒 moved their wagon 1 edge']);
  });
});
