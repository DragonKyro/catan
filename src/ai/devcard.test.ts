import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase } from '@/game/__testHelpers';
import type { GameState } from '@/game/types';
import { chooseDevCardPlay } from './devcard';

/** After setup, p0 holds Year of Plenty and 3 ore, so a city is 2 wheat away. */
function needsTwoWheat(bankWheat: number): GameState {
  const s = runSetupPhase(createGame({ playerNames: ['p0', 'p1', 'p2'], seed: 4, randomizeTurnOrder: false }));
  return {
    ...s,
    phase: 'main',
    hasRolledThisTurn: true,
    bank: { ...s.bank, wheat: bankWheat },
    players: s.players.map((p) => (p.id === 'p0'
      ? {
        ...p,
        resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 3 },
        devCards: { ...p.devCards, unplayed: ['yearOfPlenty'] },
      }
      : p)),
  };
}

describe('chooseDevCardPlay — Year of Plenty', () => {
  it('takes two of one resource when the bank has two', () => {
    const s = needsTwoWheat(5);
    const action = chooseDevCardPlay(s, 'p0');
    expect(action).toEqual({ type: 'playYearOfPlenty', playerId: 'p0', resources: ['wheat', 'wheat'] });
    expect(() => applyAction(s, action!)).not.toThrow();
  });

  it('never asks the bank for two of a resource it has only one of', () => {
    const s = needsTwoWheat(1);
    const action = chooseDevCardPlay(s, 'p0');
    if (action) expect(() => applyAction(s, action)).not.toThrow();
  });
});
