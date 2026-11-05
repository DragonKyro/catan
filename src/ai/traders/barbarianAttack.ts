import type {
  Action,
  BarbarianTreasonMove,
  EdgeId,
  GameState,
  HexId,
  PlayerId,
  VertexId,
} from '@/game/types';
import { RESOURCES } from '@/game/types';
import { canAfford } from '@/game/resources';
import { canPlaceCity } from '@/game/placement';
import { probabilityDots, reportNeeds } from '../value';
import {
  isBarbarianAttack,
  isVertexConquered,
  type BarbarianAttackGame,
} from '@/game/modules/traders/barbarianAttack/state';
import {
  knightMoveTargets,
  knightsInSupply,
  knightsOnHex,
  knightsThatMustMove,
  playerKnightEdges,
} from '@/game/modules/traders/barbarianAttack/knights';
import {
  canBuyBarbarianCard,
  captureHexes,
  cardKnightEdges,
  treasonDestinations,
  treasonSources,
} from '@/game/modules/traders/barbarianAttack/cards';
import { BARBARIAN_KNIGHT_MOVE, BARBARIANS_TO_CONQUER } from '@/game/modules/traders/constants';

// Heuristic AI for Barbarian Attack. Everything is scored on one rough scale
// ("VP-ish": a prisoner is half a VP, a card about a quarter) by
// `positionValue`: the fights our knights would win at the next expel, the
// barbarians threatening our buildings, and what we've already lost to
// conquest. Knight placement, knight moves, Capture and Treason all pick the
// option that raises it most.

const PRISONER_VALUE = 0.5;
const WHEAT_COST = 0.3;
// Value of keeping one knight next to one of our coastal buildings (it can
// fight whatever lands there next).
const GUARD_VALUE = 0.06;

// ------------------------------------------------------------ settling ---

// Penalty for building on a vertex: coastal hexes lose production as
// barbarians pile up (high-number hexes fill fastest — each building rolls
// for them), and a building that touches no inner hex can be conquered.
export function barbarianVertexPenalty(state: GameState, vertexId: VertexId): number {
  const ba = state.barbarianAttack;
  if (!ba) return 0;
  const v = state.board.vertices[vertexId];
  if (!v) return 0;
  let penalty = 0;
  let safe = false;
  let worstRisk = 0;
  for (const h of v.hexes) {
    const hex = state.board.hexes[h];
    if (!hex || hex.terrain === 'sea') continue;
    if (!ba.coastalHexes.includes(h)) {
      safe = true;
      continue;
    }
    const pips = probabilityDots(hex.numberToken);
    const risk =
      hex.numberToken === null
        ? 0.15
        : Math.min(1, ((ba.barbarians[h] ?? 0) + 0.25 * pips) / BARBARIANS_TO_CONQUER);
    penalty += pips * risk * 0.6;
    worstRisk = Math.max(worstRisk, risk);
  }
  if (!safe) penalty += 1.2 * worstRisk + 0.4;
  return penalty;
}

// ----------------------------------------------------------- the model ---

// What our buildings on this hex are worth to us (production + VP), used to
// weigh barbarians there.
function hexStake(state: GameState, hexId: HexId, playerId: PlayerId): number {
  const hex = state.board.hexes[hexId]!;
  const me = state.players.find((p) => p.id === playerId)!;
  const pips = probabilityDots(hex.numberToken);
  let stake = 0;
  for (const v of hex.corners) {
    const mult = me.cities.includes(v) ? 2 : me.settlements.includes(v) ? 1 : 0;
    if (mult === 0) continue;
    stake += mult * (0.25 + pips * 0.12);
  }
  return stake;
}

// Our share of the prisoners if the knights on `hex` win now.
function expectedPrisoners(knights: Record<PlayerId, number>, barbarians: number, playerId: PlayerId): number {
  const mine = knights[playerId] ?? 0;
  if (mine === 0) return 0;
  const involved = Object.keys(knights).filter((p) => (knights[p] ?? 0) > 0);
  if (involved.length === 1) return barbarians;
  if (barbarians >= involved.length) {
    const most = Math.max(...involved.map((p) => knights[p]!));
    const top = involved.filter((p) => knights[p] === most);
    const extra = barbarians - involved.length;
    return 1 + (top.includes(playerId) ? extra / top.length : 0);
  }
  return barbarians / involved.length;
}

export function positionValue(state: GameState, playerId: PlayerId): number {
  const ba = state.barbarianAttack;
  if (!ba) return 0;
  let value = 0;
  for (const hex of ba.coastalHexes) {
    const b = ba.barbarians[hex] ?? 0;
    const knights = knightsOnHex(state, hex);
    const mine = knights[playerId] ?? 0;
    let total = 0;
    for (const n of Object.values(knights)) total += n;
    const stake = hexStake(state, hex, playerId);
    if (b === 0) {
      value += Math.min(mine, 2) * GUARD_VALUE * (1 + stake);
      continue;
    }
    // Barbarians on our hexes hurt (the third one stops production).
    const threat = (b / BARBARIANS_TO_CONQUER) ** 2 * stake;
    if (total > b && mine > 0) {
      // We'd win here at the next expel: prisoners, the threat lifted, any
      // of our conquered buildings stood back up.
      value += expectedPrisoners(knights, b, playerId) * PRISONER_VALUE;
      value += liberationValue(state, hex, playerId, b);
      // One knight in three on the fight is lost (for 3 gold): small cost.
      value -= mine * 0.04;
    } else if (total > b) {
      // Someone else wins it: the threat goes, the prisoners don't.
      value += liberationValue(state, hex, playerId, b) * 0.8;
    } else {
      value -= threat;
      // Progress toward winning it.
      const need = b + 1 - (total - mine);
      if (mine > 0 && need > 0) {
        value += (Math.min(mine, need) / need) * (b * PRISONER_VALUE + threat) * 0.45;
      }
    }
  }
  // Conquered buildings are worth nothing.
  const me = state.players.find((p) => p.id === playerId)!;
  for (const v of me.settlements) if (isVertexConquered(state, v)) value -= 1;
  for (const v of me.cities) if (isVertexConquered(state, v)) value -= 2;
  return value;
}

// Lifting the barbarians off a hex: the threat to our buildings goes, and
// our conquered buildings there stand up again.
function liberationValue(state: GameState, hex: HexId, playerId: PlayerId, b: number): number {
  let v = (b / BARBARIANS_TO_CONQUER) ** 2 * hexStake(state, hex, playerId);
  if (b >= BARBARIANS_TO_CONQUER) {
    const me = state.players.find((p) => p.id === playerId)!;
    for (const c of state.board.hexes[hex]!.corners) {
      if (!isVertexConquered(state, c)) continue;
      if (me.cities.includes(c)) v += 2;
      else if (me.settlements.includes(c)) v += 1;
    }
  }
  return v;
}

// Opponents' combined value, weighted toward the leader — Treason targets.
function opponentsValue(state: GameState, playerId: PlayerId): number {
  let v = 0;
  for (const p of state.players) {
    if (p.id === playerId) continue;
    v += positionValue(state, p.id);
  }
  return v;
}

function withKnight(state: BarbarianAttackGame, edge: EdgeId, owner: PlayerId | null): BarbarianAttackGame {
  const knights = { ...state.barbarianAttack.knights };
  if (owner) knights[edge] = owner;
  else delete knights[edge];
  return { ...state, barbarianAttack: { ...state.barbarianAttack, knights } };
}

function withBarbarianDelta(state: BarbarianAttackGame, hex: HexId, delta: number): BarbarianAttackGame {
  const barbarians = { ...state.barbarianAttack.barbarians };
  const n = (barbarians[hex] ?? 0) + delta;
  if (n <= 0) delete barbarians[hex];
  else barbarians[hex] = n;
  return { ...state, barbarianAttack: { ...state.barbarianAttack, barbarians } };
}

// ------------------------------------------------------------ main phase ---

// Buy a development card: it is the only way to raise knights, and Capture /
// Treason pay too. Skipped when we're about to afford a city.
export function tryBuyBarbarianCard(state: GameState, playerId: PlayerId): Action | null {
  if (!isBarbarianAttack(state) || !canBuyBarbarianCard(state, playerId)) return null;
  const player = state.players.find((p) => p.id === playerId)!;
  const needs = reportNeeds(state, playerId);
  let hand = 0;
  for (const r of RESOURCES) hand += player.resources[r];
  const cityShortfall = (needs.byResource.wheat ?? 0) + (needs.byResource.ore ?? 0);
  const saveForCity =
    needs.goal === 'city' &&
    player.cities.length < 4 &&
    player.settlements.length > 0 &&
    cityShortfall <= 2 &&
    hand <= 7 &&
    !canAfford(player.resources, { wheat: 3, ore: 4 });
  if (saveForCity) return null;
  // With every knight on the board, a card is mostly Knighthood (wasted):
  // only buy then when the hand is fat.
  if (knightsInSupply(state, playerId) === 0 && hand < 8) return null;
  return { type: 'buyDevCard', playerId };
}

// The base road gate only builds "station" roads (toward a spot next to a
// building) when Longest Road is near. Here the inner hexes fill up fast and
// the coast is risky, so once nothing is left to upgrade and no spot is open,
// any road toward new land is worth it.
export function barbarianAttackNeedsRoads(state: GameState, playerId: PlayerId, openSpots: number): boolean {
  if (!isBarbarianAttack(state) || openSpots > 0) return false;
  const me = state.players.find((p) => p.id === playerId)!;
  if (me.settlements.length >= 5) return false;
  const upgradable = me.cities.length < 4 && me.settlements.some((v) => canPlaceCity(state, playerId, v));
  return !upgradable;
}

// --------------------------------------------------------- card choices ---

export function chooseBarbarianCardAction(state: GameState, playerId: PlayerId): Action | null {
  if (!isBarbarianAttack(state)) return null;
  const pending = state.barbarianAttack.pendingCard;
  if (!pending || pending.playerId !== playerId) return null;
  switch (pending.card) {
    case 'capture': {
      // The prisoner is the same anywhere; pick the hex whose barbarian
      // matters most to us (a conquered hex of ours, a fight we then win).
      const hex = bestBy(captureHexes(state), (h) =>
        positionValue(withBarbarianDelta(state, h, -1), playerId),
      );
      return hex ? { type: 'resolveBarbarianCard', playerId, hex } : null;
    }
    case 'knighthood':
    case 'swiftKnight': {
      const edge = bestKnightPlacement(state, playerId, cardKnightEdges(state, pending.card), pending.card === 'knighthood');
      return edge ? { type: 'resolveBarbarianCard', playerId, edge } : null;
    }
    case 'treason':
      return { type: 'resolveBarbarianCard', playerId, moves: chooseTreasonMoves(state, playerId) };
  }
}

// Where a new knight does most good. Knighthood knights start on the castle
// and must move at the end of the turn, so score where they can get to.
function bestKnightPlacement(
  state: BarbarianAttackGame,
  playerId: PlayerId,
  edges: EdgeId[],
  mustMove: boolean,
): EdgeId | null {
  return bestBy(edges, (e) => {
    const placed = withKnight(state, e, playerId);
    if (!mustMove) return positionValue(placed, playerId) + edgeReachBonus(placed, e, playerId);
    let best = -Infinity;
    for (const t of knightMoveTargets(placed, e)) {
      if (t.distance > BARBARIAN_KNIGHT_MOVE) continue;
      best = Math.max(best, positionValue(withKnight(withKnight(placed, e, null), t.edge, playerId), playerId));
    }
    return best;
  });
}

// A knight placed now moves at the end of the turn too: credit edges from
// which it can reach a fight.
function edgeReachBonus(state: BarbarianAttackGame, edge: EdgeId, playerId: PlayerId): number {
  const without = withKnight(state, edge, null);
  let best = positionValue(state, playerId);
  for (const t of knightMoveTargets(without, edge)) {
    if (t.distance > BARBARIAN_KNIGHT_MOVE) continue;
    best = Math.max(best, positionValue(withKnight(without, t.edge, playerId), playerId));
  }
  return (best - positionValue(state, playerId)) * 0.5;
}

// Treason: take barbarians off the hexes that threaten us (or that we're
// about to beat anyway) and drop them where they hurt the others or where
// our knights will take them prisoner.
function chooseTreasonMoves(state: BarbarianAttackGame, playerId: PlayerId): BarbarianTreasonMove[] {
  const moves: BarbarianTreasonMove[] = [];
  let cur = state;
  const sources: HexId[] = [];
  const dests: HexId[] = [];
  for (let i = 0; i < 2; i++) {
    let best: { move: BarbarianTreasonMove; score: number; next: BarbarianAttackGame } | null = null;
    for (const from of treasonSources(cur, sources, dests)) {
      const afterFrom = from ? withBarbarianDelta(cur, from, -1) : cur;
      const srcs = from ? [...sources, from] : sources;
      for (const to of treasonDestinations(cur, srcs, dests)) {
        const next = withBarbarianDelta(afterFrom, to, 1);
        const score = positionValue(next, playerId) - 0.35 * opponentsValue(next, playerId);
        if (!best || score > best.score) best = { move: { from, to }, score, next };
      }
    }
    if (!best) break;
    moves.push(best.move);
    if (best.move.from) sources.push(best.move.from);
    dests.push(best.move.to);
    cur = {
      ...best.next,
      barbarianAttack: {
        ...best.next.barbarianAttack,
        supply: best.move.from ? best.next.barbarianAttack.supply : best.next.barbarianAttack.supply - 1,
      },
    };
  }
  return moves;
}

// ---------------------------------------------------- end-of-turn moves ---

// One knight move at a time, the one that raises our position most; knights
// on a castle edge always move. Returns null when we're done (the driver's
// endTurn then expels the barbarians).
export function chooseBarbarianKnightMove(state: GameState, playerId: PlayerId): Action | null {
  if (!isBarbarianAttack(state) || state.phase !== 'barbarianKnightMoves') return null;
  const moved = new Set(state.barbarianAttack.movedKnights ?? []);
  const mustMove = new Set(knightsThatMustMove(state, playerId));
  const hasWheat = state.players.find((p) => p.id === playerId)!.resources.wheat > 0;
  const base = positionValue(state, playerId);
  let best: { from: EdgeId; to: EdgeId; boost: boolean; gain: number; forced: boolean } | null = null;
  for (const from of playerKnightEdges(state, playerId)) {
    if (moved.has(from)) continue;
    const forced = mustMove.has(from);
    const lifted = withKnight(state, from, null);
    for (const t of knightMoveTargets(state, from)) {
      if (t.boost && !hasWheat) continue;
      const gain =
        positionValue(withKnight(lifted, t.edge, playerId), playerId) - base - (t.boost ? WHEAT_COST : 0);
      const better =
        !best ||
        (forced && !best.forced) ||
        (forced === best.forced && gain > best.gain);
      if (better) best = { from, to: t.edge, boost: t.boost, gain, forced };
    }
  }
  if (!best) return null;
  if (!best.forced && best.gain <= 0.05) return null;
  return {
    type: 'moveBarbarianKnight',
    playerId,
    from: best.from,
    to: best.to,
    ...(best.boost ? { boost: true } : {}),
  };
}

function bestBy<T>(items: T[], score: (t: T) => number): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const it of items) {
    const s = score(it);
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  return best;
}
