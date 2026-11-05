import type {
  GameState,
  ImprovementTrack,
  PlayProgressCardAction,
  PlayerId,
  ProgressCardKind,
} from '../../../types';
import { COMMODITIES, COSTS, RESOURCES } from '../../../types';
import { currentPlayerId, updatePlayer } from '../../../helpers';
import { addResources, subtractResources } from '../../../resources';
import { calculateVictoryPoints } from '../../../scoring/points';
import { VP_PROGRESS_CARDS, progressCardDeck } from '../progress/catalogue';
import { returnToDeckBottom, takeProgressCardFromHand } from '../progress/hand';
import { openRoads } from '../progress/diplomacy';
import { knightAt } from '../knights/state';
import { legalIntrigueTargets } from '../knights/legal';
import { ckHandSize } from '../production';
import { placeCityWall } from './buildCityWall';
import { placeFreeRoad, upgradeToCity } from './buildWrappers';
import { promoteKnightFree } from './promoteKnight';
import { startDisplacedMove } from './displaceKnight';
import { merchantSites } from './placeMerchant';
import { resumeFlow } from '../flow';

// Why `playerId` can't play `card` right now, or null when they can. Covers
// timing and preconditions that need no extra choice; per-card payload
// errors are raised by the effects. Shared with the UI and the AI.
export function progressCardBlocker(
  state: GameState,
  playerId: PlayerId,
  card: ProgressCardKind,
): string | null {
  if (VP_PROGRESS_CARDS.has(card)) return 'Victory Point cards are placed face up when drawn';
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p?.progressCards?.[progressCardDeck(card)].includes(card)) return `You don't hold ${card}`;
  if (playerId !== currentPlayerId(state)) return 'Progress cards are played on your own turn';
  if (card === 'alchemy') {
    if (state.phase !== 'rollOrPlayKnight' || state.hasRolledThisTurn) {
      return 'Alchemy is played before you roll the dice';
    }
    if (state.pendingAlchemy) return 'You already set the dice';
    return null;
  }
  if (state.phase !== 'main') return 'Progress cards are played in your Action phase (after rolling)';
  const me = calculateVictoryPoints(state, playerId, true);
  const others = state.players.filter((o) => o.id !== playerId);
  switch (card) {
    case 'crane':
      return state.craneActive ? 'Only one Crane per city improvement' : null;
    case 'engineering':
      return state.engineeringActive ? 'Your next city wall is already free' : null;
    case 'medicine':
      return state.medicineActive ? 'Your next city is already discounted' : null;
    case 'guildDues':
      return others.some((o) => calculateVictoryPoints(state, o.id, true) > me)
        ? null
        : 'Nobody has more VPs than you';
    case 'taxation':
      return state.robberActive ? null : 'Taxation only works once the robber is on the board (after the first barbarian attack)';
    case 'treason':
      return others.some((o) => Object.values(state.knights ?? {}).some((k) => k.playerId === o.id))
        ? null
        : 'No other player has a knight on the board';
    case 'intrigue':
      return legalIntrigueTargets(state, playerId).length > 0
        ? null
        : 'No opposing knight stands on one of your roads';
    case 'espionage':
      return others.length > 0 ? null : 'No other player';
    default:
      return null;
  }
}

// Play a progress card (p.10, p.13-16). The card is removed from the hand
// and put face down under its deck (p.10), then its effect resolves. Cards
// with follow-up choices enter a sub-phase; a card that turns out to do
// nothing is still played.
export function handlePlayProgressCard(state: GameState, action: PlayProgressCardAction): GameState {
  const blocker = progressCardBlocker(state, action.playerId, action.card);
  if (blocker) throw new Error(blocker);
  const card = action.card;
  const deck: ImprovementTrack = progressCardDeck(card);
  let next = takeProgressCardFromHand(state, action.playerId, deck, card);
  next = returnToDeckBottom(next, deck, card);
  next = { ...next, hasPlayedProgressCardThisTurn: true };
  return applyEffect(next, action);
}

function applyEffect(state: GameState, action: PlayProgressCardAction): GameState {
  const pid = action.playerId;
  switch (action.card) {
    // ---------------- science ----------------
    case 'alchemy': {
      const dice = action.dice;
      if (!dice || !dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6)) {
        throw new Error('Alchemy needs two dice values 1-6');
      }
      return { ...state, pendingAlchemy: [dice[0], dice[1]] };
    }
    case 'crane':
      return { ...state, craneActive: true };
    case 'engineering':
      if (action.vertex) return placeCityWall(state, pid, action.vertex, false);
      return { ...state, engineeringActive: true };
    case 'invention':
      return effectInvention(state, action);
    case 'irrigation':
      return effectIrrigationMining(state, pid, 'wheat');
    case 'mining':
      return effectIrrigationMining(state, pid, 'ore');
    case 'medicine':
      if (action.vertex) return upgradeToCity(state, pid, action.vertex, COSTS.cityMedicine);
      return { ...state, medicineActive: true };
    case 'progressRoadBuilding': {
      const edges = action.edges ?? [];
      if (edges.length > 2) throw new Error('Road Building builds at most 2 roads');
      let next = state;
      for (const e of edges) next = placeFreeRoad(next, pid, e);
      return next;
    }
    case 'smithing': {
      const verts = action.knightVertices ?? [];
      if (verts.length > 2 || new Set(verts).size !== verts.length) {
        throw new Error('Smithing promotes up to 2 different knights');
      }
      let next = state;
      for (const v of verts) next = promoteKnightFree(next, pid, v);
      return next;
    }
    // ---------------- trade ----------------
    case 'commercialHarborCard':
      return { ...state, commercialHarbor: { offererId: pid, offeredTo: [] } };
    case 'guildDues': {
      const targetId = action.targetId;
      if (!targetId) throw new Error('Guild Dues needs a target');
      const me = calculateVictoryPoints(state, pid, true);
      if (calculateVictoryPoints(state, targetId, true) <= me) {
        throw new Error('Pick a player with more VPs than you');
      }
      if (ckHandSize(state, targetId) === 0) return state;
      return {
        ...state,
        phase: 'chooseProgressCardPick',
        progressPickState: { kind: 'guildDues', picker: pid, targetId, remaining: 2 },
      };
    }
    case 'merchantCard':
      return merchantSites(state, pid).length > 0 ? { ...state, phase: 'placeMerchant' } : state;
    case 'merchantFleet':
      if (action.resource && RESOURCES.includes(action.resource)) {
        return { ...state, merchantFleetActive: { kind: 'resource', which: action.resource } };
      }
      if (action.commodity && COMMODITIES.includes(action.commodity)) {
        return { ...state, merchantFleetActive: { kind: 'commodity', which: action.commodity } };
      }
      throw new Error('Merchant Fleet needs a resource or commodity');
    case 'resourceMonopoly':
      return effectResourceMonopoly(state, action);
    case 'tradeMonopoly':
      return effectTradeMonopoly(state, action);
    // ---------------- politics ----------------
    case 'diplomacy':
      return openRoads(state).length > 0 ? { ...state, phase: 'removeRoad' } : state;
    case 'encouragement':
      return effectEncouragement(state, pid);
    case 'espionage': {
      const targetId = action.targetId;
      if (!targetId || targetId === pid || !state.players.some((p) => p.id === targetId)) {
        throw new Error('Espionage needs another player');
      }
      return {
        ...state,
        phase: 'chooseProgressCardPick',
        progressPickState: { kind: 'espionage', picker: pid, targetId, remaining: 1 },
      };
    }
    case 'intrigue': {
      const v = action.vertex;
      if (!v || !legalIntrigueTargets(state, pid).includes(v)) {
        throw new Error('Intrigue needs an opposing knight on one of your roads');
      }
      const victim = knightAt(state, v)!;
      const knights = { ...(state.knights ?? {}) };
      delete knights[v];
      return startDisplacedMove({ ...state, knights }, victim, v);
    }
    case 'sabotage':
      return effectSabotage(state, pid);
    case 'taxation':
      return { ...state, phase: 'moveRobber', pendingRobberMove: { reason: 'taxation', returnTo: 'main' } };
    case 'treason': {
      const targetId = action.targetId;
      if (!targetId || targetId === pid) throw new Error('Treason needs another player');
      if (!Object.values(state.knights ?? {}).some((k) => k.playerId === targetId)) {
        throw new Error('That player has no knight on the board');
      }
      return {
        ...state,
        phase: 'treasonRemoveKnight',
        pendingTreason: { attackerId: pid, targetId },
      };
    }
    case 'wedding':
      return effectWedding(state, pid);
    case 'printing':
    case 'constitution':
      throw new Error('Victory Point cards are placed face up when drawn');
  }
}

// Invention (p.13): swap two number discs, neither a 2, 6, 8 or 12. The
// robber stays where it is.
const INVENTION_FORBIDDEN = new Set([2, 6, 8, 12]);
export function canSwapToken(state: GameState, hexId: string): boolean {
  const t = state.board.hexes[hexId]?.numberToken;
  return t != null && !INVENTION_FORBIDDEN.has(t);
}

function effectInvention(state: GameState, action: PlayProgressCardAction): GameState {
  const { fromHex, toHex } = action;
  if (!fromHex || !toHex || fromHex === toHex) throw new Error('Invention swaps two different discs');
  if (!canSwapToken(state, fromHex) || !canSwapToken(state, toHex)) {
    throw new Error('Pick two number discs other than 2, 6, 8 and 12');
  }
  const a = state.board.hexes[fromHex]!;
  const b = state.board.hexes[toHex]!;
  return {
    ...state,
    board: {
      ...state.board,
      hexes: {
        ...state.board.hexes,
        [fromHex]: { ...a, numberToken: b.numberToken },
        [toHex]: { ...b, numberToken: a.numberToken },
      },
    },
  };
}

// Irrigation / Mining (p.13-14): 2 wheat (ore) per fields (mountains) hex
// next to at least one of your buildings; as many as the supply has left.
export function irrigationMiningYield(
  state: GameState,
  pid: PlayerId,
  terrain: 'wheat' | 'ore',
): number {
  const p = state.players.find((pl) => pl.id === pid);
  if (!p) return 0;
  let hexes = 0;
  for (const hex of Object.values(state.board.hexes)) {
    if (hex.terrain !== terrain) continue;
    if (hex.corners.some((v) => p.settlements.includes(v) || p.cities.includes(v))) hexes++;
  }
  return Math.min(2 * hexes, state.bank[terrain]);
}

function effectIrrigationMining(state: GameState, pid: PlayerId, terrain: 'wheat' | 'ore'): GameState {
  const n = irrigationMiningYield(state, pid, terrain);
  if (n === 0) return state;
  const give = { [terrain]: n };
  const next = updatePlayer(state, pid, (p) => ({ ...p, resources: addResources(p.resources, give) }));
  return { ...next, bank: subtractResources(next.bank, give) };
}

// Resource Monopoly (p.15): each other player gives you 2 of the named
// resource (1 if that's all they have).
function effectResourceMonopoly(state: GameState, action: PlayProgressCardAction): GameState {
  const r = action.resource;
  if (!r || !RESOURCES.includes(r)) throw new Error('Resource Monopoly needs a resource');
  let next = state;
  let collected = 0;
  for (const p of state.players) {
    if (p.id === action.playerId) continue;
    const take = Math.min(2, p.resources[r]);
    if (take <= 0) continue;
    next = updatePlayer(next, p.id, (pl) => ({
      ...pl,
      resources: { ...pl.resources, [r]: pl.resources[r] - take },
    }));
    collected += take;
  }
  if (collected === 0) return next;
  return updatePlayer(next, action.playerId, (pl) => ({
    ...pl,
    resources: { ...pl.resources, [r]: pl.resources[r] + collected },
  }));
}

// Trade Monopoly (p.15): each other player gives you 1 of the named
// commodity if they have it.
function effectTradeMonopoly(state: GameState, action: PlayProgressCardAction): GameState {
  const c = action.commodity;
  if (!c || !COMMODITIES.includes(c)) throw new Error('Trade Monopoly needs a commodity');
  let next = state;
  let collected = 0;
  for (const p of state.players) {
    if (p.id === action.playerId) continue;
    if ((p.commodities?.[c] ?? 0) <= 0) continue;
    next = updatePlayer(next, p.id, (pl) => ({
      ...pl,
      commodities: { ...pl.commodities!, [c]: pl.commodities![c] - 1 },
    }));
    collected += 1;
  }
  if (collected === 0) return next;
  return updatePlayer(next, action.playerId, (pl) => ({
    ...pl,
    commodities: {
      ...(pl.commodities ?? { paper: 0, cloth: 0, coin: 0 }),
      [c]: (pl.commodities?.[c] ?? 0) + collected,
    },
  }));
}

// Encouragement (p.15): activate all your knights at no cost. Like any
// activation, they can't act this same turn.
function effectEncouragement(state: GameState, pid: PlayerId): GameState {
  const knights = { ...(state.knights ?? {}) };
  const stood: string[] = [];
  for (const [vid, k] of Object.entries(knights)) {
    if (k.playerId === pid && !k.active) {
      knights[vid] = { ...k, active: true, activatedThisTurn: true };
      stood.push(vid);
    }
  }
  return {
    ...state,
    knights,
    activatedKnightsThisTurn: [...(state.activatedKnightsThisTurn ?? []), ...stood],
  };
}

// Sabotage (p.16): each player with as many or more VPs than you discards
// half of their resource + commodity cards, rounded down.
function effectSabotage(state: GameState, pid: PlayerId): GameState {
  const me = calculateVictoryPoints(state, pid, true);
  const required: Record<PlayerId, number> = {};
  for (const p of state.players) {
    if (p.id === pid) continue;
    if (calculateVictoryPoints(state, p.id, true) < me) continue;
    const half = Math.floor(ckHandSize(state, p.id) / 2);
    if (half > 0) required[p.id] = half;
  }
  if (Object.keys(required).length === 0) return state;
  return resumeFlow({ ...state, discardState: { required } });
}

// Wedding (p.16): each player with more VPs than you gives you 2 cards of
// their choice (all they have if fewer).
function effectWedding(state: GameState, pid: PlayerId): GameState {
  const me = calculateVictoryPoints(state, pid, true);
  const n = state.playerOrder.length;
  const start = state.playerOrder.indexOf(pid);
  const remaining: PlayerId[] = [];
  for (let i = 1; i < n; i++) {
    const id = state.playerOrder[(start + i) % n]!;
    if (calculateVictoryPoints(state, id, true) > me && ckHandSize(state, id) > 0) {
      remaining.push(id);
    }
  }
  if (remaining.length === 0) return state;
  return { ...state, phase: 'weddingGive', pendingWedding: { collector: pid, remaining } };
}
