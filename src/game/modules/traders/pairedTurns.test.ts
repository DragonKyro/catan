import { describe, expect, it } from 'vitest';
import { createGame } from '../../createGame';
import { applyAction } from '../../engine';
import { giveResources, runSetupPhase } from '../../__testHelpers';
import { canPlaceInitialSettlement, canPlaceSettlement } from '../../placement';
import { currentPlayerId, isPairedPlayer2 } from '../../helpers';
import { edgeKey } from '../../board/coords';
import type { EdgeId, GameState, HexId, PlayerId } from '../../types';
import { legalWagonPlacements } from './merchantTrains/trains';
import { lakeHexes } from './fishing/lakes';
import { maybeDistributeFish } from './fishing/production';
import { hexEdgeIds } from './barbarianAttack/state';

// Traders & Barbarians 5-6 (rulebook p. 4): paired turns. Player 1 rolls and
// takes the full turn, scenario End of Turn phase included; then Player 2
// (third seat to Player 1's left) takes an Action phase — supply trades
// only — and its own scenario End of Turn phase. These tests walk each
// scenario through both halves of a paired turn at 5 players (p0 = Player
// 1, p3 = Player 2 with the seat order fixed).

function started(id: string, players = 5): GameState {
  const g = createGame({
    playerNames: Array.from({ length: players }, (_, i) => `P${i}`),
    seed: 2,
    settings: { expansions: ['traders'], tradersScenarioId: id },
    randomizeTurnOrder: false,
  });
  return applyAction(runSetupPhase(g), { type: 'rollDice', playerId: 'p0', dice: [1, 2] });
}

// Give `pid` a road to a free spot and build a settlement there.
function buildSettlement(s: GameState, pid: PlayerId): GameState {
  for (const vid of s.board.vertexIds) {
    if (!canPlaceInitialSettlement(s, vid)) continue;
    const edge = s.board.vertices[vid]!.edges.find(
      (eid) =>
        !s.players.some((p) => p.roads.includes(eid)) &&
        s.board.edges[eid]!.hexes.some((h) => s.board.hexes[h]!.terrain !== 'sea'),
    );
    if (!edge) continue;
    let t: GameState = {
      ...s,
      players: s.players.map((p) => (p.id === pid ? { ...p, roads: [...p.roads, edge] } : p)),
    };
    if (!canPlaceSettlement(t, pid, vid)) continue;
    t = giveResources(t, pid, { wood: 1, brick: 1, sheep: 1, wheat: 1 });
    return applyAction(t, { type: 'buildSettlement', playerId: pid, vertex: vid });
  }
  throw new Error('no settlement spot found');
}

// Everyone passes the bidding; the active player then places the wagon.
function passVoteAndPlace(s: GameState): GameState {
  let t = s;
  while (t.phase === 'wagonVoting' && t.wagonVote?.stage === 'bid') {
    const v = t.wagonVote;
    t = applyAction(t, { type: 'submitWagonVote', playerId: v.order[v.turn]!, cards: {} });
  }
  expect(t.phase).toBe('placeWagon');
  const spot = legalWagonPlacements(t)[0]!;
  return applyAction(t, {
    type: 'placeWagon',
    playerId: t.pendingWagonPlacement!.placerId,
    edge: spot.edge,
    train: spot.train,
  });
}

describe('T&B 5-6 paired turns — Merchant Trains', () => {
  it('Player 1 and then Player 2 each hold a voting round for a building they built', () => {
    let s = started('merchantTrains');
    s = buildSettlement(s, 'p0');
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('wagonVoting');
    expect(s.wagonVote!.acquirerId).toBe('p0');
    expect(s.wagonVote!.order).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    s = passVoteAndPlace(s);
    // Player 1's End of Turn phase is over: Player 2's Action phase.
    expect(s.phase).toBe('main');
    expect(currentPlayerId(s)).toBe('p3');
    expect(isPairedPlayer2(s)).toBe(true);
    expect(s.builtThisTurn).toBe(false);
    expect(s.wagons).toHaveLength(1);

    // "If player 2 builds a building during their Action phase, they hold a
    // voting round as well. For this round, player 2 is considered the
    // active player."
    s = buildSettlement(s, 'p3');
    expect(s.builtThisTurn).toBe(true);
    s = applyAction(s, { type: 'endTurn', playerId: 'p3' });
    expect(s.phase).toBe('wagonVoting');
    expect(s.wagonVote!.acquirerId).toBe('p3');
    expect(s.wagonVote!.order).toEqual(['p3', 'p4', 'p0', 'p1', 'p2']);
    s = passVoteAndPlace(s);
    expect(s.lastWagonVote!.chooser).toBe('p3');
    expect(s.wagons).toHaveLength(2);
    // Both markers move on: p1 is the new Player 1.
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(currentPlayerId(s)).toBe('p1');
    expect(s.turnHolderIndex).toBe(1);
  });

  it('a Player 2 who builds nothing just ends the paired turn', () => {
    let s = started('merchantTrains');
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(currentPlayerId(s)).toBe('p3');
    s = applyAction(s, { type: 'endTurn', playerId: 'p3' });
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(currentPlayerId(s)).toBe('p1');
  });
});

describe('T&B 5-6 paired turns — Barbarian Attack', () => {
  function edgeOf(s: GameState, hex: HexId, i: number): EdgeId {
    return hexEdgeIds(s, hex)[i]!;
  }

  it('Player 2 moves their knights and expels the barbarians at the end of their part', () => {
    let s = started('barbarianAttack');
    const ba = s.barbarianAttack!;
    // p3 has two knights on the coastal 9 at (1,1) (not a castle edge), where
    // one barbarian stands: a victory at p3's expel. p0 has none.
    const k1 = edgeOf(s, '1,1', 0);
    const k2 = edgeOf(s, '1,1', 2);
    s = {
      ...s,
      barbarianAttack: { ...ba, barbarians: { ...ba.barbarians, '1,1': 1 }, knights: { [k1]: 'p3', [k2]: 'p3' } },
    };
    // Player 1 has no knights: endTurn expels straight away (p3 isn't the
    // active player, but their knights still fight) and hands over to p3.
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('main');
    expect(currentPlayerId(s)).toBe('p3');
    expect(s.barbarianAttack!.prisoners.p3).toBe(1);

    // Put a barbarian (and p3's knights, whatever the loss die did) back;
    // p3's own End of Turn: knight moves, then expel.
    s = {
      ...s,
      barbarianAttack: {
        ...s.barbarianAttack!,
        barbarians: { ...s.barbarianAttack!.barbarians, '1,1': 1 },
        knights: { [k1]: 'p3', [k2]: 'p3' },
      },
    };
    s = applyAction(s, { type: 'endTurn', playerId: 'p3' });
    expect(s.phase).toBe('barbarianKnightMoves');
    expect(currentPlayerId(s)).toBe('p3');
    s = applyAction(s, { type: 'endTurn', playerId: 'p3' });
    expect(s.barbarianAttack!.prisoners.p3).toBeGreaterThanOrEqual(2);
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(currentPlayerId(s)).toBe('p1');
  });

  it("Player 2's knight on a castle edge must move before their part ends", () => {
    let s = started('barbarianAttack');
    const castleEdge = edgeOf(s, '2,0', 3);
    s = { ...s, barbarianAttack: { ...s.barbarianAttack!, knights: { [castleEdge]: 'p3' } } };
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    s = applyAction(s, { type: 'endTurn', playerId: 'p3' });
    expect(s.phase).toBe('barbarianKnightMoves');
    expect(() => applyAction(s, { type: 'endTurn', playerId: 'p3' })).toThrow(/castle edge must move/);
  });
});

describe('T&B 5-6 paired turns — coins', () => {
  it('Player 2 spends coins and buys gold from the supply, but may not trade with players', () => {
    let s = started('riversOfCatan');
    s = { ...s, players: s.players.map((p) => ({ ...p, gold: 6 })) };
    s = applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'ore' });
    s = applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'ore' });
    expect(() => applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'ore' })).toThrow();
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(currentPlayerId(s)).toBe('p3');
    // Player 2 has their own two spends.
    s = applyAction(s, { type: 'spendGold', playerId: 'p3', resource: 'wheat' });
    s = applyAction(s, { type: 'spendGold', playerId: 'p3', resource: 'wheat' });
    expect(s.players.find((p) => p.id === 'p3')!.gold).toBe(2);
    // Buying gold is a trade with the supply: allowed.
    s = giveResources(s, 'p3', { wood: 4 });
    s = applyAction(s, { type: 'buyGold', playerId: 'p3', give: 'wood' });
    expect(s.players.find((p) => p.id === 'p3')!.gold).toBe(3);
    // A player trade (even one paying in gold) is not.
    expect(() =>
      applyAction(s, {
        type: 'proposeTrade',
        playerId: 'p3',
        give: {},
        receive: { ore: 1 },
        giveGold: 1,
      }),
    ).toThrow();
  });
});

describe('T&B 5-6 paired turns — Fishing on Catan', () => {
  it('Player 2 spends fish and passes the old boot during their Action phase', () => {
    let s = started('fishingOnCatan');
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(currentPlayerId(s)).toBe('p3');
    const lake = lakeHexes(s)[0]!;
    s = {
      ...s,
      robberActive: true,
      board: { ...s.board, robberHex: lake },
      oldBootHolder: 'p3',
      players: s.players.map((p) => (p.id === 'p3' ? { ...p, fishTokens: ['two'] } : p)),
    };
    s = applyAction(s, { type: 'spendFish', playerId: 'p3', tokens: ['two'], effect: { kind: 'removeRobber' } });
    expect(s.robberActive).toBe(false);
    s = applyAction(s, { type: 'passOldBoot', playerId: 'p3', to: 'p4' });
    expect(s.oldBootHolder).toBe('p4');
  });

  it('both lakes produce fish on their own numbers', () => {
    const s = started('fishingOnCatan');
    const lakes = lakeHexes(s);
    const fourTen = lakes.find((h) => s.board.hexes[h]!.numberToken === 4 || s.board.hexes[h]!.extraNumbers?.includes(4))!;
    const other = lakes.find((h) => h !== fourTen)!;
    const v4 = s.board.hexes[fourTen]!.corners[0]!;
    const v2 = s.board.hexes[other]!.corners[3]!;
    const t: GameState = {
      ...s,
      robberActive: false,
      fishingGrounds: [],
      players: s.players.map((p) =>
        p.id === 'p1' ? { ...p, settlements: [v4], fishTokens: [] } : p.id === 'p2' ? { ...p, settlements: [v2], fishTokens: [] } : { ...p, settlements: [], cities: [], fishTokens: [] },
      ),
    };
    const on4 = maybeDistributeFish(t, 4);
    expect(on4.players.find((p) => p.id === 'p1')!.fishTokens!.length + (on4.oldBootHolder === 'p1' ? 1 : 0)).toBe(1);
    expect(on4.players.find((p) => p.id === 'p2')!.fishTokens).toHaveLength(0);
    const on11 = maybeDistributeFish(t, 11);
    expect(on11.players.find((p) => p.id === 'p1')!.fishTokens).toHaveLength(0);
    expect(on11.players.find((p) => p.id === 'p2')!.fishTokens!.length + (on11.oldBootHolder === 'p2' ? 1 : 0)).toBe(1);
  });
});

describe('T&B 5-6 paired turns — Rivers of Catan', () => {
  it('Player 2 builds a bridge and collects the 3 gold', () => {
    let s = started('riversOfCatan');
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(currentPlayerId(s)).toBe('p3');
    const site = s.riverEdges![0]!;
    const end = s.board.edges[site]!.vertices[0]!;
    // A road of p3's touching the bridge site's end.
    const road = s.board.vertices[end]!.edges.find(
      (e) => e !== site && !s.riverEdges!.includes(e) && !s.players.some((p) => p.roads.includes(e)),
    )!;
    s = {
      ...s,
      players: s.players.map((p) => (p.id === 'p3' ? { ...p, roads: [...p.roads, road], gold: 0 } : p)),
    };
    s = giveResources(s, 'p3', { brick: 2, wood: 1 });
    s = applyAction(s, { type: 'buildBridge', playerId: 'p3', edge: site });
    const p3 = s.players.find((p) => p.id === 'p3')!;
    expect(p3.bridges).toContain(site);
    expect(p3.gold).toBe(3);
    void edgeKey;
  });
});
