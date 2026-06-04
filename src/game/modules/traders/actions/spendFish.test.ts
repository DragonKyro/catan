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

function withFishHand(state: GameState, playerId: string, tokens: Array<'one' | 'two' | 'three'>): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, fishTokens: [...(p.fishTokens ?? []), ...tokens] } : p,
    ),
  };
}

describe('spendFish', () => {
  it('rejects spending tokens you don\'t own', () => {
    let s = newFishingSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    expect(() =>
      applyAction(s, {
        type: 'spendFish',
        playerId: 'p0',
        tokens: ['three'],
        effect: { kind: 'removeRobber' },
      }),
    ).toThrow(/don't have/);
  });

  it('rejects spending less than the effect cost', () => {
    let s = newFishingSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = withFishHand(s, 'p0', ['one']);
    expect(() =>
      applyAction(s, {
        type: 'spendFish',
        playerId: 'p0',
        tokens: ['one'],
        effect: { kind: 'removeRobber' }, // cost 2
      }),
    ).toThrow(/needs 2 fish/);
  });

  it('removeRobber takes the robber off the board', () => {
    let s = newFishingSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = withFishHand(s, 'p0', ['two']);
    s = applyAction(s, {
      type: 'spendFish',
      playerId: 'p0',
      tokens: ['two'],
      effect: { kind: 'removeRobber' },
    });
    expect(s.robberActive).toBe(false);
    expect(s.players[0]!.fishTokens).toEqual([]);
    expect((s.fishTokenDiscard ?? []).includes('two')).toBe(true);
  });

  it('takeFromBank deducts from the bank and credits the player', () => {
    let s = newFishingSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = withFishHand(s, 'p0', ['two', 'two']);
    const woodBefore = s.bank.wood;
    s = applyAction(s, {
      type: 'spendFish',
      playerId: 'p0',
      tokens: ['two', 'two'],
      effect: { kind: 'takeFromBank', resource: 'wood' },
    });
    expect(s.players[0]!.resources.wood).toBeGreaterThan(0);
    expect(s.bank.wood).toBe(woodBefore - 1);
  });

  it('forfeits excess fish (over-pay)', () => {
    let s = newFishingSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = withFishHand(s, 'p0', ['three']); // 3 fish, cost 2
    s = applyAction(s, {
      type: 'spendFish',
      playerId: 'p0',
      tokens: ['three'],
      effect: { kind: 'removeRobber' },
    });
    // The whole 'three' token was discarded — excess fish lost.
    expect((s.fishTokenDiscard ?? []).filter((t) => t === 'three').length).toBe(1);
  });
});
