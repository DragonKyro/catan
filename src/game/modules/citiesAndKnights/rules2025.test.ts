import { describe, expect, it } from 'vitest';
import type { GameState, HexId, PlayerId, VertexId } from '../../types';
import { applyAction } from '../../engine';
import { getActingPlayerId, updatePlayer } from '../../helpers';
import { calculateVictoryPoints } from '../../scoring/points';
import { findValidRoadFromVertex, findValidSettlementSpot } from '../../__testHelpers';
import { BARBARIAN_TRACK_LENGTH } from './constants';
import { drawsProgressCard } from './progress/draw';
import {
  activeMain,
  ckAfterSetup,
  ckGame,
  giveProgressCard,
  putKnight,
  roll,
  setImprovements,

} from './testSupport';

// Rule-by-rule checks against the 2025 Cities & Knights rulebook.

function hexOf(state: GameState, terrain: string): HexId {
  return state.board.hexIds.find(
    (h) => state.board.hexes[h]!.terrain === terrain && state.board.hexes[h]!.numberToken != null,
  )!;
}

// Clear every building, then give `pid` a lone city on `vertex`.
function soloCity(state: GameState, pid: PlayerId, vertex: VertexId): GameState {
  let s: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, settlements: [], cities: [], roads: [] })),
  };
  s = updatePlayer(s, pid, (p) => ({ ...p, cities: [vertex] }));
  return s;
}

function emptyHands(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      commodities: { paper: 0, cloth: 0, coin: 0 },
    })),
  };
}

describe('C&K setup (p.4-5)', () => {
  it('needs 13 VP and starts the robber off the board, parked on the desert', () => {
    const s = ckGame();
    expect(s.settings.victoryPointsToWin).toBe(13);
    expect(s.robberActive).toBe(false);
    expect(s.board.hexes[s.board.robberHex]!.terrain).toBe('desert');
    expect(s.barbarian).toEqual({ position: 0, attacksResolved: 0 });
  });

  it('round 2 places a city that collects 1 resource per adjacent hex', () => {
    let s = ckGame();
    // Round 1: settlement + road for each of the 3 players.
    for (let i = 0; i < 3; i++) {
      const pid = s.playerOrder[s.currentPlayerIndex]!;
      const v = findValidSettlementSpot(s);
      s = applyAction(s, { type: 'placeInitialSettlement', playerId: pid, vertex: v });
      s = applyAction(s, { type: 'placeInitialRoad', playerId: pid, edge: findValidRoadFromVertex(s, v) });
    }
    expect(s.phase).toBe('setupRound2');
    const pid = s.playerOrder[s.currentPlayerIndex]!;
    const v = findValidSettlementSpot(s);
    const before = s.players.find((p) => p.id === pid)!;
    expect(before.cities).toHaveLength(0);
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: pid, vertex: v });
    const after = s.players.find((p) => p.id === pid)!;
    expect(after.cities).toEqual([v]);
    expect(after.settlements).not.toContain(v);
    const producing = s.board.vertices[v]!.hexes.filter((h) =>
      ['wood', 'brick', 'sheep', 'wheat', 'ore'].includes(s.board.hexes[h]!.terrain),
    ).length;
    const total = Object.values(after.resources).reduce((a, b) => a + b, 0);
    expect(total).toBe(producing);
    expect(after.commodities).toEqual({ paper: 0, cloth: 0, coin: 0 });
  });
});

describe('C&K roll dice phase (p.6)', () => {
  it('a ship face moves the barbarians one space; the last space attacks and resets', () => {
    let s = ckAfterSetup();
    s = roll(s, [5, 6], 'barbarian');
    expect(s.barbarian!.position).toBe(1);
    s = { ...s, phase: 'rollOrPlayKnight', hasRolledThisTurn: false };
    s = { ...s, barbarian: { position: BARBARIAN_TRACK_LENGTH - 1, attacksResolved: 0 } };
    s = roll(s, [5, 6], 'barbarian');
    expect(s.barbarian).toEqual({ position: 0, attacksResolved: 1 });
  });

  it('progress cards draw on red <= level + 1 (level 1 = 1-2 … level 5 = 1-6); level 0 never', () => {
    expect(drawsProgressCard(0, 1)).toBe(false);
    expect(drawsProgressCard(1, 1)).toBe(true);
    expect(drawsProgressCard(1, 2)).toBe(true);
    expect(drawsProgressCard(1, 3)).toBe(false);
    expect(drawsProgressCard(2, 3)).toBe(true);
    expect(drawsProgressCard(4, 5)).toBe(true);
    expect(drawsProgressCard(4, 6)).toBe(false);
    expect(drawsProgressCard(5, 6)).toBe(true);
  });

  it('draws the top card of the matching deck for every qualifying player', () => {
    let s = ckAfterSetup();
    s = setImprovements(s, 'p1', { trade: 1 });
    s = setImprovements(s, 'p2', { trade: 2 });
    const top = s.progressDecks!.trade.slice(0, 2);
    s = roll(s, [2, 6], 'trade'); // red 2: level 1 and 2 both draw
    const got = [
      ...(s.players[1]!.progressCards!.trade),
      ...(s.players[1]!.progressVpCards ?? []),
      ...(s.players[2]!.progressCards!.trade),
      ...(s.players[2]!.progressVpCards ?? []),
    ];
    expect(got.sort()).toEqual([...top].sort());
    expect(s.progressDecks!.trade).toHaveLength(16);
  });

  it('cards are drawn in turn order from the active player', () => {
    let s = ckAfterSetup();
    s = { ...s, currentPlayerIndex: 1, turnHolderIndex: 1 };
    for (const p of ['p0', 'p1', 'p2']) s = setImprovements(s, p, { science: 1 });
    // A deck with distinct cards so the order is visible.
    s = { ...s, progressDecks: { ...s.progressDecks!, science: ['crane', 'mining', 'smithing', 'alchemy'] } };
    s = roll(s, [1, 6], 'science');
    expect(s.players[1]!.progressCards!.science).toEqual(['crane']);
    expect(s.players[2]!.progressCards!.science).toEqual(['mining']);
    expect(s.players[0]!.progressCards!.science).toEqual(['smithing']);
  });

  it('VP cards go face up at once, outside the hand, worth 1 VP', () => {
    let s = ckAfterSetup();
    s = setImprovements(s, 'p1', { science: 1 });
    s = { ...s, progressDecks: { ...s.progressDecks!, science: ['printing', 'crane'] } };
    const vpBefore = calculateVictoryPoints(s, 'p1', false);
    s = roll(s, [1, 6], 'science');
    expect(s.players[1]!.progressVpCards).toEqual(['printing']);
    expect(s.players[1]!.progressCards!.science).toEqual([]);
    expect(calculateVictoryPoints(s, 'p1', false)).toBe(vpBefore + 1);
  });

  it('a non-active player over 4 cards discards at once; the active player by end of turn', () => {
    let s = ckAfterSetup();
    for (const card of ['crane', 'mining', 'smithing', 'medicine'] as const) {
      s = giveProgressCard(s, 'p0', 'science', card);
      s = giveProgressCard(s, 'p1', 'science', card);
    }
    s = setImprovements(s, 'p0', { science: 1 });
    s = setImprovements(s, 'p1', { science: 1 });
    s = { ...s, progressDecks: { ...s.progressDecks!, science: ['alchemy', 'invention', 'irrigation'] } };
    s = roll(s, [1, 6], 'science');
    // p1 (not active) must discard 1 now; p0 may keep 5 for the moment.
    expect(s.phase).toBe('progressCardDiscard');
    expect(s.progressCardDiscardRequired).toEqual({ p1: 1 });
    expect(getActingPlayerId(s)).toBe('p1');
    s = applyAction(s, { type: 'discardProgressCard', playerId: 'p1', card: 'crane', deck: 'science' });
    expect(s.phase).toBe('main');
    expect(s.progressDecks!.science.at(-1)).toBe('crane'); // under its deck
    // p0 ends the turn with 5 → discards first, then the turn passes.
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('progressCardDiscard');
    expect(getActingPlayerId(s)).toBe('p0');
    s = applyAction(s, { type: 'discardProgressCard', playerId: 'p0', card: 'mining', deck: 'science' });
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.playerOrder[s.currentPlayerIndex]).toBe('p1');
  });

  it('Alchemy only before the roll, and sets the production dice', () => {
    let s = ckAfterSetup();
    s = giveProgressCard(s, 'p0', 'science', 'alchemy');
    s = applyAction(s, { type: 'playProgressCard', playerId: 'p0', card: 'alchemy', dice: [4, 4] });
    s = roll(s, [1, 1], 'science');
    expect(s.lastRoll!.dice).toEqual([4, 4]);
    s = giveProgressCard(s, 'p0', 'science', 'alchemy');
    expect(() =>
      applyAction(s, { type: 'playProgressCard', playerId: 'p0', card: 'alchemy', dice: [3, 3] }),
    ).toThrow(/before you roll/);
  });
});

describe('C&K production (p.7)', () => {
  it.each([
    ['wood', { wood: 1 }, { paper: 1 }],
    ['sheep', { sheep: 1 }, { cloth: 1 }],
    ['ore', { ore: 1 }, { coin: 1 }],
    ['wheat', { wheat: 2 }, {}],
    ['brick', { brick: 2 }, {}],
  ] as const)('a city on %s collects %o + %o', (terrain, res, com) => {
    let s = emptyHands(ckAfterSetup());
    const hex = hexOf(s, terrain);
    const token = s.board.hexes[hex]!.numberToken!;
    // A corner of this hex whose other hexes don't share its number.
    const v = s.board.hexes[hex]!.corners.find((c) =>
      s.board.vertices[c]!.hexes.every(
        (h) => h === hex || s.board.hexes[h]!.numberToken !== token,
      ),
    )!;
    expect(v).toBeDefined();
    s = soloCity(s, 'p1', v);
    const d1 = Math.max(1, token - 6);
    s = roll(s, [d1, token - d1], 'trade');
    const p = s.players[1]!;
    expect(p.resources).toMatchObject({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, ...res });
    expect(p.commodities).toEqual({ paper: 0, cloth: 0, coin: 0, ...com });
  });

  it('the parked robber does not block production before the first attack', () => {
    let s = emptyHands(ckAfterSetup());
    const hex = hexOf(s, 'wheat');
    const v = s.board.hexes[hex]!.corners[0]!;
    s = soloCity(s, 'p1', v);
    s = { ...s, board: { ...s.board, robberHex: hex } };
    const token = s.board.hexes[hex]!.numberToken!;
    const d1 = Math.max(1, token - 6);
    s = roll(s, [d1, token - d1], 'trade');
    expect(s.players[1]!.resources.wheat).toBeGreaterThanOrEqual(2);
  });

  it('a 7 before the first attack: discards only, no robber, no steal', () => {
    let s = ckAfterSetup();
    s = updatePlayer(s, 'p1', (p) => ({
      ...p,
      resources: { wood: 3, brick: 3, sheep: 0, wheat: 0, ore: 0 },
      commodities: { paper: 2, cloth: 0, coin: 0 },
    }));
    s = roll(s, [3, 4], 'trade');
    expect(s.phase).toBe('discard');
    expect(s.discardState!.required).toEqual({ p1: 4 }); // 8 cards incl. commodities
    s = applyAction(s, {
      type: 'discardCK',
      playerId: 'p1',
      resources: { wood: 2 },
      commodities: { paper: 2 },
    });
    expect(s.phase).toBe('main');
    expect(s.pendingRobberMove).toBeUndefined();
  });

  it('each city wall lets you hold 2 more cards on a 7', () => {
    let s = ckAfterSetup();
    const p1 = s.players[1]!;
    s = updatePlayer(s, 'p1', (p) => ({
      ...p,
      cityWalls: 2,
      resources: { wood: 4, brick: 4, sheep: 3, wheat: 0, ore: 0 },
    }));
    void p1;
    s = roll(s, [3, 4], 'trade');
    expect(s.discardState?.required.p1).toBeUndefined(); // 11 <= 7 + 4
  });
});

describe('C&K barbarians (p.11)', () => {
  function attackReady(s: GameState): GameState {
    return { ...s, barbarian: { position: BARBARIAN_TRACK_LENGTH - 1, attacksResolved: 0 } };
  }

  it('strength counts cities (metropolis cities once); defense = active knights', async () => {
    const { barbarianStrength } = await import('./barbarian');
    let s = ckAfterSetup();
    const cities = s.players.reduce((n, p) => n + p.cities.length, 0);
    const v = s.players[0]!.cities[0]!;
    s = { ...s, metropolises: { science: { playerId: 'p0', vertex: v, permanent: false }, trade: null, politics: null } };
    expect(barbarianStrength(s)).toBe(cities);
  });

  it('first attack places the robber on the desert and makes it active', () => {
    let s = attackReady(ckAfterSetup());
    const hex = hexOf(s, 'wood');
    s = { ...s, board: { ...s.board, robberHex: hex } };
    s = roll(s, [5, 6], 'barbarian');
    expect(s.robberActive).toBe(true);
    expect(s.board.hexes[s.board.robberHex]!.terrain).toBe('desert');
  });

  it('a first attack on a 7 lets the roller move the robber (event die resolves first)', () => {
    let s = attackReady(emptyHands(ckAfterSetup()));
    s = roll(s, [3, 4], 'barbarian');
    expect(s.robberActive).toBe(true);
    expect(s.phase).toBe('moveRobber');
  });

  it('defenders win on a tie of strengths; the unique top defender gets a VP token', () => {
    let s = attackReady(ckAfterSetup()); // 3 cities on the board
    const spots = s.board.vertexIds.filter(
      (v) => !s.players.some((p) => p.settlements.includes(v) || p.cities.includes(v)),
    );
    s = putKnight(s, 'p0', spots[0]!, 2, true);
    s = putKnight(s, 'p1', spots[5]!, 1, true);
    s = roll(s, [5, 6], 'barbarian');
    expect(s.players[0]!.defenderTokens).toBe(1);
    expect(s.players[1]!.defenderTokens).toBe(0);
    expect(Object.values(s.knights!).every((k) => !k.active)).toBe(true);
    expect(s.lastBarbarianAttack).toMatchObject({ outcome: 'defended', defender: 'p0' });
  });

  it('tied top defenders each draw a progress card of their choice, from the active player', () => {
    let s = attackReady(ckAfterSetup());
    s = { ...s, currentPlayerIndex: 2, turnHolderIndex: 2 };
    const spots = s.board.vertexIds.filter(
      (v) => !s.players.some((p) => p.settlements.includes(v) || p.cities.includes(v)),
    );
    s = putKnight(s, 'p0', spots[0]!, 2, true);
    s = putKnight(s, 'p2', spots[5]!, 2, true);
    s = roll(s, [5, 6], 'barbarian');
    expect(s.phase).toBe('defenderTieDraw');
    expect(s.pendingDefenderTieDraw).toEqual(['p2', 'p0']);
    expect(getActingPlayerId(s)).toBe('p2');
    const politicsTop = s.progressDecks!.politics[0]!;
    s = applyAction(s, { type: 'defenderTieDraw', playerId: 'p2', deck: 'politics' });
    expect(getActingPlayerId(s)).toBe('p0');
    s = applyAction(s, { type: 'defenderTieDraw', playerId: 'p0', deck: 'trade' });
    expect(s.phase).toBe('main');
    const p2Cards = [...s.players[2]!.progressCards!.politics, ...(s.players[2]!.progressVpCards ?? [])];
    expect(p2Cards).toContain(politicsTop);
    expect(s.players.every((p) => (p.defenderTokens ?? 0) === 0)).toBe(true);
  });

  it('barbarians win: the lowest contributors lose a city; zero knights counts as lowest', () => {
    let s = attackReady(ckAfterSetup());
    const spots = s.board.vertexIds.filter(
      (v) => !s.players.some((p) => p.settlements.includes(v) || p.cities.includes(v)),
    );
    s = putKnight(s, 'p0', spots[0]!, 1, true); // 1 < 3 cities
    s = roll(s, [5, 6], 'barbarian');
    expect(s.players[0]!.cities).toHaveLength(1);
    expect(s.players[1]!.cities).toHaveLength(0);
    expect(s.players[2]!.cities).toHaveLength(0);
    expect(s.lastBarbarianAttack).toMatchObject({ outcome: 'pillaged', losers: ['p1', 'p2'] });
  });

  it('if the lowest can only lose a metropolis, the next-lowest is pillaged', () => {
    let s = attackReady(ckAfterSetup());
    const spots = s.board.vertexIds.filter(
      (v) => !s.players.some((p) => p.settlements.includes(v) || p.cities.includes(v)),
    );
    // p1 and p2: 0 knights, but their only cities hold metropolises.
    s = {
      ...s,
      metropolises: {
        science: { playerId: 'p1', vertex: s.players[1]!.cities[0]!, permanent: false },
        trade: { playerId: 'p2', vertex: s.players[2]!.cities[0]!, permanent: false },
        politics: null,
      },
    };
    s = putKnight(s, 'p0', spots[0]!, 1, true);
    s = roll(s, [5, 6], 'barbarian');
    expect(s.players[0]!.cities).toHaveLength(0);
    expect(s.players[1]!.cities).toHaveLength(1);
    expect(s.players[2]!.cities).toHaveLength(1);
  });

  it('a loser with 2+ cities picks the one to pillage; it then produces as a settlement', () => {
    let s = attackReady(emptyHands(ckAfterSetup()));
    // Give p1 a second city on a wheat hex.
    const hex = hexOf(s, 'wheat');
    const free = s.board.hexes[hex]!.corners.find(
      (v) =>
        !s.players.some((p) => p.settlements.includes(v) || p.cities.includes(v)) &&
        !s.board.vertices[v]!.neighborVertices.some((n) =>
          s.players.some((p) => p.settlements.includes(n) || p.cities.includes(n)),
        ),
    )!;
    s = updatePlayer(s, 'p1', (p) => ({ ...p, cities: [...p.cities, free] }));
    // Walls: the wheat city has one, which must come off.
    s = {
      ...updatePlayer(s, 'p1', (p) => ({ ...p, cityWalls: 1 })),
      cityWalls: { [free]: 'p1' },
    };
    const token = s.board.hexes[hex]!.numberToken!;
    const d1 = Math.max(1, token - 6);
    s = roll(s, [d1, token - d1], 'barbarian');
    expect(s.phase).toBe('choosePillage');
    expect(getActingPlayerId(s)).toBe('p1');
    s = applyAction(s, { type: 'choosePillagedCity', playerId: 'p1', vertex: free });
    // p0 + p2 have one city each and lost it at once.
    expect(s.players[1]!.settlements).toContain(free);
    expect(s.players[1]!.cityWalls).toBe(0);
    expect(s.cityWalls?.[free]).toBeUndefined();
    // Production ran after the pillage: the reduced city yields 1 wheat.
    expect(s.phase).toBe('main');
    expect(s.players[1]!.resources.wheat).toBeGreaterThanOrEqual(1);
    expect(s.players[1]!.resources.wheat).toBeLessThan(3);
  });
});

describe('C&K winning (p.10)', () => {
  it('13 VP on your own turn wins; reaching it on another turn waits for that turn', () => {
    let s = ckAfterSetup();
    s = activeMain(s, 'p0');
    // p1 is handed 13 VP worth of tokens while p0 acts: nothing happens yet.
    s = updatePlayer(s, 'p1', (p) => ({ ...p, defenderTokens: 11 }));
    s = updatePlayer(s, 'p0', (p) => ({ ...p, resources: { ...p.resources, wood: 4 } }));
    s = applyAction(s, { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'ore' });
    expect(s.phase).toBe('main');
    // As soon as p1's turn starts they have 13 VP during their turn.
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe('p1');
  });
});
