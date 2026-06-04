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
  subtractResources,
} from '../../../resources';
import { canConnectRoad } from '../../../placement';
import { handleBuildRoadWithRiverGold } from './buildRoad';
import {
  FISH_COST_BUILD_ROAD,
  FISH_COST_BUY_DEV_CARD,
  FISH_COST_REMOVE_ROBBER,
  FISH_COST_STEAL,
  FISH_COST_TAKE_FROM_BANK,
  FISH_TOKEN_VALUE,
} from '../constants';

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

  // Validate the spent tokens are actually in the player's hand. Spent
  // tokens are matched by type, not identity — we remove the first
  // matching token of each type.
  const remaining = (player.fishTokens ?? []).slice();
  for (const t of action.tokens) {
    const idx = remaining.indexOf(t);
    if (idx === -1) {
      throw new Error(`You don't have a ${t}-fish token to spend`);
    }
    remaining.splice(idx, 1);
  }

  // Validate sum vs. cost for the chosen effect.
  const total = action.tokens.reduce(
    (s, t) => s + FISH_TOKEN_VALUE[t],
    0,
  );
  const cost = costFor(action.effect.kind);
  if (total < cost) {
    throw new Error(
      `Effect "${action.effect.kind}" needs ${cost} fish; ${total} spent`,
    );
  }

  // Apply the discard first (regardless of effect). Excess fish is
  // forfeit per the rulebook — it goes to the discard pile.
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

  // Apply the effect.
  switch (action.effect.kind) {
    case 'removeRobber':
      // Take the robber off the board. It returns when a 7 is rolled or
      // a Knight card is played (those flows set robberActive back to true).
      next = { ...next, robberActive: false };
      break;
    case 'steal': {
      // Steal a SPECIFIC named resource. The action carries the resource so
      // every peer reduces identically (mirrors the robber-steal pattern,
      // where the dice/knight handler rolls the random pick and broadcasts
      // the outcome via the action payload).
      next = stealResource(
        next,
        action.playerId,
        action.effect.target,
        action.effect.resource,
      );
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
      next = {
        ...next,
        bank: { ...next.bank, [r]: next.bank[r] - 1 },
      };
      break;
    }
    case 'buildRoad': {
      // Reuse the standard buildRoad handler so river-edge and connectivity
      // rules apply. The handler also consumes the wood+brick — but a fish
      // road is free, so we refund the cost immediately after.
      if (!canConnectRoad(next, action.playerId, action.effect.edge)) {
        throw new Error('Invalid road placement');
      }
      // Pre-credit the cost so the base handler can succeed, then re-debit
      // it by adding the same back. Net: free road, but the river-gold
      // wrapper (and the longest-road recalc) still fires.
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
      // Pull the next card from the deck — the action payload names the
      // card so all peers reduce identically (matches the existing
      // buyDevCard pattern). Free of cost.
      if (next.devCardDeck.length === 0) {
        throw new Error('Dev card deck is empty');
      }
      const drawn = action.effect.drawn;
      // Top card must match (deterministic peer convergence). Same check
      // used by the base buyDevCard handler.
      if (next.devCardDeck[next.devCardDeck.length - 1] !== drawn) {
        throw new Error('Drawn card mismatch');
      }
      next = {
        ...next,
        devCardDeck: next.devCardDeck.slice(0, -1),
      };
      next = updatePlayer(next, action.playerId, (p) => ({
        ...p,
        devCards: {
          ...p.devCards,
          boughtThisTurn: [...p.devCards.boughtThisTurn, drawn],
        },
      }));
      break;
    }
  }

  return next;
}

function costFor(kind: SpendFishAction['effect']['kind']): number {
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

// Helper used externally too — picks a random resource from a target
// player's hand and returns the new state. Mirrors the steal-on-robber
// flow but accepts the resource as input so all peers see the same draw.
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
