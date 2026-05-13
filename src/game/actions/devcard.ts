import type {
  GameState,
  BuyDevCardAction,
  PlayKnightAction,
  PlayRoadBuildingAction,
  PlayYearOfPlentyAction,
  PlayMonopolyAction,
  DevCardType,
  Resource,
  EdgeId,
} from '../types';
import { COSTS } from '../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../helpers';
import {
  addResources,
  subtractResources,
  canAfford,
} from '../resources';

export function handleBuyDevCard(
  state: GameState,
  action: BuyDevCardAction,
): GameState {
  if (state.phase !== 'main') throw new Error(`Cannot buy dev card in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (state.devCardDeck.length === 0) throw new Error('Dev card deck is empty');

  const player = getPlayer(state, action.playerId);
  if (!canAfford(player.resources, COSTS.devCard)) {
    throw new Error('Cannot afford dev card');
  }

  // Pop top of deck (last element to keep shuffle stable).
  const newDeck = state.devCardDeck.slice(0, -1);
  const card = state.devCardDeck[state.devCardDeck.length - 1]!;

  let next = updatePlayer(state, action.playerId, (p) => {
    if (card === 'victoryPoint') {
      return {
        ...p,
        resources: subtractResources(p.resources, COSTS.devCard),
        devCards: {
          ...p.devCards,
          victoryPoints: p.devCards.victoryPoints + 1,
        },
      };
    }
    return {
      ...p,
      resources: subtractResources(p.resources, COSTS.devCard),
      devCards: {
        ...p.devCards,
        boughtThisTurn: [...p.devCards.boughtThisTurn, card],
      },
    };
  });

  next = {
    ...next,
    bank: addResources(next.bank, COSTS.devCard),
    devCardDeck: newDeck,
  };
  return next;
}

function consumePlayableCard(
  player: ReturnType<typeof getPlayer>,
  card: DevCardType,
): DevCardType[] {
  const idx = player.devCards.unplayed.indexOf(card);
  if (idx < 0) throw new Error(`You have no ${card} card to play`);
  const out = player.devCards.unplayed.slice();
  out.splice(idx, 1);
  return out;
}

function assertPhaseForCard(state: GameState, allowRollPhase: boolean): void {
  if (state.hasPlayedDevCardThisTurn) {
    throw new Error('Already played a development card this turn');
  }
  if (state.phase === 'main') return;
  if (allowRollPhase && state.phase === 'rollOrPlayKnight') return;
  throw new Error(`Cannot play dev card in phase ${state.phase}`);
}

export function handlePlayKnight(
  state: GameState,
  action: PlayKnightAction,
): GameState {
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  assertPhaseForCard(state, true);

  const player = getPlayer(state, action.playerId);
  const newUnplayed = consumePlayableCard(player, 'knight');

  const next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    devCards: {
      ...p.devCards,
      unplayed: newUnplayed,
      playedKnights: p.devCards.playedKnights + 1,
    },
  }));
  return {
    ...next,
    phase: 'moveRobber',
    pendingRobberMove: { reason: 'knight', returnTo: state.phase as 'main' | 'rollOrPlayKnight' },
    hasPlayedDevCardThisTurn: true,
  };
}

export function handlePlayRoadBuilding(
  state: GameState,
  action: PlayRoadBuildingAction,
): GameState {
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  assertPhaseForCard(state, false);

  const player = getPlayer(state, action.playerId);
  const newUnplayed = consumePlayableCard(player, 'roadBuilding');

  // Place each road if and only if it's a valid placement at the moment of placing.
  // We apply them sequentially.
  let next: GameState = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    devCards: {
      ...p.devCards,
      unplayed: newUnplayed,
    },
  }));
  next = { ...next, hasPlayedDevCardThisTurn: true };

  const tryPlaceRoad = (s: GameState, edge: EdgeId): GameState => {
    if (!canConnectFreeRoad(s, action.playerId, edge)) {
      throw new Error('Invalid free road placement');
    }
    return updatePlayer(s, action.playerId, (p) => ({
      ...p,
      roads: [...p.roads, edge],
    }));
  };

  for (const eid of action.edges) {
    if (getPlayer(next, action.playerId).roads.length >= 15) break;
    next = tryPlaceRoad(next, eid);
  }
  return next;
}

function canConnectFreeRoad(
  state: GameState,
  playerId: string,
  edgeId: EdgeId,
): boolean {
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  for (const p of state.players) if (p.roads.includes(edgeId)) return false;
  const player = getPlayer(state, playerId);
  const [v1, v2] = edge.vertices;
  for (const v of [v1, v2]) {
    let blocked = false;
    for (const p of state.players) {
      if (p.id === playerId) continue;
      if (p.settlements.includes(v) || p.cities.includes(v)) {
        blocked = true;
        break;
      }
    }
    if (player.settlements.includes(v) || player.cities.includes(v)) return true;
    if (blocked) continue;
    for (const eid of state.board.vertices[v]!.edges) {
      if (eid !== edgeId && player.roads.includes(eid)) return true;
    }
  }
  return false;
}

export function handlePlayYearOfPlenty(
  state: GameState,
  action: PlayYearOfPlentyAction,
): GameState {
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  assertPhaseForCard(state, false);

  const player = getPlayer(state, action.playerId);
  const newUnplayed = consumePlayableCard(player, 'yearOfPlenty');

  const [r1, r2] = action.resources;
  if (state.bank[r1] < 1) throw new Error(`Bank out of ${r1}`);
  // Check combined demand against bank for same-resource doubles
  if (r1 === r2 && state.bank[r1] < 2) throw new Error(`Bank only has 1 ${r1}`);
  if (r1 !== r2 && state.bank[r2] < 1) throw new Error(`Bank out of ${r2}`);

  const gain: Partial<Record<Resource, number>> = {};
  gain[r1] = (gain[r1] ?? 0) + 1;
  gain[r2] = (gain[r2] ?? 0) + 1;

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    devCards: { ...p.devCards, unplayed: newUnplayed },
    resources: addResources(p.resources, gain),
  }));
  next = {
    ...next,
    bank: subtractResources(next.bank, gain),
    hasPlayedDevCardThisTurn: true,
  };
  return next;
}

export function handlePlayMonopoly(
  state: GameState,
  action: PlayMonopolyAction,
): GameState {
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  assertPhaseForCard(state, false);

  const player = getPlayer(state, action.playerId);
  const newUnplayed = consumePlayableCard(player, 'monopoly');

  let totalTaken = 0;
  let next: GameState = state;
  for (const p of state.players) {
    if (p.id === action.playerId) continue;
    const amount = p.resources[action.resource];
    if (amount === 0) continue;
    totalTaken += amount;
    next = updatePlayer(next, p.id, (pl) => ({
      ...pl,
      resources: { ...pl.resources, [action.resource]: 0 },
    }));
  }
  next = updatePlayer(next, action.playerId, (p) => ({
    ...p,
    devCards: { ...p.devCards, unplayed: newUnplayed },
    resources: {
      ...p.resources,
      [action.resource]: p.resources[action.resource] + totalTaken,
    },
  }));
  return { ...next, hasPlayedDevCardThisTurn: true };
}
