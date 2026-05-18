import type {
  CommercialHarborOfferAction,
  GameState,
  Resource,
} from '../../../types';
import { RESOURCES } from '../../../types';
import { updatePlayer } from '../../../helpers';

// Commercial Harbor follow-up: each queued opponent picks a commodity to
// hand to the offerer in exchange for one of the offerer's resources. If
// the opponent has no commodities OR they pick `null`, the offered resource
// bounces back to the offerer with no exchange.
//
// To keep the engine logic deterministic we have the offerer ALWAYS send
// their first non-empty resource. Players can adjust this later via an
// expanded payload, but the rulebook permits "any resource of their
// choice" — for the first cut we just give the first available.
export function handleCommercialHarborOffer(
  state: GameState,
  action: CommercialHarborOfferAction,
): GameState {
  if (state.phase !== 'commercialHarborOffer') {
    throw new Error(`Cannot answer harbor in phase ${state.phase}`);
  }
  if (!state.pendingCommercialHarbor) {
    throw new Error('No pending commercial harbor');
  }
  const ctx = state.pendingCommercialHarbor;
  const expected = ctx.remaining[0];
  if (!expected || expected !== action.playerId) {
    throw new Error('Not your turn to answer');
  }

  // Pick which resource the offerer will give. First non-empty resource.
  const offerer = state.players.find((p) => p.id === ctx.offererId);
  if (!offerer) throw new Error('Unknown offerer');
  let resourceOffered: Resource | null = null;
  for (const r of RESOURCES) {
    if (offerer.resources[r] > 0) {
      resourceOffered = r;
      break;
    }
  }
  // If the offerer has no resources to give, the queue advances without effect.
  if (!resourceOffered) {
    return advance(state);
  }

  let next = state;
  if (action.commodity) {
    // Real exchange.
    const target = state.players.find((p) => p.id === action.playerId);
    if (!target) throw new Error('Unknown target');
    if ((target.commodities?.[action.commodity] ?? 0) <= 0) {
      throw new Error(`You don't have ${action.commodity}`);
    }
    const r = resourceOffered;
    const c = action.commodity;
    next = updatePlayer(next, ctx.offererId, (p) => ({
      ...p,
      resources: { ...p.resources, [r]: p.resources[r] - 1 },
      commodities: {
        ...(p.commodities ?? { paper: 0, cloth: 0, coin: 0 }),
        [c]: (p.commodities?.[c] ?? 0) + 1,
      },
    }));
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      resources: { ...p.resources, [r]: p.resources[r] + 1 },
      commodities: {
        ...(p.commodities ?? { paper: 0, cloth: 0, coin: 0 }),
        [c]: (p.commodities?.[c] ?? 0) - 1,
      },
    }));
  }
  return advance(next);
}

function advance(state: GameState): GameState {
  if (!state.pendingCommercialHarbor) return state;
  const remaining = state.pendingCommercialHarbor.remaining.slice(1);
  if (remaining.length === 0) {
    return {
      ...state,
      phase: 'main',
      pendingCommercialHarbor: undefined,
    };
  }
  return {
    ...state,
    pendingCommercialHarbor: {
      ...state.pendingCommercialHarbor,
      remaining,
    },
  };
}
