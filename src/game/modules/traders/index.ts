import type { RuleModule } from '../types';
import { handleBuildBridge } from './actions/buildBridge';
import { handleBuildRoadWithRiverGold } from './actions/buildRoad';
import { handleBuildSettlementWithRiverGold } from './actions/buildSettlement';
import { handleBuildCityWithStrongestPortsRefresh } from './actions/buildCity';
import { handlePlaceInitialSettlementWithRiverGold } from './actions/placeInitialSettlement';
import { handlePlaceInitialRoadWithRiverGold } from './actions/placeInitialRoad';
import { validateMoveRobberFriendlyRobber } from './variants/friendlyRobber';
import { TRADERS_EXPANSION_ID } from './constants';

// The Traders & Barbarians module. Wraps build* actions to award scenario
// gold (Rivers of Catan) and refresh Strongest Ports / Wealthiest tile
// holders. Adds the buildBridge action and the Friendly Robber validator.
//
// Currently scopes to:
//   - Rivers of Catan scenario (swamps, bridges, gold/coins, wealth tiles)
//   - Friendly Robber variant
//   - Strongest Ports variant
// Future commits add Fishing on Catan, Merchant Trains, Barbarian Attack,
// the Traders & Barbarians combo scenario, and the remaining variants
// (Catan Event Cards, Catan for Two).
export const tradersModule: RuleModule = {
  id: TRADERS_EXPANSION_ID,
  name: 'Traders & Barbarians',
  handlers: {
    buildBridge: handleBuildBridge as never,
    buildRoad: handleBuildRoadWithRiverGold as never,
    buildSettlement: handleBuildSettlementWithRiverGold as never,
    buildCity: handleBuildCityWithStrongestPortsRefresh as never,
    placeInitialSettlement: handlePlaceInitialSettlementWithRiverGold as never,
    placeInitialRoad: handlePlaceInitialRoadWithRiverGold as never,
  },
  validators: {
    moveRobber: validateMoveRobberFriendlyRobber,
  },
};
