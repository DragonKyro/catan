import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice } from '@/game/rng';
import type { Action, GameState } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '@/ai';
import { tradersLogLines } from './tradersLog';

// Play seeded all-AI games and collect the T&B log lines along the way.
function lines(scenario: string, seed: number): string[] {
  let s: GameState = createGame({
    playerNames: ['A', 'B', 'C'],
    playerTypes: ['ai', 'ai', 'ai'],
    seed,
    settings: { expansions: ['traders'], tradersScenarioId: scenario },
  });
  let dice = seed;
  const out: string[] = [];
  for (let n = 0; n < 4000 && s.phase !== 'gameOver'; n++) {
    let action: Action;
    const pt = s.pendingTrade;
    if (pt) {
      const acceptor = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id));
      action = acceptor ? { type: 'acceptTrade', playerId: acceptor.id } : { type: 'cancelTrade', playerId: pt.proposerId };
    } else {
      const acting = getActingPlayerId(s);
      action = chooseAction(s, acting) ?? { type: 'endTurn', playerId: acting };
    }
    if (action.type === 'rollDice') {
      const [d, next] = rollDice(dice);
      dice = next;
      action = { ...action, dice: d };
    }
    const next = applyAction(s, action);
    for (const l of tradersLogLines(s, action, next)) out.push(l.text);
    s = next;
  }
  return out;
}

describe('T&B log lines', () => {
  it('narrate Rivers of Catan', () => {
    const all = [1, 2, 3].flatMap((seed) => lines('riversOfCatan', seed));
    expect(all.some((t) => t.startsWith('built a bridge'))).toBe(true);
    expect(all.some((t) => t.startsWith('earned 1 gold'))).toBe(true);
    expect(all.some((t) => t.startsWith('paid 2 gold'))).toBe(true);
    expect(all.some((t) => t.includes('Wealthiest Catanian'))).toBe(true);
    expect(all.some((t) => t.includes('Poor Catanian'))).toBe(true);
  });

  it('narrate Fishing on Catan without revealing token values', () => {
    const all = [1, 2, 3].flatMap((seed) => lines('fishingOnCatan', seed));
    expect(all.some((t) => /^caught \d fish token/.test(t))).toBe(true);
    expect(all.some((t) => t.startsWith('spent fish'))).toBe(true);
    expect(all.some((t) => /one-fish|two-fish|three-fish/.test(t))).toBe(false);
  });
});
