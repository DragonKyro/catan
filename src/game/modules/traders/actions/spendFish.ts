import type {
  GameState,
  PlayerId,
  Resource,
  SpendFishAction,
  FishTokenType,
} from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import {
  addResources,
  flattenBank,
  subtractResources,
  totalResources,
} from '../../../resources';
import { canConnectRoad } from '../../../placement';
import { pickOne } from '../../../rng';
import { handleBuildRoadWithRiverGold } from './buildRoad';
import {
  FISH_COST_BUILD_ROAD,
  FISH_COST_BUY_DEV_CARD,
  FISH_COST_REMOVE_ROBBER,
  FISH_COST_STEAL,
  FISH_COST_TAKE_FROM_BANK,
  FISH_TOKEN_VALUE,
} from '../constants';

// Fishing on Catan: spend fish tokens during your turn (rulebook p. 10).
// Each action is paid in full by its own tokens (the tokens listed here);
// fish on them beyond the cost are lost. 2 remove the robber; 3 steal a
// random resource card from another player; 4 take a resource card of your
// choice; 5 build a road free; 7 take a development card free.
export function handleSpendFish(
  state: GameState,
  action: SpendFishAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot spend fish in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) {
    throw new Error('Not your turn');
  }
  const player = getPlayer(state, action.playerId);

  // The spent tokens must be in the player's hand (matched by type).
  const remaining = (player.fishTokens ?? []).slice();
  for (const t of action.tokens) {
    const idx = remaining.indexOf(t);
    if (idx === -1) {
      throw new Error(`You don't have a ${t}-fish token to spend`);
    }
    remaining.splice(idx, 1);
  }

  const total = action.tokens.reduce((s, t) => s + FISH_TOKEN_VALUE[t], 0);
  const cost = fishCost(action.effect.kind);
  if (total < cost) {
    throw new Error(
      `Effect "${action.effect.kind}" needs ${cost} fish; ${total} spent`,
    );
  }

  // Pay: the tokens go face up on the discard pile.
  let next: GameState = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    fishTokens: remaining,
  }));
  next = {
    ...next,
    fishTokenDiscard: [
      ...(next.fishTokenDiscard ?? []),
      ...(action.tokens as FishTokenType[]),
    ],
  };

  switch (action.effect.kind) {
    case 'removeRobber':
      // Off the board until the next "Resolve a 7" or Knight card.
      if (state.robberActive === false) {
        throw new Error('The robber is not on the board');
      }
      next = { ...next, robberActive: false };
      break;
    case 'steal': {
      const targetId = action.effect.target;
      if (targetId === action.playerId) throw new Error('Cannot steal from yourself');
      const target = state.players.find((p) => p.id === targetId);
      if (!target) throw new Error('Unknown steal target');
      if (totalResources(target.resources) === 0) {
        throw new Error('That player has no resource cards');
      }
      // Random card, picked with the seeded RNG like a robber steal.
      const [stolen, rng] = pickOne(next.rngState, flattenBank(target.resources));
      next = { ...next, rngState: rng };
      next = stealResource(next, action.playerId, targetId, stolen);
      break;
    }
    case 'takeFromBank': {
      const r = action.effect.resource;
      if (next.bank[r] <= 0) {
        throw new Error(`Bank has no ${r}`);
      }
      next = updatePlayer(next, action.playerId, (p) => ({
        ...p,
        resources: { ...p.resources, [r]: p.resources[r] + 1 },
      }));
      next = { ...next, bank: { ...next.bank, [r]: next.bank[r] - 1 } };
      break;
    }
    case 'buildRoad': {
      // A normal road (same placement rules and piece limit), just free:
      // pre-credit the cost so the regular road handler can run.
      if (!canConnectRoad(next, action.playerId, action.effect.edge)) {
        throw new Error('Invalid road placement');
      }
      next = updatePlayer(next, action.playerId, (p) => ({
        ...p,
        resources: addResources(p.resources, { wood: 1, brick: 1 }),
      }));
      next = { ...next, bank: subtractResources(next.bank, { wood: 1, brick: 1 }) };
      next = handleBuildRoadWithRiverGold(next, {
        type: 'buildRoad',
        playerId: action.playerId,
        edge: action.effect.edge,
      });
      break;
    }
    case 'buyDevCard': {
      // The top card of the deck, free: exactly as if bought.
      if (next.devCardDeck.length === 0) {
        throw new Error('Dev card deck is empty');
      }
      const card = next.devCardDeck[next.devCardDeck.length - 1]!;
      next = { ...next, devCardDeck: next.devCardDeck.slice(0, -1) };
      next = updatePlayer(next, action.playerId, (p) =>
        card === 'victoryPoint'
          ? { ...p, devCards: { ...p.devCards, victoryPoints: p.devCards.victoryPoints + 1 } }
          : {
              ...p,
              devCards: { ...p.devCards, boughtThisTurn: [...p.devCards.boughtThisTurn, card] },
            },
      );
      break;
    }
  }

  return next;
}

export function fishCost(kind: SpendFishAction['effect']['kind']): number {
  switch (kind) {
    case 'removeRobber':
      return FISH_COST_REMOVE_ROBBER;
    case 'steal':
      return FISH_COST_STEAL;
    case 'takeFromBank':
      return FISH_COST_TAKE_FROM_BANK;
    case 'buildRoad':
      return FISH_COST_BUILD_ROAD;
    case 'buyDevCard':
      return FISH_COST_BUY_DEV_CARD;
  }
}

// Tokens to pay `cost` from a fish hand, wasting as few fish as possible
// (excess fish are lost), then using as few tokens as possible. Null when
// the hand can't pay. Shared by the UI and the AI.
export function pickFishTokens(
  hand: Array<'one' | 'two' | 'three'>,
  cost: number,
): Array<'one' | 'two' | 'three'> | null {
  const have = { one: 0, two: 0, three: 0 };
  for (const t of hand) have[t]++;
  let best: { tokens: Array<'one' | 'two' | 'three'>; total: number } | null = null;
  for (let c3 = 0; c3 <= have.three; c3++) {
    for (let c2 = 0; c2 <= have.two; c2++) {
      for (let c1 = 0; c1 <= have.one; c1++) {
        const total = c3 * 3 + c2 * 2 + c1;
        if (total < cost) continue;
        const tokens = [
          ...Array<'three'>(c3).fill('three'),
          ...Array<'two'>(c2).fill('two'),
          ...Array<'one'>(c1).fill('one'),
        ];
        if (
          !best ||
          total < best.total ||
          (total === best.total && tokens.length < best.tokens.length)
        ) {
          best = { tokens, total };
        }
        break; // more ones only add waste
      }
    }
  }
  return best?.tokens ?? null;
}

export function fishTotal(hand: Array<'one' | 'two' | 'three'>): number {
  return hand.reduce((s, t) => s + FISH_TOKEN_VALUE[t], 0);
}

// Move one named resource card from `targetId` to `thiefId`.
export function stealResource(
  state: GameState,
  thiefId: PlayerId,
  targetId: PlayerId,
  resource: Resource,
): GameState {
  const target = state.players.find((p) => p.id === targetId);
  if (!target) throw new Error('Unknown steal target');
  if (target.resources[resource] <= 0) {
    throw new Error(`Target has no ${resource}`);
  }
  let next = updatePlayer(state, targetId, (p) => ({
    ...p,
    resources: { ...p.resources, [resource]: p.resources[resource] - 1 },
  }));
  next = updatePlayer(next, thiefId, (p) => ({
    ...p,
    resources: { ...p.resources, [resource]: p.resources[resource] + 1 },
  }));
  return next;
}
