import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase, giveResources } from '@/game/__testHelpers';
import { hexRollsOn } from '@/game/board/hexNumbers';
import type { GameState } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { deriveBoardEvents } from './events';

const game = () => runSetupPhase(createGame({ playerNames: ['A', 'B', 'C'], seed: 21, randomizeTurnOrder: false }));
const dice = (total: number): [number, number] => [Math.min(6, total - 1), total - Math.min(6, total - 1)];

describe('board animation events', () => {
  it('a roll sends each player the cards it paid, from the hexes that made them', () => {
    const s = game();
    // Find a number that pays someone (not 7).
    for (const total of [6, 8, 5, 9, 4, 10, 3, 11, 2, 12]) {
      const after = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: dice(total) });
      const events = deriveBoardEvents(s, { type: 'rollDice', playerId: 'p0', dice: dice(total) }, after);
      const produce = events.filter((e) => e.kind === 'produce');
      for (const p of after.players) {
        const before = s.players.find((x) => x.id === p.id)!;
        for (const r of RESOURCES) {
          const gained = p.resources[r] - before.resources[r];
          const shown = produce
            .filter((e) => e.kind === 'produce' && e.playerId === p.id && 'resource' in e.card && e.card.resource === r)
            .reduce((n, e) => n + (e.kind === 'produce' ? e.count : 0), 0);
          expect(shown).toBe(Math.max(0, gained));
        }
      }
      for (const e of produce) {
        if (e.kind !== 'produce' || !e.hex) continue;
        const hex = after.board.hexes[e.hex]!;
        expect(hexRollsOn(hex, total)).toBe(true);
        expect('resource' in e.card && hex.terrain).toBe('resource' in e.card ? e.card.resource : false);
      }
      if (produce.length > 0) return;
    }
    throw new Error('no number paid anyone');
  });

  it('a 7 pays nothing; ending a turn shows nothing', () => {
    const s = game();
    const seven = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(deriveBoardEvents(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] }, seven).filter((e) => e.kind === 'produce')).toEqual([]);
    const rolled = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [2, 4] });
    const ended = applyAction(rolled, { type: 'endTurn', playerId: 'p0' });
    expect(deriveBoardEvents(rolled, { type: 'endTurn', playerId: 'p0' }, ended)).toEqual([]);
  });

  it('new pieces, dev card buys and plays, and awards changing hands', () => {
    let s = applyAction(game(), { type: 'rollDice', playerId: 'p0', dice: [2, 4] });
    s = giveResources(s, 'p0', { wood: 3, brick: 3, sheep: 3, wheat: 3, ore: 3 });
    // A road on a free edge next to p0's network.
    const p0 = s.players.find((p) => p.id === 'p0')!;
    const edge = s.board.vertices[p0.settlements[0]!]!.edges.find((e) => !s.players.some((p) => p.roads.includes(e)))!;
    const road = { type: 'buildRoad' as const, playerId: 'p0', edge };
    const afterRoad = applyAction(s, road);
    expect(deriveBoardEvents(s, road, afterRoad)).toContainEqual({ kind: 'build', playerId: 'p0', piece: 'road', edge });
    // A city.
    const city = { type: 'buildCity' as const, playerId: 'p0', vertex: p0.settlements[0]! };
    const afterCity = applyAction(s, city);
    const cityEvents = deriveBoardEvents(s, city, afterCity);
    expect(cityEvents).toContainEqual({ kind: 'build', playerId: 'p0', piece: 'city', vertex: p0.settlements[0] });
    expect(cityEvents.some((e) => e.kind === 'build' && e.piece === 'settlement')).toBe(false);
    // A dev card bought, then (next turn) a knight played.
    const buy = { type: 'buyDevCard' as const, playerId: 'p0' };
    const afterBuy = applyAction(s, buy);
    expect(deriveBoardEvents(s, buy, afterBuy)).toContainEqual({ kind: 'devBuy', playerId: 'p0' });
    const knight = { type: 'playKnight' as const, playerId: 'p0' };
    expect(deriveBoardEvents(s, knight, s)).toContainEqual({ kind: 'devPlay', playerId: 'p0', icon: '⚔️', label: 'Knight' });
    // Longest Road moving from p1 to p0, and Largest Army lost.
    const from: GameState = { ...s, longestRoad: { holder: 'p1', length: 5 }, largestArmy: { holder: 'p2', size: 3 } };
    const to: GameState = { ...s, longestRoad: { holder: 'p0', length: 6 }, largestArmy: null };
    const awards = deriveBoardEvents(from, road, to).filter((e) => e.kind === 'award');
    expect(awards).toEqual([
      { kind: 'award', award: 'longestRoad', from: 'p1', to: 'p0' },
      { kind: 'award', award: 'largestArmy', from: 'p2', to: null },
    ]);
  });
});
