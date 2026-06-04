import type {
  GameState,
  PlayProgressCardAction,
  PlayerId,
  ProgressCardKind,
  KnightStrength,
} from '../../../types';
import { currentPlayerId, updatePlayer } from '../../../helpers';
import {
  addResources,
  subtractResources,
  totalResources,
} from '../../../resources';
import {
  totalCommodities,
} from '../../../commodities';
import { calculateVictoryPoints } from '../../../scoring/points';
import { VP_PROGRESS_CARDS } from '../progress/catalogue';
import { knightAt, mightyAllowed, supplyAvailable } from '../knights/state';

// Master handler — dispatches to per-card helpers.
export function handlePlayProgressCard(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  // Alchemy can be played in rollOrPlayKnight before the dice are rolled.
  // Every other card requires the main phase.
  const isAlchemy = action.card === 'alchemy';
  if (isAlchemy) {
    if (state.phase !== 'rollOrPlayKnight') {
      throw new Error('Alchemy must be played at the start of Roll Dice phase');
    }
    if (state.hasRolledThisTurn) {
      throw new Error('Alchemy must be played before rolling');
    }
  } else if (state.phase !== 'main') {
    throw new Error(`Cannot play progress card in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (state.hasPlayedProgressCardThisTurn && !isAlchemy) {
    // The rulebook is permissive — multiple progress cards per turn are
    // allowed (only Alchemy is restricted to pre-roll). We don't actually
    // gate on the flag; left as a hook in case we want to throttle later.
  }
  // Validate the player owns the card.
  const card = action.card;
  if (VP_PROGRESS_CARDS.has(card)) {
    throw new Error('VP cards are auto-revealed and do not get "played"');
  }
  const owns = playerOwnsProgressCard(state, action.playerId, card);
  if (!owns) throw new Error(`You do not hold a ${card} card`);

  // Consume the card off the player's hand and put it on the bottom of the
  // matching deck (rulebook p.10).
  const deck = deckOf(card);
  let next = removeCardFromHand(state, action.playerId, card, deck);
  next = {
    ...next,
    progressDecks: {
      ...(next.progressDecks ?? { science: [], trade: [], politics: [] }),
      [deck]: [...(next.progressDecks?.[deck] ?? []), card],
    },
    hasPlayedProgressCardThisTurn: true,
  };

  switch (card) {
    case 'alchemy':
      return effectAlchemy(next, action);
    case 'crane':
      return { ...next, craneActive: true };
    case 'engineering':
      return { ...next, engineeringActive: true };
    case 'invention':
      return effectInvention(next, action);
    case 'irrigation':
      return effectIrrigationMining(next, action.playerId, 'wheat');
    case 'medicine':
      return { ...next, medicineActive: true };
    case 'mining':
      return effectIrrigationMining(next, action.playerId, 'ore');
    case 'progressRoadBuilding':
      return effectRoadBuilding(next, action);
    case 'smithing':
      return effectSmithing(next, action);
    case 'commercialHarborCard':
      return effectCommercialHarbor(next, action.playerId);
    case 'guildDues':
      return effectGuildDues(next, action);
    case 'merchantCard':
      // Enter placeMerchant; player picks the hex via placeMerchant action.
      return { ...next, phase: 'placeMerchant' };
    case 'merchantFleet':
      return effectMerchantFleet(next, action);
    case 'resourceMonopoly':
      return effectResourceMonopoly(next, action);
    case 'tradeMonopoly':
      return effectTradeMonopoly(next, action);
    case 'diplomacy':
      return { ...next, phase: 'removeRoad' };
    case 'encouragement':
      return effectEncouragement(next, action.playerId);
    case 'espionage':
      return effectEspionage(next, action);
    case 'intrigue':
      return effectIntrigue(next, action);
    case 'sabotage':
      return effectSabotage(next, action.playerId);
    case 'taxation':
      return effectTaxation(next, action.playerId);
    case 'treason':
      return effectTreason(next, action);
    case 'wedding':
      return effectWedding(next, action.playerId);
    default:
      throw new Error(`Unhandled progress card: ${card as string}`);
  }
}

// ---------------- helpers ----------------

function deckOf(card: ProgressCardKind): 'science' | 'trade' | 'politics' {
  switch (card) {
    case 'alchemy':
    case 'crane':
    case 'engineering':
    case 'invention':
    case 'irrigation':
    case 'medicine':
    case 'mining':
    case 'progressRoadBuilding':
    case 'smithing':
    case 'printing':
      return 'science';
    case 'commercialHarborCard':
    case 'guildDues':
    case 'merchantCard':
    case 'merchantFleet':
    case 'resourceMonopoly':
    case 'tradeMonopoly':
      return 'trade';
    case 'diplomacy':
    case 'encouragement':
    case 'espionage':
    case 'intrigue':
    case 'sabotage':
    case 'taxation':
    case 'treason':
    case 'constitution':
    case 'wedding':
      return 'politics';
  }
}

function playerOwnsProgressCard(
  state: GameState,
  pid: PlayerId,
  card: ProgressCardKind,
): boolean {
  const p = state.players.find((x) => x.id === pid);
  if (!p?.progressCards) return false;
  return (p.progressCards[deckOf(card)] ?? []).includes(card);
}

function removeCardFromHand(
  state: GameState,
  pid: PlayerId,
  card: ProgressCardKind,
  deck: 'science' | 'trade' | 'politics',
): GameState {
  return updatePlayer(state, pid, (p) => {
    const hand = (p.progressCards?.[deck] ?? []).slice();
    const idx = hand.indexOf(card);
    if (idx >= 0) hand.splice(idx, 1);
    return {
      ...p,
      progressCards: {
        ...(p.progressCards ?? { science: [], trade: [], politics: [] }),
        [deck]: hand,
      },
    };
  });
}

// ---------------- effect bodies ----------------

function effectAlchemy(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  const dice = action.dice;
  if (!dice) throw new Error('Alchemy requires dice values in payload');
  const [d1, d2] = dice;
  if (d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6) {
    throw new Error('Invalid alchemy dice');
  }
  return { ...state, pendingAlchemy: [d1, d2] };
}

function effectInvention(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  const { fromHex, toHex } = action;
  if (!fromHex || !toHex) {
    throw new Error('Invention requires two hex ids');
  }
  if (fromHex === toHex) throw new Error('Invention needs two distinct hexes');
  const a = state.board.hexes[fromHex];
  const b = state.board.hexes[toHex];
  if (!a || !b) throw new Error('Unknown hex');
  if (a.numberToken == null || b.numberToken == null) {
    throw new Error('Cannot swap a non-numbered hex');
  }
  const forbidden = new Set([2, 6, 8, 12]);
  if (forbidden.has(a.numberToken) || forbidden.has(b.numberToken)) {
    throw new Error('Cannot swap 2, 6, 8, or 12');
  }
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

function effectIrrigationMining(
  state: GameState,
  pid: PlayerId,
  terrain: 'wheat' | 'ore',
): GameState {
  // Grant +2 of the terrain's resource for each hex of that type adjacent
  // to at least one of the player's buildings (settlements OR cities).
  const player = state.players.find((p) => p.id === pid);
  if (!player) return state;
  let qualifying = 0;
  for (const hex of Object.values(state.board.hexes)) {
    if (hex.terrain !== terrain) continue;
    const corners = state.board.vertices;
    for (const vid of Object.keys(corners)) {
      const v = corners[vid]!;
      if (!v.hexes.includes(hex.id)) continue;
      if (player.settlements.includes(vid) || player.cities.includes(vid)) {
        qualifying++;
        break;
      }
    }
  }
  if (qualifying === 0) return state;
  const give = { [terrain]: Math.min(2 * qualifying, state.bank[terrain]) };
  let next = updatePlayer(state, pid, (p) => ({
    ...p,
    resources: addResources(p.resources, give),
  }));
  next = { ...next, bank: subtractResources(next.bank, give) };
  return next;
}

function effectRoadBuilding(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  // Reuse base Road Building semantics. This handler must place the roads
  // for free (no cost). The rulebook says you may use it for 2 ships under
  // Seafarers — Seafarers + C&K combo is disabled for now, so roads only.
  const edges = action.edges;
  if (!edges || edges.length < 1 || edges.length > 2) {
    throw new Error('Road Building requires 1 or 2 edges');
  }
  let next = state;
  for (const eid of edges) {
    const edge = next.board.edges[eid];
    if (!edge) throw new Error('Unknown edge');
    if (edge.hexes.every((h) => next.board.hexes[h]!.terrain === 'sea')) {
      throw new Error('Road cannot sit on a pure-sea edge');
    }
    if (next.riverEdges?.includes(eid)) {
      throw new Error('River edges are for bridges only');
    }
    for (const p of next.players) {
      if (p.roads.includes(eid)) throw new Error('Edge already has a road');
    }
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      roads: [...p.roads, eid],
    }));
  }
  return next;
}

function effectSmithing(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  // Promote up to 2 of your knights for free.
  const verts = action.knightVertices ?? [];
  if (verts.length === 0 || verts.length > 2) {
    throw new Error('Smithing promotes 1 or 2 knights');
  }
  let next = state;
  for (const vid of verts) {
    const k = knightAt(next, vid);
    if (!k) throw new Error(`No knight at ${vid}`);
    if (k.playerId !== action.playerId) throw new Error('Not your knight');
    if (k.strength >= 3) throw new Error('Knight is already mighty');
    const nextStrength = (k.strength + 1) as KnightStrength;
    if (nextStrength === 3 && !mightyAllowed(next, action.playerId)) {
      throw new Error('Politics level 3 is required to promote to mighty');
    }
    if (supplyAvailable(next, action.playerId, nextStrength) <= 0) {
      throw new Error('No supply for that strength');
    }
    next = {
      ...next,
      knights: {
        ...(next.knights ?? {}),
        [vid]: { ...k, strength: nextStrength },
      },
      knightSupply: {
        ...(next.knightSupply ?? {}),
        [action.playerId]: {
          ...(next.knightSupply?.[action.playerId] ?? { 1: 0, 2: 0, 3: 0 }),
          [k.strength]:
            (next.knightSupply?.[action.playerId]?.[k.strength] ?? 0) + 1,
          [nextStrength]:
            (next.knightSupply?.[action.playerId]?.[nextStrength] ?? 0) - 1,
        },
      },
    };
  }
  return next;
}

function effectCommercialHarbor(
  state: GameState,
  pid: PlayerId,
): GameState {
  // Queue opponents with at least one commodity. They each pick a commodity
  // to send back; in exchange the offerer hands them one of THEIR resources
  // (the offerer's pick — we make it the cheapest available for simplicity).
  const opps: PlayerId[] = [];
  for (const p of state.players) {
    if (p.id === pid) continue;
    if (
      (p.commodities?.paper ?? 0) +
        (p.commodities?.cloth ?? 0) +
        (p.commodities?.coin ?? 0) >
      0
    ) {
      opps.push(p.id);
    }
  }
  if (opps.length === 0) {
    // No commodities anywhere; card just discards (already off hand).
    return state;
  }
  return {
    ...state,
    phase: 'commercialHarborOffer',
    pendingCommercialHarbor: { offererId: pid, remaining: opps },
  };
}

function effectGuildDues(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  const targetId = action.targetId;
  if (!targetId) throw new Error('Guild Dues needs a target');
  const me = calculateVictoryPoints(state, action.playerId, true);
  const them = calculateVictoryPoints(state, targetId, true);
  if (them <= me) throw new Error('Target must have more VPs than you');
  return {
    ...state,
    phase: 'chooseProgressCardPick',
    progressPickState: {
      kind: 'guildDues',
      picker: action.playerId,
      targetId,
      remaining: 2,
    },
  };
}

function effectMerchantFleet(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  if (action.resource) {
    return {
      ...state,
      merchantFleetActive: { kind: 'resource', which: action.resource },
    };
  }
  if (action.commodity) {
    return {
      ...state,
      merchantFleetActive: { kind: 'commodity', which: action.commodity },
    };
  }
  throw new Error('Merchant Fleet needs a resource or commodity');
}

function effectResourceMonopoly(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  const r = action.resource;
  if (!r) throw new Error('Resource Monopoly needs a resource');
  let next = state;
  let collected = 0;
  for (const p of state.players) {
    if (p.id === action.playerId) continue;
    const have = p.resources[r];
    if (have <= 0) continue;
    const take = Math.min(2, have);
    next = updatePlayer(next, p.id, (pl) => ({
      ...pl,
      resources: { ...pl.resources, [r]: pl.resources[r] - take },
    }));
    collected += take;
  }
  if (collected > 0) {
    next = updatePlayer(next, action.playerId, (pl) => ({
      ...pl,
      resources: { ...pl.resources, [r]: pl.resources[r] + collected },
    }));
  }
  return next;
}

function effectTradeMonopoly(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  const c = action.commodity;
  if (!c) throw new Error('Trade Monopoly needs a commodity');
  let next = state;
  let collected = 0;
  for (const p of state.players) {
    if (p.id === action.playerId) continue;
    const have = p.commodities?.[c] ?? 0;
    if (have <= 0) continue;
    const take = 1;
    next = updatePlayer(next, p.id, (pl) => ({
      ...pl,
      commodities: {
        ...(pl.commodities ?? { paper: 0, cloth: 0, coin: 0 }),
        [c]: (pl.commodities?.[c] ?? 0) - take,
      },
    }));
    collected += take;
  }
  if (collected > 0) {
    next = updatePlayer(next, action.playerId, (pl) => ({
      ...pl,
      commodities: {
        ...(pl.commodities ?? { paper: 0, cloth: 0, coin: 0 }),
        [c]: (pl.commodities?.[c] ?? 0) + collected,
      },
    }));
  }
  return next;
}

function effectEncouragement(state: GameState, pid: PlayerId): GameState {
  // Activate all this player's inactive knights at no cost.
  let next = state;
  const knights = next.knights ?? {};
  const newKnights = { ...knights };
  for (const [vid, k] of Object.entries(knights)) {
    if (k.playerId === pid && !k.active) {
      newKnights[vid] = { ...k, active: true };
    }
  }
  next = { ...next, knights: newKnights };
  return next;
}

function effectEspionage(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  const targetId = action.targetId;
  if (!targetId) throw new Error('Espionage needs a target');
  if (targetId === action.playerId) throw new Error('Cannot target yourself');
  // Pick 1 non-VP card from their progress hand.
  return {
    ...state,
    phase: 'chooseProgressCardPick',
    progressPickState: {
      kind: 'espionage',
      picker: action.playerId,
      targetId,
      remaining: 1,
    },
  };
}

function effectIntrigue(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  // Same shape as displaceKnight but no attacker required.
  const { vertex, toVertex } = action;
  if (!vertex) throw new Error('Intrigue needs a target knight vertex');
  const victim = knightAt(state, vertex);
  if (!victim) throw new Error('No knight at the target vertex');
  if (victim.playerId === action.playerId) {
    throw new Error('Cannot intrigue your own knight');
  }
  // The displaced knight starts at `vertex` (which becomes empty after this
  // resolves — the rulebook makes no mention of the player taking the spot,
  // just that the victim's piece moves). Place the victim into the
  // displacedKnightMove sub-phase exactly like a real displacement.
  const next: GameState = {
    ...state,
    // Remove victim from the board temporarily.
    knights: { ...(state.knights ?? {}) },
    phase: 'displacedKnightMove',
    pendingKnightMove: {
      playerId: victim.playerId,
      sourceVertex: vertex,
      knightStrength: victim.strength,
      knightActive: victim.active,
      returnTo: 'main',
    },
  };
  delete next.knights![vertex];
  // If the player supplied an explicit `toVertex` we could auto-resolve, but
  // intrigue per rulebook leaves placement up to the victim. We always enter
  // the sub-phase.
  void toVertex;
  return next;
}

function effectSabotage(state: GameState, pid: PlayerId): GameState {
  // Every player with vp >= you discards half their hand (rounded down),
  // counting BOTH resources and commodities together.
  const me = calculateVictoryPoints(state, pid, true);
  const required: Record<PlayerId, number> = {};
  for (const p of state.players) {
    if (p.id === pid) continue;
    const vp = calculateVictoryPoints(state, p.id, true);
    if (vp >= me) {
      const handSize =
        totalResources(p.resources) +
        totalCommodities(p.commodities ?? { paper: 0, cloth: 0, coin: 0 });
      if (handSize > 0) required[p.id] = Math.floor(handSize / 2);
    }
  }
  if (Object.keys(required).length === 0) return state;
  return {
    ...state,
    phase: 'discard',
    discardState: { required },
  };
}

function effectTaxation(state: GameState, pid: PlayerId): GameState {
  if (!state.robberActive) {
    throw new Error('Taxation requires the robber to be active');
  }
  void pid;
  return {
    ...state,
    phase: 'moveRobber',
    pendingRobberMove: { reason: 'taxation', returnTo: 'main' },
  };
}

function effectTreason(
  state: GameState,
  action: PlayProgressCardAction,
): GameState {
  const targetId = action.targetId;
  if (!targetId) throw new Error('Treason needs a target');
  if (targetId === action.playerId) throw new Error('Cannot treason yourself');
  return {
    ...state,
    phase: 'treasonRemoveKnight',
    pendingTreason: { attackerId: action.playerId, targetId },
  };
}

function effectWedding(state: GameState, pid: PlayerId): GameState {
  // Each player with strictly more VPs than you gives you 2 cards (their
  // choice) — sub-phase iterates in turn order.
  const me = calculateVictoryPoints(state, pid, true);
  const remaining: PlayerId[] = [];
  for (const p of state.players) {
    if (p.id === pid) continue;
    if (calculateVictoryPoints(state, p.id, true) > me) remaining.push(p.id);
  }
  if (remaining.length === 0) return state;
  return {
    ...state,
    phase: 'weddingGive',
    pendingWedding: { collector: pid, remaining },
  };
}

