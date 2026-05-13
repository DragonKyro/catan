import { describe, it, expect } from 'vitest';
import { createGame } from '../createGame';
import { applyAction } from '../engine';
import { runSetupPhase, giveResources } from '../__testHelpers';
import { getBankTradeRate } from './trade';

function setupGame() {
  return runSetupPhase(createGame({ playerNames: ['A', 'B'], seed: 42 }));
}

function reachMainPhase() {
  let s = setupGame();
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
  return s;
}

describe('bank trade', () => {
  it('defaults to 4:1 with no ports', () => {
    let s = reachMainPhase();
    // Strip ports from p0
    s = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: [] } : p)) };
    expect(getBankTradeRate(s, 'p0', 'wood')).toBe(4);
  });

  it('uses 3:1 with a generic port', () => {
    let s = reachMainPhase();
    s = {
      ...s,
      players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: ['generic'] } : p)),
    };
    expect(getBankTradeRate(s, 'p0', 'wood')).toBe(3);
  });

  it('uses 2:1 with the matching specific port', () => {
    let s = reachMainPhase();
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, ports: ['generic', 'wood'] } : p,
      ),
    };
    expect(getBankTradeRate(s, 'p0', 'wood')).toBe(2);
    expect(getBankTradeRate(s, 'p0', 'brick')).toBe(3);
  });

  it('executes a 4:1 trade correctly', () => {
    let s = reachMainPhase();
    s = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: [] } : p)) };
    s = giveResources(s, 'p0', { wood: 4 });
    const beforeBrick = s.players[0]!.resources.brick;
    const beforeWood = s.players[0]!.resources.wood;
    s = applyAction(s, { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'brick' });
    expect(s.players[0]!.resources.wood).toBe(beforeWood - 4);
    expect(s.players[0]!.resources.brick).toBe(beforeBrick + 1);
  });

  it('rejects a 4:1 trade without enough resources', () => {
    let s = reachMainPhase();
    s = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: [], resources: { wood: 3, brick: 0, sheep: 0, wheat: 0, ore: 0 } } : p)) };
    expect(() =>
      applyAction(s, { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'brick' }),
    ).toThrow(/need 4/i);
  });

  it('rejects trading a resource for itself', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 4 });
    expect(() =>
      applyAction(s, { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'wood' }),
    ).toThrow(/itself/i);
  });
});
