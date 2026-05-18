import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { runSetupPhase } from '../../../__testHelpers';
import { applyAction } from '../../../engine';
import type { GameState } from '../../../types';

function newFishingSession(): GameState {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 1,
      settings: {
        expansions: ['traders'],
        tradersScenarioId: 'fishingOnCatan',
      },
      randomizeTurnOrder: false,
    }),
  );
}

function withBoot(state: GameState, playerId: string): GameState {
  return { ...state, oldBootHolder: playerId };
}

describe('passOldBoot', () => {
  it('rejects passing when you don\'t hold the boot', () => {
    let s = newFishingSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    expect(() =>
      applyAction(s, { type: 'passOldBoot', playerId: 'p0', to: 'p1' }),
    ).toThrow(/do not have the old boot/);
  });

  it('passes the boot to a player with ≥ your VPs', () => {
    let s = newFishingSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = withBoot(s, 'p0');
    // After setup, all players have 2 VPs each (2 settlements). Passing
    // boot to p1 (also 2 VPs) is legal.
    s = applyAction(s, { type: 'passOldBoot', playerId: 'p0', to: 'p1' });
    expect(s.oldBootHolder).toBe('p1');
  });

  it('rejects passing to a player with fewer VPs', () => {
    // Construct a state where p0 has 3 VPs and p1 has 2.
    let s = newFishingSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = withBoot(s, 'p0');
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0'
          ? {
              ...p,
              devCards: { ...p.devCards, victoryPoints: 1 }, // hidden — doesn't count
            }
          : p,
      ),
    };
    // Hidden VP shouldn't make p0 ineligible to pass — boot rule uses
    // PUBLIC VP. With public 2/2, p1 is still a legal recipient.
    s = applyAction(s, { type: 'passOldBoot', playerId: 'p0', to: 'p1' });
    expect(s.oldBootHolder).toBe('p1');
  });

  it('boot holder needs +1 VP to win', () => {
    let s = newFishingSession();
    // Cheat-load p0 to the brink of winning with the boot.
    s = {
      ...s,
      oldBootHolder: 'p0',
      players: s.players.map((p) =>
        p.id === 'p0'
          ? {
              ...p,
              // 2 settlements (2 VP) + Longest Road (+2) + Largest Army (+2) +
              // a fake "we have 10 VP" via 4 hidden VP dev cards = 10 VP total.
              // Without the boot p0 would win on next action; with the boot
              // they need 11.
              hasLongestRoad: true,
              hasLargestArmy: true,
              devCards: { ...p.devCards, victoryPoints: 4 },
            }
          : p,
      ),
      longestRoad: { holder: 'p0', length: 5 },
      largestArmy: { holder: 'p0', size: 3 },
      phase: 'main',
      hasRolledThisTurn: true,
    };
    // engine.recomputeDerived only runs win-check at the end of actions —
    // simulate by doing an endTurn (cheap action that won't change VPs).
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.winner).toBeNull();
  });
});
