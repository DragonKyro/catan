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
import { handleRecruitKnight } from './actions/recruitKnight';
import { handleActivateKnight } from './actions/activateKnight';
import { handlePromoteKnight } from './actions/promoteKnight';
import { handleMoveKnight } from './actions/moveKnight';
import { handleDisplaceKnight } from './actions/displaceKnight';
import { handleDisplacedKnightMove } from './actions/displacedKnightMove';
import { handleChaseRobber } from './actions/chaseRobber';
import { handleBuildCityImprovement } from './actions/buildCityImprovement';
import { handlePlaceMetropolis } from './actions/placeMetropolis';
import { handleAqueductPick } from './actions/aqueductPick';
import { handlePlayProgressCard } from './actions/playProgressCard';
import { handleChooseProgressCardPick } from './actions/chooseProgressCardPick';
import { handleRemoveRoad } from './actions/removeRoad';
import { handleDiscardProgressCard } from './actions/discardProgressCard';
import { handlePlaceMerchant } from './actions/placeMerchant';
import {
  handleTreasonRemoveKnight,
  handleTreasonPlaceKnight,
} from './actions/treason';
import { handleCommercialHarborOffer } from './actions/commercialHarborOffer';
import { handleWeddingGive } from './actions/weddingGive';
import { handleDefenderTieDraw } from './actions/defenderTieDraw';
import { handleBuildRoadCK, handleBuildCityCK } from './actions/buildWrappers';

// Cities & Knights module. Inserted before the base module in
// `engine.getActiveModules`, so any handler defined here wins.
export const citiesAndKnightsModule: RuleModule = {
  id: CITIES_AND_KNIGHTS_EXPANSION_ID,
  name: 'Cities & Knights',
  handlers: {
    // Phase 1 — framework.
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
    // Phase 2 — knights.
    recruitKnight: handleRecruitKnight as never,
    activateKnight: handleActivateKnight as never,
    promoteKnight: handlePromoteKnight as never,
    moveKnight: handleMoveKnight as never,
    displaceKnight: handleDisplaceKnight as never,
    displacedKnightMove: handleDisplacedKnightMove as never,
    chaseRobber: handleChaseRobber as never,
    // Phase 2 — improvements + metropolises.
    buildCityImprovement: handleBuildCityImprovement as never,
    placeMetropolis: handlePlaceMetropolis as never,
    aqueductPick: handleAqueductPick as never,
    // Phase 2 — progress cards + follow-ups.
    playProgressCard: handlePlayProgressCard as never,
    chooseProgressCardPick: handleChooseProgressCardPick as never,
    removeRoad: handleRemoveRoad as never,
    discardProgressCard: handleDiscardProgressCard as never,
    placeMerchant: handlePlaceMerchant as never,
    treasonRemoveKnight: handleTreasonRemoveKnight as never,
    treasonPlaceKnight: handleTreasonPlaceKnight as never,
    commercialHarborOffer: handleCommercialHarborOffer as never,
    weddingGive: handleWeddingGive as never,
    defenderTieDraw: handleDefenderTieDraw as never,
    // Intercept buildRoad/buildCity to honor Diplomacy free-road and
    // Medicine discount flags.
    buildRoad: handleBuildRoadCK as never,
    buildCity: handleBuildCityCK as never,
  },
};
