import type { GameState, WeddingGiveAction } from '../../../types';
import { RESOURCES, COMMODITIES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import {
  addResources,
  subtractResources,
  totalResources,
} from '../../../resources';
import {
  addCommodities,
  subtractCommodities,
  totalCommodities,
} from '../../../commodities';

// Wedding follow-up: each queued giver hands 2 cards (their choice) to the
// collector. Resource + commodity counts must sum to 2 (or to the giver's
// total hand if they have fewer than 2 cards).
export function handleWeddingGive(
  state: GameState,
  action: WeddingGiveAction,
): GameState {
  if (state.phase !== 'weddingGive') {
    throw new Error(`Cannot give in phase ${state.phase}`);
  }
  if (!state.pendingWedding) throw new Error('No pending wedding');
  const expected = state.pendingWedding.remaining[0];
  if (!expected || expected !== action.playerId) {
    throw new Error('Not your turn to give');
  }
  const giver = state.players.find((p) => p.id === action.playerId);
  if (!giver) throw new Error('Unknown giver');
  const handSize =
    totalResources(giver.resources) +
    totalCommodities(giver.commodities ?? { paper: 0, cloth: 0, coin: 0 });
  let totalGiven = 0;
  for (const r of RESOURCES) totalGiven += action.resources[r] ?? 0;
  for (const c of COMMODITIES) totalGiven += action.commodities[c] ?? 0;
  const expectedTotal = Math.min(2, handSize);
  if (totalGiven !== expectedTotal) {
    throw new Error(`Must give exactly ${expectedTotal} cards`);
  }
  for (const r of RESOURCES) {
    const want = action.resources[r] ?? 0;
    if (want > giver.resources[r]) {
      throw new Error(`You don't have ${want} ${r}`);
    }
  }
  const gCom = giver.commodities ?? { paper: 0, cloth: 0, coin: 0 };
  for (const c of COMMODITIES) {
    const want = action.commodities[c] ?? 0;
    if (want > gCom[c]) throw new Error(`You don't have ${want} ${c}`);
  }
  // Transfer.
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, action.resources),
    commodities: subtractCommodities(
      p.commodities ?? { paper: 0, cloth: 0, coin: 0 },
      action.commodities,
    ),
  }));
  const collector = state.pendingWedding.collector;
  next = updatePlayer(next, collector, (p) => ({
    ...p,
    resources: addResources(p.resources, action.resources),
    commodities: addCommodities(
      p.commodities ?? { paper: 0, cloth: 0, coin: 0 },
      action.commodities,
    ),
  }));

  const remaining = state.pendingWedding.remaining.slice(1);
  if (remaining.length === 0) {
    return {
      ...next,
      phase: 'main',
      pendingWedding: undefined,
    };
  }
  return {
    ...next,
    pendingWedding: { ...state.pendingWedding, remaining },
  };
}
