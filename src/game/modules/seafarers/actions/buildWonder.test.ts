import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { calculateVictoryPoints } from '../../../scoring/points';
import type { GameState } from '../../../types';
import { getWonder } from '../wonders/catalogue';

// The Wonders of Catan scenario seeds `state.wonders` with all 5 wonders
// at level 0. The buildWonder action validates phase, current player,
// prereq, cost, and claim status, and triggers an instant-win when a
// wonder hits its max level.
describe('Wonders of Catan: build wonder', () => {
  function fresh(): GameState {
    const g = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 11,
      settings: { expansions: ['seafarers'], scenarioId: 'wondersOfCatan' },
      randomizeTurnOrder: false,
    });
    // Jump past setup into main so the action handler accepts.
    return { ...g, phase: 'main', hasRolledThisTurn: true };
  }

  it('seeds 5 wonders at level 0', () => {
    const s = fresh();
    expect(s.wonders).toBeDefined();
    expect(s.wonders!.length).toBe(5);
    for (const w of s.wonders!) {
      expect(w.level).toBe(0);
      expect(w.builtBy).toBeNull();
    }
  });

  it('rejects when prereq is not met', () => {
    const s = fresh();
    // Great Wall requires 3 cities; p0 has 0 → must fail even if affordable.
    const withCost = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, resources: { wood: 5, brick: 5, sheep: 5, wheat: 5, ore: 5 } } : p,
      ),
    };
    expect(() =>
      applyAction(withCost, { type: 'buildWonder', playerId: 'p0', wonderId: 'greatWall' }),
    ).toThrow(/prerequisite/i);
  });

  it('rejects when player cannot afford', () => {
    const s = fresh();
    // Force prereq for Hanging Gardens (4 settlements). Cost is 1 wheat,
    // 1 sheep, 1 wood per level — give the player ZERO of those.
    const withSettles = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              settlements: ['v1', 'v2', 'v3', 'v4'],
              resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
            }
          : p,
      ),
    };
    expect(() =>
      applyAction(withSettles, {
        type: 'buildWonder',
        playerId: 'p0',
        wonderId: 'hangingGardens',
      }),
    ).toThrow(/afford/i);
  });

  it('claims, increments level, adds VP', () => {
    const s = fresh();
    const def = getWonder('hangingGardens');
    const armed = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              settlements: ['v1', 'v2', 'v3', 'v4'],
              resources: { wood: 1, brick: 0, sheep: 1, wheat: 1, ore: 0 },
            }
          : p,
      ),
    };
    const vpBefore = calculateVictoryPoints(armed, 'p0', false);
    const next = applyAction(armed, {
      type: 'buildWonder',
      playerId: 'p0',
      wonderId: 'hangingGardens',
    });
    const w = next.wonders!.find((x) => x.id === 'hangingGardens')!;
    expect(w.level).toBe(1);
    expect(w.builtBy).toBe('p0');
    // +1 VP for the level (we have settlements set in state too but they
    // were there pre-action so they don't contribute to the delta).
    expect(calculateVictoryPoints(next, 'p0', false) - vpBefore).toBe(1);
    expect(next.players[0]!.resources.wood).toBe(1 - (def.costPerLevel.wood ?? 0));
  });

  it('locks other players out once claimed', () => {
    let s = fresh();
    s = {
      ...s,
      wonders: s.wonders!.map((w) =>
        w.id === 'hangingGardens' ? { ...w, builtBy: 'p1', level: 1 } : w,
      ),
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              settlements: ['v1', 'v2', 'v3', 'v4'],
              resources: { wood: 5, brick: 0, sheep: 5, wheat: 5, ore: 0 },
            }
          : p,
      ),
    };
    expect(() =>
      applyAction(s, {
        type: 'buildWonder',
        playerId: 'p0',
        wonderId: 'hangingGardens',
      }),
    ).toThrow(/being built by another/i);
  });

  it('completing a wonder triggers immediate win', () => {
    let s = fresh();
    // Plant p0 as the active builder at level (max - 1), then build the
    // final level with cost in hand.
    const def = getWonder('hangingGardens');
    s = {
      ...s,
      wonders: s.wonders!.map((w) =>
        w.id === 'hangingGardens'
          ? { ...w, builtBy: 'p0', level: def.maxLevel - 1 }
          : w,
      ),
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              settlements: ['v1', 'v2', 'v3', 'v4'],
              resources: { wood: 1, brick: 0, sheep: 1, wheat: 1, ore: 0 },
            }
          : p,
      ),
    };
    const final = applyAction(s, {
      type: 'buildWonder',
      playerId: 'p0',
      wonderId: 'hangingGardens',
    });
    expect(final.winner).toBe('p0');
    expect(final.phase).toBe('gameOver');
  });
});
