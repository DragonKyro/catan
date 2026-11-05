import { describe, expect, it } from 'vitest';
import type { GameState, ImprovementTrack, PlayerId, ProgressCardKind, VertexId } from '../../types';
import { applyAction } from '../../engine';
import { getActingPlayerId, updatePlayer } from '../../helpers';
import { calculateVictoryPoints } from '../../scoring/points';
import { progressCardDeck } from './progress/catalogue';
import { isOpenRoad, openRoads } from './progress/diplomacy';
import { knightCanAct } from './knights/legal';
import { progressCardBlocker } from './actions/playProgressCard';
import { activeMain, ckAfterSetup, putKnight, setCommodities } from './testSupport';

const EMPTY = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };

function main(): GameState {
  const s = ckAfterSetup();
  return activeMain(
    {
      ...s,
      players: s.players.map((p) => ({
        ...p,
        resources: { ...EMPTY },
        commodities: { paper: 0, cloth: 0, coin: 0 },
      })),
    },
    'p0',
  );
}

function withCard(s: GameState, pid: PlayerId, card: ProgressCardKind): GameState {
  const track: ImprovementTrack = progressCardDeck(card);
  return updatePlayer(s, pid, (p) => {
    const h = p.progressCards ?? { science: [], trade: [], politics: [] };
    return { ...p, progressCards: { ...h, [track]: [...h[track], card] } };
  });
}

function play(s: GameState, card: ProgressCardKind, extra: Record<string, unknown> = {}): GameState {
  const pid = s.playerOrder[s.currentPlayerIndex]!;
  return applyAction(withCard(s, pid, card), {
    type: 'playProgressCard',
    playerId: pid,
    card,
    ...extra,
  } as never);
}

function res(s: GameState, pid: PlayerId, r: Partial<typeof EMPTY>): GameState {
  return updatePlayer(s, pid, (p) => ({ ...p, resources: { ...EMPTY, ...r } }));
}

// p1 ends up with more VP than p0 (extra VP tokens).
function p1Leads(s: GameState, by = 2): GameState {
  return updatePlayer(s, 'p1', (p) => ({ ...p, defenderTokens: (p.defenderTokens ?? 0) + by }));
}

describe('C&K progress cards — science (p.13-14)', () => {
  it('a played card goes face down under its deck', () => {
    let s = main();
    const before = s.progressDecks!.politics.length;
    s = play(s, 'encouragement');
    expect(s.progressDecks!.politics).toHaveLength(before + 1);
    expect(s.progressDecks!.politics.at(-1)).toBe('encouragement');
  });

  it('Engineering builds a city wall at no cost', () => {
    let s = main();
    const city = s.players[0]!.cities[0]!;
    s = play(s, 'engineering', { vertex: city });
    expect(s.cityWalls![city]).toBe('p0');
    expect(s.players[0]!.cityWalls).toBe(1);
  });

  it('Medicine upgrades a settlement for 1 wheat + 2 ore', () => {
    let s = res(main(), 'p0', { wheat: 1, ore: 2 });
    const v = s.players[0]!.settlements[0]!;
    s = play(s, 'medicine', { vertex: v });
    expect(s.players[0]!.cities).toContain(v);
    expect(s.players[0]!.resources).toEqual(EMPTY);
  });

  it('Invention swaps two discs but never 2, 6, 8 or 12; the robber stays', () => {
    let s = main();
    const hexes = s.board.hexIds.filter((h) => s.board.hexes[h]!.numberToken != null);
    const ok = hexes.filter((h) => ![2, 6, 8, 12].includes(s.board.hexes[h]!.numberToken!));
    const six = hexes.find((h) => s.board.hexes[h]!.numberToken === 6)!;
    const [a, b] = [ok[0]!, ok[1]!];
    const [ta, tb] = [s.board.hexes[a]!.numberToken, s.board.hexes[b]!.numberToken];
    expect(() => play(s, 'invention', { fromHex: a, toHex: six })).toThrow(/2, 6, 8 and 12/);
    const robber = s.board.robberHex;
    s = play(s, 'invention', { fromHex: a, toHex: b });
    expect(s.board.hexes[a]!.numberToken).toBe(tb);
    expect(s.board.hexes[b]!.numberToken).toBe(ta);
    expect(s.board.robberHex).toBe(robber);
  });

  it('Irrigation / Mining: 2 per adjacent fields / mountains hex, capped by the supply', () => {
    let s = main();
    const p0 = s.players[0]!;
    const fields = new Set<string>();
    for (const v of [...p0.settlements, ...p0.cities]) {
      for (const h of s.board.vertices[v]!.hexes) if (s.board.hexes[h]!.terrain === 'wheat') fields.add(h);
    }
    s = play(s, 'irrigation');
    expect(s.players[0]!.resources.wheat).toBe(2 * fields.size);
    // Supply cap.
    let t = { ...main(), bank: { ...main().bank, ore: 1 } };
    const mountains = new Set<string>();
    for (const v of [...p0.settlements, ...p0.cities]) {
      for (const h of t.board.vertices[v]!.hexes) if (t.board.hexes[h]!.terrain === 'ore') mountains.add(h);
    }
    t = play(t, 'mining');
    expect(t.players[0]!.resources.ore).toBe(Math.min(1, 2 * mountains.size));
  });

  it('Road Building: 2 free roads that follow the placement rules', () => {
    let s = main();
    const p0 = s.players[0]!;
    const v = p0.cities[0]!;
    const free = s.board.vertices[v]!.edges.filter((e) => !s.players.some((p) => p.roads.includes(e)));
    s = play(s, 'progressRoadBuilding', { edges: [free[0]] });
    expect(s.players[0]!.roads).toContain(free[0]);
    const far = s.board.edgeIds.find((e) => {
      const [a, b] = s.board.edges[e]!.vertices;
      return [a, b].every(
        (x) => !s.board.vertices[x]!.edges.some((y) => s.players[0]!.roads.includes(y)) &&
          !s.players[0]!.settlements.includes(x) && !s.players[0]!.cities.includes(x),
      );
    })!;
    expect(() => play(s, 'progressRoadBuilding', { edges: [far] })).toThrow(/Invalid road/);
  });

  it('Smithing promotes up to 2 different knights for free, each once per turn', () => {
    let s = main();
    const spots = s.board.vertexIds.filter((v) => !s.players.some((p) => p.cities.includes(v) || p.settlements.includes(v)));
    s = putKnight(s, 'p0', spots[0]!, 1);
    s = putKnight(s, 'p0', spots[1]!, 1);
    s = play(s, 'smithing', { knightVertices: [spots[0], spots[1]] });
    expect(s.knights![spots[0]!]!.strength).toBe(2);
    expect(s.knights![spots[1]!]!.strength).toBe(2);
    expect(() => play(s, 'smithing', { knightVertices: [spots[0]] })).toThrow(/already promoted/);
  });
});

describe('C&K progress cards — trade (p.14-15)', () => {
  it('Commercial Harbor: one offer per player; they choose the commodity; none → resource stays', () => {
    let s = res(main(), 'p0', { wood: 2 });
    s = setCommodities(s, 'p1', { coin: 1, cloth: 1 });
    s = play(s, 'commercialHarborCard');
    s = applyAction(s, { type: 'commercialHarborPropose', playerId: 'p0', targetId: 'p1', resource: 'wood' });
    expect(s.phase).toBe('commercialHarborOffer');
    expect(getActingPlayerId(s)).toBe('p1');
    expect(() => applyAction(s, { type: 'commercialHarborOffer', playerId: 'p1', commodity: null })).toThrow();
    s = applyAction(s, { type: 'commercialHarborOffer', playerId: 'p1', commodity: 'cloth' });
    expect(s.players[0]!.commodities!.cloth).toBe(1);
    expect(s.players[1]!.resources.wood).toBe(1);
    expect(() =>
      applyAction(s, { type: 'commercialHarborPropose', playerId: 'p0', targetId: 'p1', resource: 'wood' }),
    ).toThrow(/already/);
    // p2 has no commodities: the wood stays with p0.
    s = applyAction(s, { type: 'commercialHarborPropose', playerId: 'p0', targetId: 'p2', resource: 'wood' });
    expect(s.phase).toBe('main');
    expect(s.players[0]!.resources.wood).toBe(1);
  });

  it('Guild Dues: only against a player with more VPs; take 2 of their cards', () => {
    let s = main();
    expect(progressCardBlocker(withCard(s, 'p0', 'guildDues'), 'p0', 'guildDues')).toMatch(/more VPs/);
    s = p1Leads(s);
    s = res(s, 'p1', { ore: 1 });
    s = setCommodities(s, 'p1', { coin: 2 });
    s = play(s, 'guildDues', { targetId: 'p1' });
    expect(s.phase).toBe('chooseProgressCardPick');
    s = applyAction(s, {
      type: 'chooseProgressCardPick',
      playerId: 'p0',
      resources: { ore: 1 },
      commodities: { coin: 1 },
    });
    expect(s.players[0]!.resources.ore).toBe(1);
    expect(s.players[0]!.commodities!.coin).toBe(1);
  });

  it('Resource Monopoly takes up to 2 from each; Trade Monopoly 1 commodity each', () => {
    let s = res(main(), 'p1', { wheat: 3 });
    s = res(s, 'p2', { wheat: 1 });
    s = play(s, 'resourceMonopoly', { resource: 'wheat' });
    expect(s.players[0]!.resources.wheat).toBe(3);
    expect(s.players[1]!.resources.wheat).toBe(1);
    s = setCommodities(s, 'p1', { paper: 3 });
    s = setCommodities(s, 'p2', { paper: 1 });
    s = play(s, 'tradeMonopoly', { commodity: 'paper' });
    expect(s.players[0]!.commodities!.paper).toBe(2);
    expect(s.players[1]!.commodities!.paper).toBe(2);
  });
});

describe('C&K progress cards — politics (p.15-16)', () => {
  it('Diplomacy: removes an open road; your own → a free road; none open → no effect', () => {
    let s = main();
    // Every setup road ends at a building on one side and is loose on the other.
    const p1road = s.players[1]!.roads[0]!;
    expect(isOpenRoad(s, p1road)).toBe(true);
    s = play(s, 'diplomacy');
    expect(s.phase).toBe('removeRoad');
    s = applyAction(s, { type: 'removeRoad', playerId: 'p0', edge: p1road });
    expect(s.players[1]!.roads).not.toContain(p1road);
    expect(s.diplomacyFreeRoad).toBe(false);
    // Own road: rebuild one for free (no resources in hand).
    const mine = s.players[0]!.roads[0]!;
    s = play(s, 'diplomacy');
    s = applyAction(s, { type: 'removeRoad', playerId: 'p0', edge: mine });
    expect(s.diplomacyFreeRoad).toBe(true);
    s = applyAction(s, { type: 'buildRoad', playerId: 'p0', edge: mine });
    expect(s.players[0]!.roads).toContain(mine);
    expect(s.diplomacyFreeRoad).toBe(false);
    // A road between two of the owner's pieces is not open.
    let t = main();
    const road = t.players[1]!.roads[0]!;
    const [a, b] = t.board.edges[road]!.vertices;
    const loose = t.players[1]!.settlements.includes(a) || t.players[1]!.cities.includes(a) ? b : a;
    t = putKnight(t, 'p1', loose as VertexId, 1);
    expect(isOpenRoad(t, road)).toBe(false);
    // No open road on the board at all: played, no sub-phase.
    let u = main();
    u = { ...u, players: u.players.map((p) => ({ ...p, roads: [] })) };
    expect(openRoads(u)).toEqual([]);
    u = play(u, 'diplomacy');
    expect(u.phase).toBe('main');
  });

  it('Encouragement activates all your knights, which then cannot act this turn', () => {
    let s = main();
    const spots = s.board.vertexIds.filter((v) => !s.players.some((p) => p.cities.includes(v) || p.settlements.includes(v)));
    s = putKnight(s, 'p0', spots[0]!, 1);
    s = putKnight(s, 'p0', spots[1]!, 2);
    s = play(s, 'encouragement');
    expect(s.knights![spots[0]!]!.active).toBe(true);
    expect(s.knights![spots[1]!]!.active).toBe(true);
    expect(knightCanAct(s, spots[0]!)).toBe(false);
  });

  it('Espionage: may take 1 progress card (or none); VP cards are face up and safe', () => {
    let s = main();
    s = withCard(s, 'p1', 'mining');
    s = updatePlayer(s, 'p1', (p) => ({ ...p, progressVpCards: ['constitution'] }));
    s = play(s, 'espionage', { targetId: 'p1' });
    s = applyAction(s, { type: 'chooseProgressCardPick', playerId: 'p0', deck: 'science', card: 'mining' });
    expect(s.players[0]!.progressCards!.science).toEqual(['mining']);
    expect(s.players[1]!.progressVpCards).toEqual(['constitution']);
    s = play(s, 'espionage', { targetId: 'p1' });
    s = applyAction(s, { type: 'chooseProgressCardPick', playerId: 'p0' });
    expect(s.phase).toBe('main');
  });

  it('Intrigue: only a knight on one of your routes; it moves away or goes to the supply', () => {
    let s = main();
    const myRoad = s.players[0]!.roads[0]!;
    const loose = s.board.edges[myRoad]!.vertices.find(
      (v) => !s.players[0]!.settlements.includes(v) && !s.players[0]!.cities.includes(v),
    )!;
    const elsewhere = s.board.vertexIds.find(
      (v) =>
        !s.board.vertices[v]!.edges.some((e) => s.players[0]!.roads.includes(e)) &&
        !s.players.some((p) => p.cities.includes(v) || p.settlements.includes(v)),
    )!;
    s = putKnight(s, 'p1', elsewhere, 1);
    expect(progressCardBlocker(withCard(s, 'p0', 'intrigue'), 'p0', 'intrigue')).toMatch(/your roads/);
    s = putKnight(s, 'p1', loose, 2, true);
    // p1 has no road there, so the knight has nowhere to go: back to supply.
    s = play(s, 'intrigue', { vertex: loose });
    expect(s.knights![loose]).toBeUndefined();
    expect(s.phase).toBe('main');
    expect(s.knightSupply!.p1[2]).toBe(2);
  });

  it('Sabotage: everyone with >= your VPs discards half (resources + commodities)', () => {
    let s = main();
    s = res(s, 'p1', { wood: 3 });
    s = setCommodities(s, 'p1', { paper: 2 });
    s = res(s, 'p2', { wood: 1 });
    s = play(s, 'sabotage');
    expect(s.phase).toBe('discard');
    expect(s.discardState!.required).toEqual({ p1: 2 }); // p2: half of 1 = 0
    s = applyAction(s, { type: 'discardCK', playerId: 'p1', resources: { wood: 1 }, commodities: { paper: 1 } });
    expect(s.phase).toBe('main');
  });

  it('Taxation: only once the robber is on the board; steals 1 card from each player there', () => {
    let s = main();
    expect(progressCardBlocker(withCard(s, 'p0', 'taxation'), 'p0', 'taxation')).toMatch(/after the first barbarian/);
    s = { ...s, robberActive: true };
    const hex = s.board.vertices[s.players[1]!.cities[0]!]!.hexes.find(
      (h) => s.board.hexes[h]!.terrain !== 'sea' && h !== s.board.robberHex,
    )!;
    s = res(s, 'p1', { brick: 2 });
    s = res(s, 'p2', { sheep: 2 });
    s = updatePlayer(s, 'p2', (p) => ({ ...p, settlements: [...p.settlements, s.board.hexes[hex]!.corners.find((c) => !s.players.some((q) => q.cities.includes(c) || q.settlements.includes(c)))!] }));
    s = play(s, 'taxation');
    s = applyAction(s, { type: 'moveRobber', playerId: 'p0', hex, stealFrom: null });
    expect(s.players[0]!.resources.brick + s.players[0]!.resources.sheep).toBe(2);
    expect(s.phase).toBe('main');
  });

  it('Treason: the target removes a knight; you may place one no stronger, same status', () => {
    let s = main();
    const spots = s.board.vertexIds.filter((v) => !s.players.some((p) => p.cities.includes(v) || p.settlements.includes(v)));
    s = putKnight(s, 'p1', spots[0]!, 2, true);
    s = play(s, 'treason', { targetId: 'p1' });
    expect(getActingPlayerId(s)).toBe('p1');
    s = applyAction(s, { type: 'treasonRemoveKnight', playerId: 'p1', vertex: spots[0]! });
    expect(s.phase).toBe('treasonPlaceKnight');
    expect(getActingPlayerId(s)).toBe('p0');
    const myRoad = s.players[0]!.roads[0]!;
    const spot = s.board.edges[myRoad]!.vertices.find(
      (v) => !s.players.some((p) => p.cities.includes(v) || p.settlements.includes(v)),
    )!;
    expect(() =>
      applyAction(s, { type: 'treasonPlaceKnight', playerId: 'p0', vertex: spot, strength: 3 }),
    ).toThrow();
    s = applyAction(s, { type: 'treasonPlaceKnight', playerId: 'p0', vertex: spot, strength: 2 });
    expect(s.knights![spot]).toMatchObject({ playerId: 'p0', strength: 2, active: true });
    expect(knightCanAct(s, spot)).toBe(false);
    // Declining is allowed.
    s = putKnight(s, 'p1', spots[3]!, 1);
    s = play(s, 'treason', { targetId: 'p1' });
    s = applyAction(s, { type: 'treasonRemoveKnight', playerId: 'p1', vertex: spots[3]! });
    s = applyAction(s, { type: 'treasonPlaceKnight', playerId: 'p0' });
    expect(s.phase).toBe('main');
  });

  it('Wedding: each player with more VPs gives you 2 cards of their choice', () => {
    let s = p1Leads(main());
    s = res(s, 'p1', { ore: 1 });
    s = setCommodities(s, 'p1', { coin: 3 });
    s = play(s, 'wedding');
    expect(s.phase).toBe('weddingGive');
    expect(getActingPlayerId(s)).toBe('p1');
    s = applyAction(s, { type: 'weddingGive', playerId: 'p1', resources: {}, commodities: { coin: 2 } });
    expect(s.players[0]!.commodities!.coin).toBe(2);
    expect(s.phase).toBe('main');
  });

  it('VP comparisons use public VPs (all C&K VPs are public)', () => {
    const s = p1Leads(main(), 1);
    expect(calculateVictoryPoints(s, 'p1', true)).toBe(calculateVictoryPoints(s, 'p1', false));
  });
});
