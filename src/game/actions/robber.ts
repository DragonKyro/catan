import type {
  GameState,
  DiscardAction,
  MoveRobberAction,
  PlayerId,
  Resource,
} from '../types';
import { RESOURCES } from '../types';
import { currentPlayerId, updatePlayer } from '../helpers';
import {
  addResources,
  subtractResources,
  totalResources,
  flattenBank,
} from '../resources';
import { pickOne } from '../rng';

export function handleDiscard(state: GameState, action: DiscardAction): GameState {
  if (state.phase !== 'discard') throw new Error(`Cannot discard in phase ${state.phase}`);
  if (!state.discardState) throw new Error('No discard in progress');
  const required = state.discardState.required[action.playerId];
  if (required === undefined) throw new Error('You do not need to discard');

  let total = 0;
  for (const r of RESOURCES) total += action.resources[r] ?? 0;
  if (total !== required) {
    throw new Error(`Must discard exactly ${required}, got ${total}`);
  }

  const player = state.players.find((p) => p.id === action.playerId)!;
  for (const r of RESOURCES) {
    const want = action.resources[r] ?? 0;
    if (want > player.resources[r]) {
      throw new Error(`Cannot discard ${want} ${r}; only have ${player.resources[r]}`);
    }
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, action.resources),
  }));
  next = { ...next, bank: addResources(next.bank, action.resources) };

  const newRequired = { ...state.discardState.required };
  delete newRequired[action.playerId];

  if (Object.keys(newRequired).length === 0) {
    return { ...next, phase: 'moveRobber', discardState: undefined };
  }
  return { ...next, discardState: { required: newRequired } };
}

export function handleMoveRobber(
  state: GameState,
  action: MoveRobberAction,
): GameState {
  if (state.phase !== 'moveRobber') {
    throw new Error(`Cannot move robber in phase ${state.phase}`);
  }
  if (!state.pendingRobberMove) throw new Error('No pending robber move');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (action.hex === state.board.robberHex) {
    throw new Error('Robber must move to a different hex');
  }
  if (!state.board.hexes[action.hex]) throw new Error('Unknown hex');

  // Find players adjacent to the target hex with at least one resource card.
  const stealCandidates = new Set<PlayerId>();
  for (const v of Object.values(state.board.vertices)) {
    if (!v.hexes.includes(action.hex)) continue;
    for (const p of state.players) {
      if (p.id === action.playerId) continue;
      const occupies = p.settlements.includes(v.id) || p.cities.includes(v.id);
      if (occupies && totalResources(p.resources) > 0) stealCandidates.add(p.id);
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
    const pool = flattenBank(target.resources);
    let [stolen, newRng]: [Resource, number] = pickOne(next.rngState, pool);
    next = { ...next, rngState: newRng };
    next = updatePlayer(next, action.stealFrom, (p) => ({
      ...p,
      resources: { ...p.resources, [stolen]: p.resources[stolen] - 1 },
    }));
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      resources: { ...p.resources, [stolen]: p.resources[stolen] + 1 },
    }));
  } else if (stealCandidates.size > 0) {
    throw new Error('Must select a player to steal from');
  }

  const returnTo = state.pendingRobberMove.returnTo;
  return { ...next, phase: returnTo, pendingRobberMove: undefined };
}
