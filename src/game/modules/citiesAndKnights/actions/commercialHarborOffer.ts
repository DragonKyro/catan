import type {
  CommercialHarborOfferAction,
  CommercialHarborProposeAction,
  GameState,
  PlayerId,
} from '../../../types';
import { COMMODITIES, RESOURCES } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { totalCommodities } from '../../../commodities';
import { transferCards } from '../cards';
import { resumeFlow } from '../flow';

const NO_COMMODITIES = { paper: 0, cloth: 0, coin: 0 };

// Commercial Harbor (p.14): "You may offer each other player one of your
// resource cards. They must give you 1 commodity card of their choice in
// exchange. If the other player does not have any commodity cards, take
// back your resource card. You may use this ability at any time during the
// turn in which you play the card as long as you only make one offer per
// player."
//
// Playing the card opens `state.commercialHarbor` for the turn. Each offer
// is a `commercialHarborPropose`; a target holding a commodity then answers
// `commercialHarborOffer` (phase commercialHarborOffer).

// Players the active player may still make an offer to.
export function commercialHarborTargets(state: GameState): PlayerId[] {
  const ch = state.commercialHarbor;
  if (!ch) return [];
  return state.playerOrder.filter((pid) => pid !== ch.offererId && !ch.offeredTo.includes(pid));
}

export function handleCommercialHarborPropose(
  state: GameState,
  action: CommercialHarborProposeAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot make a Commercial Harbor offer in phase ${state.phase}`);
  }
  const ch = state.commercialHarbor;
  if (!ch || ch.offererId !== action.playerId) {
    throw new Error('Play a Commercial Harbor card first');
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!commercialHarborTargets(state).includes(action.targetId)) {
    throw new Error('You already made that player an offer');
  }
  if (!RESOURCES.includes(action.resource)) throw new Error('Offer a resource card');
  const me = state.players.find((p) => p.id === action.playerId)!;
  if (me.resources[action.resource] <= 0) throw new Error(`You have no ${action.resource}`);
  const target = state.players.find((p) => p.id === action.targetId);
  if (!target) throw new Error('Unknown player');

  const next: GameState = {
    ...state,
    commercialHarbor: { ...ch, offeredTo: [...ch.offeredTo, action.targetId] },
  };
  // No commodity to give back: the resource stays with you.
  if (totalCommodities(target.commodities ?? NO_COMMODITIES) === 0) return next;
  return {
    ...next,
    phase: 'commercialHarborOffer',
    pendingCommercialHarbor: {
      offererId: action.playerId,
      targetId: action.targetId,
      resource: action.resource,
    },
  };
}

// The offered player picks which commodity to hand over for the resource.
export function handleCommercialHarborOffer(
  state: GameState,
  action: CommercialHarborOfferAction,
): GameState {
  if (state.phase !== 'commercialHarborOffer') {
    throw new Error(`Cannot answer harbor in phase ${state.phase}`);
  }
  const ctx = state.pendingCommercialHarbor;
  if (!ctx) throw new Error('No pending commercial harbor');
  if (ctx.targetId !== action.playerId) throw new Error('Not your offer to answer');
  const target = state.players.find((p) => p.id === action.playerId)!;
  const held = target.commodities ?? NO_COMMODITIES;
  let next = state;
  if (action.commodity === null) {
    if (totalCommodities(held) > 0) throw new Error('You must give one of your commodities');
  } else {
    if (!COMMODITIES.includes(action.commodity) || held[action.commodity] <= 0) {
      throw new Error(`You don't have ${action.commodity}`);
    }
    next = transferCards(next, ctx.offererId, ctx.targetId, { [ctx.resource]: 1 }, {});
    next = transferCards(next, ctx.targetId, ctx.offererId, {}, { [action.commodity]: 1 });
  }
  return resumeFlow({ ...next, pendingCommercialHarbor: undefined });
}
