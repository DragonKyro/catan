import type { GameState, Action, DiscardAction, DiscardCKAction } from '../../../types';
import { RESOURCES, COMMODITIES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { addResources, subtractResources } from '../../../resources';
import {
  addCommodities,
  subtractCommodities,
} from '../../../commodities';
import { robberOrPirateChoicePhase } from '../../seafarers/routing';

// Cities & Knights discard. Two action shapes accepted:
//   - `discard` (base): legacy 5-resource payload. Allowed when the player
//     has no commodities to give up.
//   - `discardCK`: combined resources + commodities payload. The C&K UI
//     dispatches this when commodities are involved.
//
// The threshold is `7 + 2 * cityWalls` (max 13 with 3 walls). Hand size
// counts resources AND commodities.
export function handleDiscardCK(state: GameState, action: Action): GameState {
  if (state.phase !== 'discard') {
    throw new Error(`Cannot discard in phase ${state.phase}`);
  }
  if (!state.discardState) throw new Error('No discard in progress');

  let resources: DiscardAction['resources'];
  let commodities: Partial<Record<'paper' | 'cloth' | 'coin', number>>;
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
  for (const r of RESOURCES) total += resources[r] ?? 0;
  for (const c of COMMODITIES) total += commodities[c] ?? 0;
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
    commodities: subtractCommodities(
      p.commodities ?? { paper: 0, cloth: 0, coin: 0 },
      commodities,
    ),
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

  if (Object.keys(newRequired).length === 0) {
    // All discards in; either advance to robber (if active + a seven was
    // rolled — pendingRobberMove will already be set), or back to main.
    if (state.pendingRobberMove) {
      return {
        ...next,
        phase: robberOrPirateChoicePhase(next),
        discardState: undefined,
      };
    }
    return {
      ...next,
      phase: 'main',
      discardState: undefined,
    };
  }
  return { ...next, discardState: { required: newRequired } };
}
