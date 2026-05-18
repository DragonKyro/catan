import type { RuleModule } from '../types';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from './constants';
import { handleRollDiceCK } from './actions/rollDice';
import { handleDiscardCK } from './actions/discard';
import { handleMoveRobberCK } from './actions/moveRobber';
import { handleBuildCityWall } from './actions/buildCityWall';
import {
  handleBuyDevCardCK,
  handlePlayKnightCK,
  handlePlayRoadBuildingCK,
  handlePlayYearOfPlentyCK,
  handlePlayMonopolyCK,
} from './actions/disabledDevCards';

// Cities & Knights module. Inserted before the base module in
// `engine.getActiveModules`, so any handler defined here wins.
//
// Phase 1 scope:
//   - rollDice: full override (event die, barbarian advance, commodity
//     production, wall-aware 7-roll discard, robber activation gate)
//   - discard / discardCK: combined resources + commodities, wall threshold
//   - moveRobber: steal pool includes commodities + activation gate
//   - buildCityWall: new action
//   - dev card actions: refused — progress cards replace them
//
// Knights, city improvements, progress cards land in Phase 8c/d/e.
export const citiesAndKnightsModule: RuleModule = {
  id: CITIES_AND_KNIGHTS_EXPANSION_ID,
  name: 'Cities & Knights',
  handlers: {
    rollDice: handleRollDiceCK as never,
    discard: handleDiscardCK as never,
    discardCK: handleDiscardCK as never,
    moveRobber: handleMoveRobberCK as never,
    buildCityWall: handleBuildCityWall as never,
    buyDevCard: handleBuyDevCardCK as never,
    playKnight: handlePlayKnightCK as never,
    playRoadBuilding: handlePlayRoadBuildingCK as never,
    playYearOfPlenty: handlePlayYearOfPlentyCK as never,
    playMonopoly: handlePlayMonopolyCK as never,
  },
};
