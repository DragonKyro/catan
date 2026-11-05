import type { GameState, Action, DiscardAction, DiscardCKAction } from '../../../types';
import { RESOURCES, COMMODITIES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { addResources, subtractResources } from '../../../resources';
import { addCommodities, subtractCommodities } from '../../../commodities';
import { resumeFlow } from '../flow';

// Cities & Knights discard: a 7 (p.7) or Sabotage (p.16). Two action shapes:
//   - `discard` (base): resources only — fine when no commodity goes.
//   - `discardCK`: resources + commodities.
// The amount owed was fixed when the discard started (half the hand,
// resources + commodities, rounded down; a 7 only hits hands over
// 7 + 2 per city wall). Discards go back to the supply.
export function handleDiscardCK(state: GameState, action: Action): GameState {
  if (state.phase !== 'discard') {
    throw new Error(`Cannot discard in phase ${state.phase}`);
  }
  if (!state.discardState) throw new Error('No discard in progress');

  let resources: DiscardAction['resources'];
  let commodities: DiscardCKAction['commodities'];
  if (action.type === 'discard') {
    resources = (action as DiscardAction).resources;
    commodities = {};
  } else if (action.type === 'discardCK') {
    resources = (action as DiscardCKAction).resources;
    commodities = (action as DiscardCKAction).commodities;
  } else {
    throw new Error(`Unexpected discard action type ${action.type}`);
  }

  const required = state.discardState.required[action.playerId];
  if (required === undefined) throw new Error('You do not need to discard');

  let total = 0;
  for (const r of RESOURCES) {
    const n = resources[r] ?? 0;
    if (!Number.isInteger(n) || n < 0) throw new Error('Invalid discard amount');
    total += n;
  }
  for (const c of COMMODITIES) {
    const n = commodities[c] ?? 0;
    if (!Number.isInteger(n) || n < 0) throw new Error('Invalid discard amount');
    total += n;
  }
  if (total !== required) {
    throw new Error(`Must discard exactly ${required}, got ${total}`);
  }

  const player = state.players.find((p) => p.id === action.playerId)!;
  for (const r of RESOURCES) {
    const want = resources[r] ?? 0;
    if (want > player.resources[r]) {
      throw new Error(`Cannot discard ${want} ${r}; only have ${player.resources[r]}`);
    }
  }
  const pCom = player.commodities ?? { paper: 0, cloth: 0, coin: 0 };
  for (const c of COMMODITIES) {
    const want = commodities[c] ?? 0;
    if (want > pCom[c]) {
      throw new Error(`Cannot discard ${want} ${c}; only have ${pCom[c]}`);
    }
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, resources),
    commodities: subtractCommodities(p.commodities ?? { paper: 0, cloth: 0, coin: 0 }, commodities),
  }));
  next = {
    ...next,
    bank: addResources(next.bank, resources),
    commodityBank: addCommodities(
      next.commodityBank ?? { paper: 0, cloth: 0, coin: 0 },
      commodities,
    ),
  };

  const newRequired = { ...state.discardState.required };
  delete newRequired[action.playerId];
  if (Object.keys(newRequired).length > 0) {
    return { ...next, discardState: { required: newRequired } };
  }
  return resumeFlow({ ...next, discardState: undefined });
}
