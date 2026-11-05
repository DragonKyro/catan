import { describe, expect, it } from 'vitest';
import type {
  Action,
  CommodityBank,
  GameState,
  KnightRecord,
  Player,
  PlayerId,
  ResourceBank,
} from '@/game/types';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { runSetupPhase } from '@/game/__testHelpers';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { recruitSpots } from '@/game/modules/citiesAndKnights/knights/legal';
import { canConnectRoad } from '@/game/placement';
import { chooseAction, shouldAcceptTrade } from '../index';
import { ckVertexBonus } from './value';

// Decision-level tests for the Cities & Knights AI. States are built from a
// real setup, then edited to the situation under test; every action the AI
// returns must also be accepted by the reducer.

const EMPTY_RES: ResourceBank = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
const EMPTY_COM: CommodityBank = { paper: 0, cloth: 0, coin: 0 };

function setupCK(): GameState {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C'],
      playerTypes: ['ai', 'ai', 'ai'],
      seed: 42,
      randomizeTurnOrder: false,
      settings: { expansions: [CITIES_AND_KNIGHTS_EXPANSION_ID] },
    }),
  );
}

// p0's Action phase with empty hands everywhere.
function mainState(): GameState {
  const s = setupCK();
  return {
    ...s,
    phase: 'main',
    hasRolledThisTurn: true,
    players: s.players.map((p) => ({ ...p, resources: { ...EMPTY_RES }, commodities: { ...EMPTY_COM } })),
  };
}

function edit(state: GameState, id: PlayerId, fn: (p: Player) => Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, ...fn(p) } : p)) };
}

function withKnight(state: GameState, vertex: string, k: KnightRecord): GameState {
  const supply = state.knightSupply?.[k.playerId] ?? { 1: 2, 2: 2, 3: 2 };
  return {
    ...state,
    knights: { ...(state.knights ?? {}), [vertex]: k },
    knightSupply: { ...state.knightSupply, [k.playerId]: { ...supply, [k.strength]: supply[k.strength] - 1 } },
  };
}

// The acting seat's choice, checked against the reducer.
function decide(state: GameState): Action {
  const actor = getActingPlayerId(state);
  const action = chooseAction(state, actor);
  expect(action, `no action for ${actor} in ${state.phase}`).not.toBeNull();
  expect(() => applyAction(state, action!)).not.toThrow();
  return action!;
}

describe('C&K AI: barbarians and knights', () => {
  it('stands an inactive knight up when the barbarians are about to land', () => {
    let s = mainState();
    const spot = recruitSpots(s, 'p0')[0]!;
    s = withKnight(s, spot, { playerId: 'p0', strength: 1, active: false });
    s = edit(s, 'p0', () => ({ resources: { ...EMPTY_RES, wheat: 1 } }));
    s = { ...s, barbarian: { position: 6, attacksResolved: 0 } };
    const a = decide(s);
    expect(a).toMatchObject({ type: 'activateKnight', vertex: spot });
  });

  it('recruits a knight instead of a city the barbarians would take', () => {
    let s = mainState();
    s = edit(s, 'p0', () => ({ resources: { ...EMPTY_RES, wheat: 3, ore: 4, sheep: 1 } }));
    s = { ...s, barbarian: { position: 6, attacksResolved: 0 } };
    const a = decide(s);
    expect(a.type).toBe('recruitKnight');
  });

  it('builds the city when the barbarians are far away', () => {
    let s = mainState();
    s = edit(s, 'p0', () => ({ resources: { ...EMPTY_RES, wheat: 2, ore: 3 } }));
    const a = decide(s);
    expect(a.type).toBe('buildCity');
  });

  it('gives up its weakest knight to Treason', () => {
    let s = mainState();
    const [a, b] = recruitSpots(s, 'p1');
    s = withKnight(s, a!, { playerId: 'p1', strength: 2, active: true });
    s = withKnight(s, b!, { playerId: 'p1', strength: 1, active: false });
    s = { ...s, phase: 'treasonRemoveKnight', pendingTreason: { attackerId: 'p0', targetId: 'p1' } };
    const act = decide(s);
    expect(act).toMatchObject({ type: 'treasonRemoveKnight', playerId: 'p1', vertex: b });
  });

  it('moves its displaced knight somewhere legal', () => {
    let s = mainState();
    // Extend one of p1's roads so the knight has somewhere to go.
    const from = recruitSpots(s, 'p1')[0]!;
    const onward = s.board.vertices[from]!.edges.find(
      (e) => !s.players.some((p) => p.roads.includes(e)) && canConnectRoad(s, 'p1', e),
    )!;
    s = edit(s, 'p1', (p) => ({ roads: [...p.roads, onward] }));
    s = {
      ...s,
      phase: 'displacedKnightMove',
      pendingKnightMove: { playerId: 'p1', sourceVertex: from, knightStrength: 1, knightActive: true, returnTo: 'main' },
    };
    const act = decide(s);
    expect(act).toMatchObject({ type: 'displacedKnightMove', playerId: 'p1' });
  });
});

describe('C&K AI: cards in hand', () => {
  it('discards commodities as well as resources on a 7', () => {
    let s = mainState();
    s = edit(s, 'p1', () => ({
      resources: { ...EMPTY_RES, wood: 3, brick: 3 },
      commodities: { paper: 3, cloth: 3, coin: 0 },
    }));
    s = { ...s, phase: 'discard', discardState: { required: { p1: 6 } } };
    const act = decide(s);
    expect(act.type).toBe('discardCK');
    if (act.type !== 'discardCK') return;
    const total =
      Object.values(act.resources).reduce((x, y) => x + (y ?? 0), 0) +
      Object.values(act.commodities).reduce((x, y) => x + (y ?? 0), 0);
    expect(total).toBe(6);
  });

  it('gives its two least useful cards to a Wedding, off its turn', () => {
    let s = mainState();
    s = edit(s, 'p1', () => ({ resources: { ...EMPTY_RES, wood: 5, ore: 2 }, commodities: { ...EMPTY_COM } }));
    s = { ...s, phase: 'weddingGive', pendingWedding: { collector: 'p0', remaining: ['p1'] } };
    const act = decide(s);
    expect(act).toMatchObject({ type: 'weddingGive', playerId: 'p1', resources: { wood: 2 } });
  });

  it('answers a Commercial Harbor offer with one of its commodities', () => {
    let s = mainState();
    s = edit(s, 'p1', () => ({ commodities: { paper: 1, cloth: 2, coin: 0 } }));
    s = {
      ...s,
      phase: 'commercialHarborOffer',
      pendingCommercialHarbor: { offererId: 'p0', targetId: 'p1', resource: 'wood' },
    };
    s = edit(s, 'p0', () => ({ resources: { ...EMPTY_RES, wood: 1 } }));
    const act = decide(s);
    expect(act.type).toBe('commercialHarborOffer');
    if (act.type === 'commercialHarborOffer') expect(['paper', 'cloth']).toContain(act.commodity);
  });

  it('robs a hand that holds only commodities', () => {
    let s = mainState();
    s = { ...s, robberActive: true, phase: 'moveRobber', pendingRobberMove: { reason: 'sevenRoll', returnTo: 'main' } };
    for (const id of ['p1', 'p2']) s = edit(s, id, () => ({ commodities: { paper: 2, cloth: 1, coin: 0 } }));
    const act = decide(s);
    expect(act.type).toBe('moveRobber');
  });

  it('accepts a fair commodity offer and refuses a lopsided one', () => {
    let s = mainState();
    s = edit(s, 'p1', () => ({ resources: { ...EMPTY_RES, wood: 4 } }));
    s = edit(s, 'p0', () => ({ commodities: { paper: 0, cloth: 0, coin: 3 } }));
    const fair: GameState = {
      ...s,
      pendingTrade: { proposerId: 'p0', give: {}, giveCommodities: { coin: 1 }, receive: { wood: 1 }, rejectedBy: [] },
    };
    expect(shouldAcceptTrade(fair, 'p1')).toBe(true);
    const lopsided: GameState = {
      ...s,
      pendingTrade: { proposerId: 'p0', give: {}, giveCommodities: { coin: 1 }, receive: { wood: 4 }, rejectedBy: [] },
    };
    expect(shouldAcceptTrade(lopsided, 'p1')).toBe(false);
  });
});

describe('C&K AI: improvements and progress cards', () => {
  it('raises an improvement track with the matching commodity', () => {
    let s = mainState();
    s = edit(s, 'p0', (p) => ({
      commodities: { paper: 0, cloth: 0, coin: 2 },
      improvements: { ...(p.improvements ?? { science: 0, trade: 0, politics: 0 }), politics: 1 },
    }));
    const a = decide(s);
    expect(a).toMatchObject({ type: 'buildCityImprovement', track: 'politics' });
  });

  it('plays Medicine to upgrade a settlement for 1 wheat + 2 ore', () => {
    let s = mainState();
    s = edit(s, 'p0', (p) => ({
      resources: { ...EMPTY_RES, wheat: 1, ore: 2 },
      progressCards: { ...(p.progressCards ?? { science: [], trade: [], politics: [] }), science: ['medicine'] },
    }));
    const a = decide(s);
    expect(a).toMatchObject({ type: 'playProgressCard', card: 'medicine' });
    const after = applyAction(s, a);
    const p0 = after.players.find((p) => p.id === 'p0')!;
    expect(p0.cities.length).toBeGreaterThan(s.players.find((p) => p.id === 'p0')!.cities.length);
  });

  it('plays Alchemy before rolling when a good number pays it', () => {
    let s = setupCK();
    s = edit(s, 'p0', (p) => ({
      progressCards: { ...(p.progressCards ?? { science: [], trade: [], politics: [] }), science: ['alchemy'] },
    }));
    expect(s.phase).toBe('rollOrPlayKnight');
    const a = decide(s);
    expect(a).toMatchObject({ type: 'playProgressCard', card: 'alchemy' });
    if (a.type !== 'playProgressCard' || !a.dice) return;
    expect(a.dice[0] + a.dice[1]).not.toBe(7);
  });

  it('drops its least useful progress card when over the limit', () => {
    let s = mainState();
    s = edit(s, 'p1', () => ({
      progressCards: { science: ['medicine'], trade: ['merchantCard'], politics: ['taxation', 'wedding', 'espionage'] },
    }));
    s = { ...s, phase: 'progressCardDiscard', progressCardDiscardRequired: { p1: 1 } };
    const a = decide(s);
    // The robber isn't on the board yet, so Taxation is the dead card.
    expect(a).toMatchObject({ type: 'discardProgressCard', playerId: 'p1', card: 'taxation' });
  });

  it('values commodity hexes for the round-2 setup city', () => {
    const s = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 7,
      randomizeTurnOrder: false,
      settings: { expansions: [CITIES_AND_KNIGHTS_EXPANSION_ID] },
    });
    const forest = s.board.vertexIds.find((v) =>
      s.board.vertices[v]!.hexes.some((h) => s.board.hexes[h]!.terrain === 'wood' && s.board.hexes[h]!.numberToken),
    )!;
    const round1 = ckVertexBonus(s, forest, 'p0');
    const round2 = ckVertexBonus({ ...s, phase: 'setupRound2', setupState: { step: 'settlement', lastPlacedSettlement: null } }, forest, 'p0');
    expect(round1).toBeGreaterThan(0);
    expect(round2).toBeGreaterThan(round1);
    // Outside C&K the bonus is off.
    expect(ckVertexBonus({ ...s, settings: { ...s.settings, expansions: [] } }, forest, 'p0')).toBe(0);
  });
});
