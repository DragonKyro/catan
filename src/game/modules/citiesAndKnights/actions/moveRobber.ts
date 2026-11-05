import type {
  Commodity,
  GameState,
  MoveRobberAction,
  PlayerId,
  Resource,
} from '../../../types';
import { COMMODITIES } from '../../../types';
import { currentPlayerId, updatePlayer } from '../../../helpers';
import { flattenBank } from '../../../resources';
import { flattenCommodities } from '../../../commodities';
import { pickOne } from '../../../rng';
import { canMoveRobberTo } from '../../../placement';
import { ckHandSize } from '../production';
import { resumeFlow } from '../flow';

const NO_COMMODITIES = { paper: 0, cloth: 0, coin: 0 };

// Opponents with a building on `hexId` and at least one resource/commodity
// card: who the robber can steal from there.
export function ckStealCandidates(state: GameState, hexId: string, thiefId: PlayerId): PlayerId[] {
  const corners = state.board.hexes[hexId]?.corners ?? [];
  const out: PlayerId[] = [];
  for (const p of state.players) {
    if (p.id === thiefId) continue;
    const there = corners.some((v) => p.settlements.includes(v) || p.cities.includes(v));
    if (there && ckHandSize(state, p.id) > 0) out.push(p.id);
  }
  return out;
}

// Cities & Knights moveRobber. Differences from CATAN:
//   1. The robber only moves once it's on the board (first barbarian attack).
//   2. A steal takes 1 random card from resources + commodities (p.7).
//   3. Taxation (p.16): steal 1 random card from EACH player with a
//      building on the new hex (1 card even with several buildings);
//      `stealFrom` is ignored.
// Reached from a 7, a knight chasing the robber, or Taxation; afterwards
// the turn flow carries on (e.g. an Aqueduct pick can't follow a 7, but a
// 7's discards always precede it).
export function handleMoveRobberCK(state: GameState, action: MoveRobberAction): GameState {
  if (state.phase !== 'moveRobber') {
    throw new Error(`Cannot move robber in phase ${state.phase}`);
  }
  if (!state.pendingRobberMove) throw new Error('No pending robber move');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.robberActive) {
    throw new Error('The robber is not on the board until the first barbarian attack');
  }
  if (action.hex === state.board.robberHex) {
    throw new Error('Robber must move to a different hex');
  }
  if (!canMoveRobberTo(state, action.hex)) throw new Error('The robber cannot go there');

  const candidates = ckStealCandidates(state, action.hex, action.playerId);
  let next: GameState = { ...state, board: { ...state.board, robberHex: action.hex } };

  if (state.pendingRobberMove.reason === 'taxation') {
    for (const victim of candidates) next = stealOne(next, action.playerId, victim);
  } else if (action.stealFrom !== null) {
    if (!candidates.includes(action.stealFrom)) throw new Error('Cannot steal from that player');
    next = stealOne(next, action.playerId, action.stealFrom);
  } else if (candidates.length > 0) {
    throw new Error('Must select a player to steal from');
  }

  return resumeFlow({ ...next, pendingRobberMove: undefined });
}

// Move one random resource/commodity card from `victimId` to `thiefId`.
function stealOne(state: GameState, thiefId: PlayerId, victimId: PlayerId): GameState {
  const victim = state.players.find((p) => p.id === victimId)!;
  const pool: Array<Resource | Commodity> = [
    ...flattenBank(victim.resources),
    ...flattenCommodities(victim.commodities ?? NO_COMMODITIES),
  ];
  if (pool.length === 0) return state;
  const [stolen, rng] = pickOne(state.rngState, pool);
  let next: GameState = { ...state, rngState: rng };
  if ((COMMODITIES as readonly string[]).includes(stolen)) {
    const c = stolen as Commodity;
    next = updatePlayer(next, victimId, (p) => ({
      ...p,
      commodities: { ...(p.commodities ?? NO_COMMODITIES), [c]: (p.commodities?.[c] ?? 0) - 1 },
    }));
    next = updatePlayer(next, thiefId, (p) => ({
      ...p,
      commodities: { ...(p.commodities ?? NO_COMMODITIES), [c]: (p.commodities?.[c] ?? 0) + 1 },
    }));
  } else {
    const r = stolen as Resource;
    next = updatePlayer(next, victimId, (p) => ({
      ...p,
      resources: { ...p.resources, [r]: p.resources[r] - 1 },
    }));
    next = updatePlayer(next, thiefId, (p) => ({
      ...p,
      resources: { ...p.resources, [r]: p.resources[r] + 1 },
    }));
  }
  return next;
}
