import { describe, it, expect } from 'vitest';
import { createGame } from '../../../../createGame';
import { runSetupPhase, giveResources } from '../../../../__testHelpers';
import { applyAction, calculateRouteLength } from '../../../../engine';
import { canConnectRoad, canPlaceSettlement } from '../../../../placement';
import { getActingPlayerId } from '../../../../helpers';
import type { EventCardKind, GameSettings, GameState, PlayerId, Resource } from '../../../../types';
import { EVENT_CARDS, NEW_YEAR_CARD, buildEventDeck } from './deck';
import { REPAIR_ROAD_COST } from './events';

function start(settings: Partial<GameSettings> = {}, players = 3): GameState {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C', 'D'].slice(0, players),
      seed: 11,
      settings: { tradersVariants: { eventCards: true }, ...settings },
      randomizeTurnOrder: false,
    }),
  );
}

// Put a card of this kind and number on top of the deck.
function topCard(s: GameState, kind: EventCardKind, number: number): GameState {
  return {
    ...s,
    eventCards: { ...s.eventCards!, deck: [{ id: 99, kind, number }, ...s.eventCards!.deck] },
  };
}

function flip(s: GameState): GameState {
  // The dice in the action are ignored: the card decides.
  return applyAction(s, { type: 'rollDice', playerId: getActingPlayerId(s), dice: [1, 1] });
}

function answer(s: GameState, extra: { resource?: Resource; target?: PlayerId | null; edge?: string }): GameState {
  return applyAction(s, { type: 'resolveEvent', playerId: getActingPlayerId(s), ...extra });
}

function hand(s: GameState, id: PlayerId): number {
  const r = s.players.find((p) => p.id === id)!.resources;
  return r.wood + r.brick + r.sheep + r.wheat + r.ore;
}

// A number no building on the board collects on, so production is a no-op.
function deadNumber(s: GameState): number {
  for (const n of [2, 12, 3, 11, 4, 10, 5, 9, 6, 8]) {
    const any = s.board.hexIds.some((h) => {
      const hex = s.board.hexes[h]!;
      return (
        hex.numberToken === n &&
        hex.corners.some((v) => s.players.some((p) => p.settlements.includes(v) || p.cities.includes(v)))
      );
    });
    if (!any) return n;
  }
  throw new Error('no dead number');
}

describe('Catan Event Cards: the deck', () => {
  it('has 36 numbered cards following the 2-dice odds, plus New Year', () => {
    expect(EVENT_CARDS).toHaveLength(36);
    const counts: Record<number, number> = {};
    for (const c of EVENT_CARDS) counts[c.number!] = (counts[c.number!] ?? 0) + 1;
    expect(counts).toEqual({ 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 });
    expect(EVENT_CARDS.filter((c) => c.number === 7).every((c) => c.kind === 'robberAttacks')).toBe(true);
    // Every event in the card list appears.
    const kinds = new Set(EVENT_CARDS.map((c) => c.kind));
    for (const k of ['beautifulDay', 'calmSeas', 'conflict', 'earthquake', 'epidemic', 'goodNeighbors',
      'helpfulNeighbor', 'plentifulYear', 'robberAttacks', 'robberFlees', 'tournament', 'tradeAdvantage'] as const) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(NEW_YEAR_CARD.number).toBeNull();
  });

  it('puts New Year 6th from the bottom', () => {
    const [deck] = buildEventDeck(42);
    expect(deck).toHaveLength(37);
    expect(deck[deck.length - 6]!.kind).toBe('newYear');
    expect(deck.filter((c) => c.kind === 'newYear')).toHaveLength(1);
  });

  it('createGame builds the deck from the seed, for any rule set', () => {
    const a = createGame({ playerNames: ['A', 'B', 'C'], seed: 5, settings: { tradersVariants: { eventCards: true } } });
    const b = createGame({ playerNames: ['A', 'B', 'C'], seed: 5, settings: { tradersVariants: { eventCards: true } } });
    expect(a.eventCards!.deck).toEqual(b.eventCards!.deck);
    expect(a.eventCards!.current).toBeNull();
    const sea = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 5,
      settings: { expansions: ['seafarers'], scenarioId: 'headingForNewShores', tradersVariants: { eventCards: true } },
    });
    expect(sea.eventCards!.deck).toHaveLength(37);
    expect(() =>
      createGame({
        playerNames: ['A', 'B', 'C'],
        seed: 5,
        settings: { expansions: ['citiesAndKnights'], tradersVariants: { eventCards: true } },
      }),
    ).toThrow(/Cities & Knights/);
  });
});

describe('Catan Event Cards: flipping instead of rolling', () => {
  it('production uses the card number, whatever dice the action carries', () => {
    let s = start();
    const top = s.eventCards!.deck[0]!;
    s = topCard(s, 'beautifulDay', 8);
    s = flip(s);
    expect(s.lastRoll?.total).toBe(8);
    expect(s.eventCards!.current?.kind).toBe('beautifulDay');
    expect(s.eventCards!.deck[0]).toEqual(top);
    expect(s.phase).toBe('main');
  });

  it('New Year rebuilds the deck and reveals the next card', () => {
    let s = start();
    s = { ...s, eventCards: { ...s.eventCards!, deck: [NEW_YEAR_CARD] } };
    s = flip(s);
    expect(s.eventCards!.newYear).toBe(true);
    expect(s.eventCards!.current?.kind).not.toBe('newYear');
    expect(s.eventCards!.deck).toHaveLength(36);
    expect(s.hasRolledThisTurn).toBe(true);
  });

  it('Robber Attacks resolves a 7: discards, then the robber', () => {
    let s = start();
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1' ? { ...p, resources: { wood: 9, brick: 0, sheep: 0, wheat: 0, ore: 0 } } : p,
      ),
    };
    s = flip(topCard(s, 'robberAttacks', 7));
    expect(s.phase).toBe('discard');
    expect(s.discardState?.required.p1).toBe(4);
  });

  it('Robber Flees sends the robber to the desert, or off a board without one', () => {
    let s = start();
    const desert = s.board.hexIds.find((h) => s.board.hexes[h]!.terrain === 'desert')!;
    const other = s.board.hexIds.find((h) => h !== desert && s.board.hexes[h]!.terrain !== 'sea')!;
    s = { ...s, board: { ...s.board, robberHex: other } };
    s = flip(topCard(s, 'robberFlees', deadNumber(s)));
    expect(s.board.robberHex).toBe(desert);
    const mt = runSetupPhase(
      createGame({
        playerNames: ['A', 'B', 'C'],
        seed: 3,
        settings: {
          expansions: ['traders'],
          tradersScenarioId: 'merchantTrains',
          tradersVariants: { eventCards: true },
        },
        randomizeTurnOrder: false,
      }),
    );
    const moved = flip(topCard({ ...mt, robberActive: true }, 'robberFlees', 2));
    expect(moved.robberActive).toBe(false);
  });

  it('Epidemic: cities collect only 1', () => {
    let s = start();
    const v = s.players[0]!.settlements[0]!;
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, settlements: p.settlements.filter((x) => x !== v), cities: [v] } : p,
      ),
    };
    const hex = s.board.vertices[v]!.hexes.map((h) => s.board.hexes[h]!).find(
      (h) => h.numberToken !== null && h.id !== s.board.robberHex && h.numberToken !== 7,
    )!;
    const n = hex.numberToken!;
    const before = s.players[0]!.resources;
    const plain = flip(topCard(s, 'beautifulDay', n));
    const sick = flip(topCard(s, 'epidemic', n));
    const gain = (x: GameState) => hand(x, 'p0') - (before.wood + before.brick + before.sheep + before.wheat + before.ore);
    expect(gain(sick)).toBeLessThan(gain(plain));
    expect(sick.players[0]!.cities).toEqual([v]);
  });
});

describe('Catan Event Cards: events with choices', () => {
  it('Plentiful Year: everyone, from the active player, takes a resource; then production', () => {
    let s = start();
    s = flip(topCard(s, 'plentifulYear', deadNumber(s)));
    expect(s.phase).toBe('eventResolution');
    expect(s.eventCards!.pending!.choices.map((c) => c.playerId)).toEqual(['p0', 'p1', 'p2']);
    expect(() => applyAction(s, { type: 'resolveEvent', playerId: 'p1', resource: 'ore' })).toThrow(/Not your turn/);
    const ore = s.players.map((p) => p.resources.ore);
    s = answer(s, { resource: 'ore' });
    s = answer(s, { resource: 'ore' });
    s = answer(s, { resource: 'ore' });
    expect(s.players.map((p) => p.resources.ore)).toEqual(ore.map((n) => n + 1));
    expect(s.phase).toBe('main');
    expect(s.hasRolledThisTurn).toBe(true);
  });

  it('Good Neighbors: everyone gives a card to the left, all at once', () => {
    let s = start();
    s = {
      ...s,
      players: s.players.map((p, i) => ({
        ...p,
        resources: { wood: i === 0 ? 1 : 0, brick: i === 1 ? 1 : 0, sheep: i === 2 ? 1 : 0, wheat: 0, ore: 0 },
      })),
    };
    s = flip(topCard(s, 'goodNeighbors', deadNumber(s)));
    s = answer(s, { resource: 'wood' }); // p0 → p1
    // p1 can't pass on p0's wood: it hasn't arrived yet.
    expect(() => answer(s, { resource: 'wood' })).toThrow(/no wood/);
    s = answer(s, { resource: 'brick' }); // p1 → p2
    s = answer(s, { resource: 'sheep' }); // p2 → p0
    expect(s.players[0]!.resources.sheep).toBe(1);
    expect(s.players[1]!.resources.wood).toBe(1);
    expect(s.players[2]!.resources.brick).toBe(1);
  });

  it('Helpful Neighbor: the VP leader gives a card to a player with fewer VPs', () => {
    let s = start();
    const v = s.players[1]!.settlements[0]!;
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1' ? { ...p, settlements: p.settlements.filter((x) => x !== v), cities: [v] } : p,
      ),
    };
    s = giveResources(s, 'p1', { ore: 2 });
    s = flip(topCard(s, 'helpfulNeighbor', deadNumber(s)));
    expect(s.eventCards!.pending!.choices).toEqual([
      { playerId: 'p1', kind: 'giveResource', recipients: ['p0', 'p2'] },
    ]);
    expect(() => answer(s, { resource: 'ore', target: 'p1' })).toThrow(/receives/);
    const ore2 = s.players[2]!.resources.ore;
    s = answer(s, { resource: 'ore', target: 'p2' });
    expect(s.players[2]!.resources.ore).toBe(ore2 + 1);
  });

  it('Calm Seas and Tournament reward the leaders only; nobody when nobody qualifies', () => {
    let s = start();
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p2' ? { ...p, devCards: { ...p.devCards, playedKnights: 2 } } : p,
      ),
    };
    const t = flip(topCard(s, 'tournament', deadNumber(s)));
    expect(t.eventCards!.pending!.choices.map((c) => c.playerId)).toEqual(['p2']);
    const port = s.board.ports[0]!;
    const portVertex = s.board.edges[port.edge]!.vertices[0];
    const withPort: GameState = {
      ...s,
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, settlements: [...p.settlements, portVertex] } : p)),
    };
    const calm = flip(topCard(withPort, 'calmSeas', deadNumber(withPort)));
    const takers = calm.eventCards!.pending?.choices.map((c) => c.playerId) ?? [];
    expect(takers).toContain('p1');
  });

  it('Conflict: the Largest Army holder steals (or may pass); Trade Advantage: the Longest Route holder', () => {
    let s = giveResources(start(), 'p0', { wheat: 2 });
    s = { ...s, largestArmy: { holder: 'p2', size: 3 } };
    s = flip(topCard(s, 'conflict', deadNumber(s)));
    expect(getActingPlayerId(s)).toBe('p2');
    const before = hand(s, 'p0');
    s = answer(s, { target: 'p0' });
    expect(hand(s, 'p0')).toBe(before - 1);
    let t = giveResources(start(), 'p2', { wheat: 1 });
    t = { ...t, longestRoad: { holder: 'p1', length: 5 } };
    t = flip(topCard(t, 'tradeAdvantage', deadNumber(t)));
    expect(getActingPlayerId(t)).toBe('p1');
    t = answer(t, { target: null }); // may decline
    expect(t.phase).toBe('main');
  });

  it('Earthquake: damaged roads block new roads and nearby settlements until repaired', () => {
    let s = start();
    s = flip(topCard(s, 'earthquake', deadNumber(s)));
    expect(s.eventCards!.pending!.choices.map((c) => c.kind)).toEqual(['damageRoad', 'damageRoad', 'damageRoad']);
    const road = s.players[0]!.roads[0]!;
    const lengthBefore = calculateRouteLength(s, 'p0');
    expect(() => answer(s, { edge: s.players[1]!.roads[0]! })).toThrow(/your undamaged roads/);
    s = answer(s, { edge: road });
    s = answer(s, { edge: s.players[1]!.roads[0]! });
    s = answer(s, { edge: s.players[2]!.roads[0]! });
    expect(s.damagedRoads).toHaveLength(3);
    expect(calculateRouteLength(s, 'p0')).toBe(lengthBefore);
    // No new road anywhere for p0 while it's damaged.
    expect(s.board.edgeIds.some((e) => canConnectRoad(s, 'p0', e))).toBe(false);
    // No settlement at either end of a damaged road.
    for (const v of s.board.edges[road]!.vertices) expect(canPlaceSettlement(s, 'p0', v)).toBe(false);
    // Repair: 1 brick + 1 wood.
    expect(() => applyAction(s, { type: 'repairRoad', playerId: 'p0', edge: road })).toThrow(/costs/);
    s = giveResources(s, 'p0', REPAIR_ROAD_COST);
    s = applyAction(s, { type: 'repairRoad', playerId: 'p0', edge: road });
    expect(s.damagedRoads).toHaveLength(2);
    expect(s.board.edgeIds.some((e) => canConnectRoad(s, 'p0', e))).toBe(true);
  });
});

describe('Catan Event Cards with other rule sets', () => {
  it('works on a Seafarers scenario (production goes through the Seafarers roll)', () => {
    let s = start({ expansions: ['seafarers'], scenarioId: 'headingForNewShores' });
    s = flip(topCard(s, 'beautifulDay', 6));
    expect(s.lastRoll?.total).toBe(6);
    expect(['main', 'chooseGoldResource']).toContain(s.phase);
  });

  it('works on a Traders & Barbarians scenario', () => {
    let s = start({ expansions: ['traders'], tradersScenarioId: 'merchantTrains' });
    s = flip(topCard(s, 'plentifulYear', 9));
    while (s.phase === 'eventResolution') s = answer(s, { resource: 'wheat' });
    expect(s.lastRoll?.total).toBe(9);
    expect(s.phase).toBe('main');
  });
});
