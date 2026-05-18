import type { RuleModule } from '../types';
import { SEAFARERS_EXPANSION_ID } from './constants';
import { handleBuildShip } from './actions/buildShip';
import { handleMoveShip } from './actions/moveShip';
import { handleChooseGoldResource } from './actions/chooseGoldResource';
import {
  handleChooseRobber,
  handleChoosePirate,
} from './actions/chooseRobberOrPirate';
import { handleMovePirate } from './actions/movePirate';
import {
  handleBuildSettlementWithChips,
  handlePlaceInitialSettlementWithChips,
} from './actions/buildSettlement';
import {
  handleBuildRoadWithFog,
  handlePlaceInitialRoadWithFog,
} from './actions/buildRoad';
import { handleBuildWonder } from './actions/buildWonder';
import { handleAttackPirateFleet } from './actions/attackPirateFleet';

// The Seafarers module. Only action types listed here are routed to this
// module. The base module continues to handle everything else, so opting
// into Seafarers cannot regress base-game behaviour.
//
// For buildSettlement / placeInitialSettlement we intercept the base
// handler in order to award outer-island settlement chips (+VP). The
// interceptors call the base handler directly so all the base rules still
// apply.
export const seafarersModule: RuleModule = {
  id: SEAFARERS_EXPANSION_ID,
  name: 'Seafarers',
  handlers: {
    buildShip: handleBuildShip as never,
    moveShip: handleMoveShip as never,
    chooseGoldResource: handleChooseGoldResource as never,
    chooseRobber: handleChooseRobber as never,
    choosePirate: handleChoosePirate as never,
    movePirate: handleMovePirate as never,
    buildSettlement: handleBuildSettlementWithChips as never,
    placeInitialSettlement: handlePlaceInitialSettlementWithChips as never,
    buildRoad: handleBuildRoadWithFog as never,
    placeInitialRoad: handlePlaceInitialRoadWithFog as never,
    buildWonder: handleBuildWonder as never,
    attackPirateFleet: handleAttackPirateFleet as never,
  },
};
