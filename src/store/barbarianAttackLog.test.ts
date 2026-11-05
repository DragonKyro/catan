import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import type { GameState } from '@/game/types';
import { resolveBarbarianLanding } from '@/game/modules/traders/barbarianAttack/landing';
import { barbarianAttackLogLines } from './barbarianAttackLog';

describe('Barbarian Attack log', () => {
  it('shows one roll that lands on both coastal 5s (5-6 players) as one entry', () => {
    const base = createGame({
      playerNames: ['A', 'B', 'C', 'D', 'E'],
      seed: 1,
      settings: { expansions: ['traders'], tradersScenarioId: 'barbarianAttack' },
      randomizeTurnOrder: false,
    });
    let checked = false;
    for (let seed = 1; seed < 80 && !checked; seed++) {
      const before: GameState = { ...base, rngState: seed * 104729 };
      const after = resolveBarbarianLanding(before, 'p0');
      const ev = after.barbarianAttack!.lastEvents!.events[0]!;
      if (ev.kind !== 'landing') continue;
      const totals = ev.rolls.map((r) => r.dice[0] + r.dice[1]);
      if (!totals.includes(5)) continue;
      const [line] = barbarianAttackLogLines(
        before,
        { type: 'buildSettlement', playerId: 'p0', vertex: before.board.vertexIds[0]! },
        after,
      );
      // Three distinct rolls, so three "🎲" entries even with four or five hexes hit.
      expect(line!.text.match(/🎲/g)).toHaveLength(3);
      expect(line!.text).toMatch(/🎲 5: \+1 on the 5 \([a-z]+\) and \+1 on the 5 \([a-z]+\)/);
      checked = true;
    }
    expect(checked).toBe(true);
  });
});
