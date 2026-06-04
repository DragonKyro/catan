import type {
  GameState,
  MoveRobberAction,
  PlayerId,
  Resource,
  Commodity,
} from '../../../types';
import { COMMODITIES, RESOURCES } from '../../../types';
import { currentPlayerId, updatePlayer } from '../../../helpers';
import { totalResources, flattenBank } from '../../../resources';
import { totalCommodities, flattenCommodities } from '../../../commodities';
import { pickOne } from '../../../rng';

// Cities & Knights moveRobber override. Differences from base:
//   1. Robber is gated on `state.robberActive` — until the first barbarian
//      attack resolves, the robber lives "offshore" and cannot be moved or
//      used to steal.
//   2. Steal pool is the combined resources + commodities. One card is
//      picked uniformly; if it's a commodity, the transfer is to/from the
//      commodity banks instead of resources.
export function handleMoveRobberCK(
  state: GameState,
  action: MoveRobberAction,
): GameState {
  if (state.phase !== 'moveRobber') {
    throw new Error(`Cannot move robber in phase ${state.phase}`);
  }
  if (!state.pendingRobberMove) throw new Error('No pending robber move');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.robberActive) {
    // Should never happen — the dice handler refuses to enter moveRobber
    // when the robber is inactive. Defensive throw in case a stale UI
    // dispatches it anyway.
    throw new Error('Robber is not yet active in Cities & Knights');
  }
  if (action.hex === state.board.robberHex) {
    throw new Error('Robber must move to a different hex');
  }
  if (!state.board.hexes[action.hex]) throw new Error('Unknown hex');

  // Find players adjacent to the target hex with at least one card to steal.
  const stealCandidates = new Set<PlayerId>();
  for (const v of Object.values(state.board.vertices)) {
    if (!v.hexes.includes(action.hex)) continue;
    for (const p of state.players) {
      if (p.id === action.playerId) continue;
      const occupies = p.settlements.includes(v.id) || p.cities.includes(v.id);
      const handSize =
        totalResources(p.resources) + totalCommodities(p.commodities ?? { paper: 0, cloth: 0, coin: 0 });
      if (occupies && handSize > 0) stealCandidates.add(p.id);
    }
  }

  let next: GameState = {
    ...state,
    board: { ...state.board, robberHex: action.hex },
  };

  if (action.stealFrom !== null) {
    if (!stealCandidates.has(action.stealFrom)) {
      throw new Error('Cannot steal from that player');
    }
    const target = state.players.find((p) => p.id === action.stealFrom)!;
    const pool: Array<Resource | Commodity> = [
      ...flattenBank(target.resources),
      ...flattenCommodities(
        target.commodities ?? { paper: 0, cloth: 0, coin: 0 },
      ),
    ];
    const [stolen, newRng] = pickOne(next.rngState, pool);
    next = { ...next, rngState: newRng };
    const isCommodity = (COMMODITIES as readonly string[]).includes(stolen as string);
    if (isCommodity) {
      const c = stolen as Commodity;
      next = updatePlayer(next, action.stealFrom, (p) => ({
        ...p,
        commodities: {
          ...(p.commodities ?? { paper: 0, cloth: 0, coin: 0 }),
          [c]: (p.commodities?.[c] ?? 0) - 1,
        },
      }));
      next = updatePlayer(next, action.playerId, (p) => ({
        ...p,
        commodities: {
          ...(p.commodities ?? { paper: 0, cloth: 0, coin: 0 }),
          [c]: (p.commodities?.[c] ?? 0) + 1,
        },
      }));
    } else {
      const r = stolen as Resource;
      // Sanity: keep the resource shape stable.
      void RESOURCES;
      next = updatePlayer(next, action.stealFrom, (p) => ({
        ...p,
        resources: { ...p.resources, [r]: p.resources[r] - 1 },
      }));
      next = updatePlayer(next, action.playerId, (p) => ({
        ...p,
        resources: { ...p.resources, [r]: p.resources[r] + 1 },
      }));
    }
  } else if (stealCandidates.size > 0) {
    throw new Error('Must select a player to steal from');
  }

  const returnTo = state.pendingRobberMove.returnTo;
  return { ...next, phase: returnTo, pendingRobberMove: undefined };
}
