import type {
  GameState,
  PlayerId,
  EventCard,
  EventChoice,
  RollDiceAction,
  ResolveEventAction,
  RepairRoadAction,
  Resource,
} from '../../../../types';
import { RESOURCES } from '../../../../types';
import { currentPlayerId, updatePlayer } from '../../../../helpers';
import {
  addResources,
  canAfford,
  flattenBank,
  subtractResources,
  totalResources,
} from '../../../../resources';
import { pickOne } from '../../../../rng';
import { getPortAtVertex } from '../../../../board/adjacency';
import { applyNextModuleHandler } from '../../../../engine';
import { calculateVictoryPoints } from '../../../../scoring/points';
import { buildEventDeck } from './deck';

// Catan Event Cards (2025 T&B rulebook p. 4-6). Instead of rolling, the
// active player flips the top event card, its event is resolved, and then
// "Collect Resources" or "Resolve a 7" runs for the number on its disc.
// The `rollDice` action still starts it (its dice are ignored): the card
// comes off the seeded deck in state, so every peer flips the same one.
// Events that need answers (pick / give / steal / damage a road) open the
// `eventResolution` phase; production runs once the last answer is in.
// Production itself is handed to whichever rule set is in play
// (Seafarers, T&B scenarios, base) via `applyNextModuleHandler`, with dice
// that sum to the card's number.
//
// Readings:
//   - "If you have the Largest Army / Longest Route tile" (Conflict, Trade
//     Advantage) means whoever holds the tile, not only the active player.
//   - "Most" (Calm Seas, Tournament, Conflict's knights) needs at least 1:
//     with no harbor buildings / knights played, nobody gains.
//   - Helpful Neighbor counts public VPs; when everyone is tied nobody has
//     "fewer VPs", so nobody gives.
//   - Good Neighbors cards are handed over together once everyone chose.
//   - Earthquake: the owner picks which road; a damaged road can't be
//     damaged twice. "No settlement next to a damaged road" applies to any
//     player's damaged road (both ends).
//   - Epidemic: cities collect 1 instead of 2 (also for gold picks); a
//     building a Volcano eruption destroys meanwhile still downgrades.
export const EVENT_CARDS_MODULE_ID = 'tradersEventCards';

export const REPAIR_ROAD_COST: Partial<Record<Resource, number>> = { brick: 1, wood: 1 };

// Dice standing in for a card number (production only reads the sum).
function diceFor(n: number): [number, number] {
  const d1 = Math.min(6, n - 1);
  return [d1, n - d1];
}

// Turn order starting with the active player.
function tableOrder(state: GameState): PlayerId[] {
  const start = state.currentPlayerIndex;
  return state.playerOrder.map(
    (_, i) => state.playerOrder[(start + i) % state.playerOrder.length]!,
  );
}

function player(state: GameState, id: PlayerId) {
  return state.players.find((p) => p.id === id)!;
}

// Players tied for the highest score, when that score is at least 1.
function topScorers(state: GameState, score: (id: PlayerId) => number): PlayerId[] {
  const order = tableOrder(state);
  const max = Math.max(...order.map(score));
  if (max < 1) return [];
  return order.filter((id) => score(id) === max);
}

export function harborBuildings(state: GameState, id: PlayerId): number {
  const p = player(state, id);
  return [...p.settlements, ...p.cities].filter((v) => getPortAtVertex(state.board, v) !== null)
    .length;
}

function canRob(state: GameState, thief: PlayerId): boolean {
  return state.players.some((p) => p.id !== thief && totalResources(p.resources) > 0);
}

function undamagedRoads(state: GameState, id: PlayerId) {
  const damaged = new Set(state.damagedRoads ?? []);
  return player(state, id).roads.filter((e) => !damaged.has(e));
}

// The answers a card waits for, in turn order from the active player.
function choicesFor(state: GameState, card: EventCard): EventChoice[] {
  const order = tableOrder(state);
  const bankHasAny = totalResources(state.bank) > 0;
  const take = (ids: PlayerId[]): EventChoice[] =>
    bankHasAny ? ids.map((playerId) => ({ playerId, kind: 'takeResource' as const })) : [];
  const steal = (id: PlayerId | null | undefined): EventChoice[] =>
    id && canRob(state, id) ? [{ playerId: id, kind: 'steal' }] : [];
  switch (card.kind) {
    case 'plentifulYear':
      return take(order);
    case 'calmSeas':
      return take(topScorers(state, (id) => harborBuildings(state, id)));
    case 'tournament':
      return take(topScorers(state, (id) => player(state, id).devCards.playedKnights));
    case 'conflict': {
      const holder = state.largestArmy?.holder;
      if (holder) return steal(holder);
      const top = topScorers(state, (id) => player(state, id).devCards.playedKnights);
      return top.length === 1 ? steal(top[0]) : [];
    }
    case 'tradeAdvantage':
      return steal(state.longestRoad?.holder);
    case 'goodNeighbors':
      return order
        .filter((id) => totalResources(player(state, id).resources) > 0)
        .map((playerId) => {
          const i = state.playerOrder.indexOf(playerId);
          const left = state.playerOrder[(i + 1) % state.playerOrder.length]!;
          return { playerId, kind: 'giveResource' as const, recipients: [left] };
        });
    case 'helpfulNeighbor': {
      const vp = (id: PlayerId) => calculateVictoryPoints(state, id, false);
      const max = Math.max(...order.map(vp));
      const poorer = order.filter((id) => vp(id) < max);
      if (poorer.length === 0) return [];
      return order
        .filter((id) => vp(id) === max && totalResources(player(state, id).resources) > 0)
        .map((playerId) => ({ playerId, kind: 'giveResource' as const, recipients: poorer }));
    }
    case 'earthquake':
      return order
        .filter((id) => undamagedRoads(state, id).length > 0)
        .map((playerId) => ({ playerId, kind: 'damageRoad' as const }));
    default:
      return [];
  }
}

// Robber Flees: back to the desert, or off the board without one.
function robberFlees(state: GameState): GameState {
  const desert = state.board.hexIds.find((h) => state.board.hexes[h]!.terrain === 'desert');
  if (desert) {
    return { ...state, board: { ...state.board, robberHex: desert }, robberActive: true };
  }
  return { ...state, robberActive: false };
}

// The rollDice wrapper: flip the next card (rebuilding the deck on New
// Year), then resolve it.
export function handleRollDiceWithEventCards(
  state: GameState,
  action: RollDiceAction,
): GameState {
  if (state.phase !== 'rollOrPlayKnight') {
    throw new Error(`Cannot flip an event card in phase ${state.phase}`);
  }
  if (state.hasRolledThisTurn) throw new Error('Already flipped an event card this turn');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const ec = state.eventCards;
  if (!ec) throw new Error('No event deck');
  let rng = state.rngState;
  let deck = ec.deck;
  let card = deck[0];
  let newYear = false;
  // New Year (or, defensively, an empty deck): build a new deck and flip
  // its top card, which is never New Year (it sits 6th from the bottom).
  while (!card || card.kind === 'newYear') {
    [deck, rng] = buildEventDeck(rng);
    card = deck[0];
    newYear = true;
  }
  deck = deck.slice(1);
  let next: GameState = {
    ...state,
    rngState: rng,
    eventCards: { deck, current: card, ...(newYear ? { newYear: true } : {}) },
  };
  if (card.kind === 'robberFlees') next = robberFlees(next);
  const choices = choicesFor(next, card);
  if (choices.length === 0) return produce(next, card);
  return {
    ...next,
    phase: 'eventResolution',
    eventCards: { ...next.eventCards!, pending: { card, choices, gifts: [] } },
  };
}

// "Collect Resources" / "Resolve a 7" for the card's number, by the rule
// set in play.
function produce(state: GameState, card: EventCard): GameState {
  const number = card.number ?? 7;
  const roll: RollDiceAction = {
    type: 'rollDice',
    playerId: currentPlayerId(state),
    dice: diceFor(number),
  };
  const ready: GameState = { ...state, phase: 'rollOrPlayKnight', hasRolledThisTurn: false };
  if (card.kind !== 'epidemic') {
    return applyNextModuleHandler(ready, roll, EVENT_CARDS_MODULE_ID);
  }
  // Epidemic: produce with every city counted as a settlement, then put
  // the cities back (one an eruption hit in the meantime downgrades).
  const cities = new Map(state.players.map((p) => [p.id, p.cities]));
  const flat: GameState = {
    ...ready,
    players: ready.players.map((p) => ({
      ...p,
      settlements: [...p.settlements, ...p.cities],
      cities: [],
    })),
  };
  const after = applyNextModuleHandler(flat, roll, EVENT_CARDS_MODULE_ID);
  return {
    ...after,
    players: after.players.map((p) => {
      const own = cities.get(p.id) ?? [];
      const standing = new Set(p.settlements);
      return {
        ...p,
        settlements: [
          ...p.settlements.filter((v) => !own.includes(v)),
          ...own.filter((v) => !standing.has(v)),
        ],
        cities: own.filter((v) => standing.has(v)),
      };
    }),
  };
}

export function handleResolveEvent(state: GameState, action: ResolveEventAction): GameState {
  const pending = state.eventCards?.pending;
  if (state.phase !== 'eventResolution' || !pending) {
    throw new Error('No event is waiting for an answer');
  }
  const choice = pending.choices[0]!;
  if (choice.playerId !== action.playerId) throw new Error('Not your turn to answer the event');
  let next: GameState = state;
  let gifts = pending.gifts;
  const me = player(state, action.playerId);
  switch (choice.kind) {
    case 'takeResource': {
      const r = action.resource;
      if (!r || !RESOURCES.includes(r)) throw new Error('Pick a resource');
      if (state.bank[r] < 1) throw new Error(`The supply has no ${r} left`);
      next = updatePlayer(next, me.id, (p) => ({ ...p, resources: addResources(p.resources, { [r]: 1 }) }));
      next = { ...next, bank: subtractResources(next.bank, { [r]: 1 }) };
      break;
    }
    case 'giveResource': {
      const r = action.resource;
      if (!r || !RESOURCES.includes(r)) throw new Error('Pick a resource to give');
      if (me.resources[r] < 1) throw new Error(`You have no ${r} to give`);
      const recipients = choice.recipients ?? [];
      const to = recipients.length === 1 ? recipients[0]! : action.target;
      if (!to || !recipients.includes(to)) throw new Error('Pick who receives the card');
      next = updatePlayer(next, me.id, (p) => ({ ...p, resources: subtractResources(p.resources, { [r]: 1 }) }));
      if (pending.card.kind === 'goodNeighbors') {
        gifts = [...gifts, { from: me.id, to, resource: r }];
      } else {
        next = updatePlayer(next, to, (p) => ({ ...p, resources: addResources(p.resources, { [r]: 1 }) }));
      }
      break;
    }
    case 'steal': {
      const victim = action.target ?? null;
      if (victim) {
        const v = state.players.find((p) => p.id === victim);
        if (!v || v.id === me.id) throw new Error('Pick another player to steal from');
        if (totalResources(v.resources) === 0) throw new Error(`${v.name} has no cards`);
        const [stolen, rng] = pickOne(next.rngState, flattenBank(v.resources));
        next = { ...next, rngState: rng };
        next = updatePlayer(next, victim, (p) => ({ ...p, resources: subtractResources(p.resources, { [stolen]: 1 }) }));
        next = updatePlayer(next, me.id, (p) => ({ ...p, resources: addResources(p.resources, { [stolen]: 1 }) }));
      }
      break;
    }
    case 'damageRoad': {
      const edge = action.edge;
      if (!edge || !undamagedRoads(state, me.id).includes(edge)) {
        throw new Error('Pick one of your undamaged roads');
      }
      next = { ...next, damagedRoads: [...(state.damagedRoads ?? []), edge] };
      break;
    }
  }
  const choices = pending.choices.slice(1);
  if (choices.length > 0) {
    return {
      ...next,
      eventCards: { ...next.eventCards!, pending: { ...pending, choices, gifts } },
    };
  }
  for (const g of gifts) {
    next = updatePlayer(next, g.to, (p) => ({ ...p, resources: addResources(p.resources, { [g.resource]: 1 }) }));
  }
  next = { ...next, eventCards: { ...next.eventCards!, pending: undefined } };
  return produce(next, pending.card);
}

// Earthquake: repair one damaged road for 1 brick + 1 wood (any time in
// your Action phase).
export function handleRepairRoad(state: GameState, action: RepairRoadAction): GameState {
  if (state.phase !== 'main') throw new Error(`Cannot repair a road in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const me = player(state, action.playerId);
  if (!me.roads.includes(action.edge) || !(state.damagedRoads ?? []).includes(action.edge)) {
    throw new Error('That is not one of your damaged roads');
  }
  if (!canAfford(me.resources, REPAIR_ROAD_COST)) {
    throw new Error('Repairing a road costs 1 brick and 1 wood');
  }
  let next = updatePlayer(state, me.id, (p) => ({
    ...p,
    resources: subtractResources(p.resources, REPAIR_ROAD_COST),
  }));
  const damagedRoads = (state.damagedRoads ?? []).filter((e) => e !== action.edge);
  next = {
    ...next,
    bank: addResources(next.bank, REPAIR_ROAD_COST),
    damagedRoads: damagedRoads.length > 0 ? damagedRoads : undefined,
  };
  return next;
}

// A player's damaged roads (Earthquake).
export function damagedRoadsOf(state: GameState, id: PlayerId): string[] {
  const own = new Set(player(state, id).roads);
  return (state.damagedRoads ?? []).filter((e) => own.has(e));
}
