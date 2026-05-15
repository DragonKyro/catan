import { describe, it, expect } from 'vitest';
import { createGame } from '../createGame';
import { applyAction } from '../engine';
import { runSetupPhase, giveResources } from '../__testHelpers';

function setupGame() {
  return runSetupPhase(createGame({ playerNames: ['A', 'B'], seed: 42, randomizeTurnOrder: false }));
}

function reachMainPhase() {
  let s = setupGame();
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
  return s;
}

describe('dev cards', () => {
  it('buys a dev card', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { sheep: 1, wheat: 1, ore: 1 });
    const beforeDeck = s.devCardDeck.length;
    s = applyAction(s, { type: 'buyDevCard', playerId: 'p0' });
    expect(s.devCardDeck.length).toBe(beforeDeck - 1);
    const p0 = s.players[0]!;
    // Card either went to boughtThisTurn (playable next turn) or victoryPoints
    const gainedSomething =
      p0.devCards.boughtThisTurn.length > 0 || p0.devCards.victoryPoints > 0;
    expect(gainedSomething).toBe(true);
  });

  it("does not let a player play a card bought this turn", () => {
    // Stack the deck so we know it's a knight
    let s = reachMainPhase();
    s = { ...s, devCardDeck: [...s.devCardDeck.slice(0, -1), 'knight'] };
    s = giveResources(s, 'p0', { sheep: 1, wheat: 1, ore: 1 });
    s = applyAction(s, { type: 'buyDevCard', playerId: 'p0' });
    expect(() =>
      applyAction(s, { type: 'playKnight', playerId: 'p0' }),
    ).toThrow(/no knight/i);
  });

  it('plays a knight and transitions to moveRobber, returning to main after', () => {
    let s = reachMainPhase();
    // Give p0 a knight directly
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0'
          ? { ...p, devCards: { ...p.devCards, unplayed: ['knight'] } }
          : p,
      ),
    };
    s = applyAction(s, { type: 'playKnight', playerId: 'p0' });
    expect(s.phase).toBe('moveRobber');
    expect(s.pendingRobberMove?.returnTo).toBe('main');
    expect(s.players[0]!.devCards.unplayed).toHaveLength(0);
    expect(s.players[0]!.devCards.playedKnights).toBe(1);
  });

  it('grants Largest Army at 3 played knights', () => {
    let s = reachMainPhase();
    // Manually set p0 to have 3 knights played
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0'
          ? { ...p, devCards: { ...p.devCards, playedKnights: 3 } }
          : p,
      ),
    };
    // Trigger a derived recomputation by applying any no-op-effect action
    // Easiest: end-turn would normally work; instead apply a bank trade with insufficient resources
    // … Actually, just check via the engine after another applyAction that triggers recomputation.
    s = giveResources(s, 'p0', { wood: 4 });
    s = applyAction(s, { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'brick' });
    expect(s.largestArmy?.holder).toBe('p0');
    expect(s.largestArmy?.size).toBe(3);
    expect(s.players[0]!.hasLargestArmy).toBe(true);
  });

  it('Year of Plenty grants two chosen resources from the bank', () => {
    let s = reachMainPhase();
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0'
          ? { ...p, devCards: { ...p.devCards, unplayed: ['yearOfPlenty'] } }
          : p,
      ),
    };
    const beforeWood = s.players[0]!.resources.wood;
    const beforeOre = s.players[0]!.resources.ore;
    s = applyAction(s, {
      type: 'playYearOfPlenty',
      playerId: 'p0',
      resources: ['wood', 'ore'],
    });
    expect(s.players[0]!.resources.wood).toBe(beforeWood + 1);
    expect(s.players[0]!.resources.ore).toBe(beforeOre + 1);
  });

  it('Monopoly takes all of one resource from opponents', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p1', { sheep: 5 });
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0'
          ? { ...p, devCards: { ...p.devCards, unplayed: ['monopoly'] } }
          : p,
      ),
    };
    const beforeSheepP0 = s.players[0]!.resources.sheep;
    s = applyAction(s, { type: 'playMonopoly', playerId: 'p0', resource: 'sheep' });
    expect(s.players[0]!.resources.sheep).toBe(beforeSheepP0 + 5);
    expect(s.players[1]!.resources.sheep).toBe(0);
  });

  it("doesn't let a player play two cards in one turn", () => {
    let s = reachMainPhase();
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0'
          ? { ...p, devCards: { ...p.devCards, unplayed: ['monopoly', 'yearOfPlenty'] } }
          : p,
      ),
    };
    s = applyAction(s, { type: 'playMonopoly', playerId: 'p0', resource: 'wood' });
    expect(() =>
      applyAction(s, {
        type: 'playYearOfPlenty',
        playerId: 'p0',
        resources: ['wood', 'brick'],
      }),
    ).toThrow(/already played/i);
  });
});
