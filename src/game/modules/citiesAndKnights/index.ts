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
import { handleTreasonRemoveKnight, handleTreasonPlaceKnight } from './actions/treason';
import {
  handleCommercialHarborOffer,
  handleCommercialHarborPropose,
} from './actions/commercialHarborOffer';
import { handleWeddingGive } from './actions/weddingGive';
import { handleDefenderTieDraw } from './actions/defenderTieDraw';
import { handleChoosePillagedCity } from './actions/choosePillagedCity';
import {
  handleBuildRoadCK,
  handleBuildCityCK,
  handlePlaceInitialSettlementCK,
} from './actions/buildWrappers';
import { handleEndTurnCK } from './actions/endTurn';
import {
  handleAcceptTradeCK,
  handleBankTradeCK,
  handleCounterTradeCK,
  handleProposeTradeCK,
} from './trade';

// Cities & Knights module. Inserted before the base module in
// `engine.getActiveModules`, so any handler defined here wins.
export const citiesAndKnightsModule: RuleModule = {
  id: CITIES_AND_KNIGHTS_EXPANSION_ID,
  name: 'Cities & Knights',
  handlers: {
    // Setup: round 2 places a city.
    placeInitialSettlement: handlePlaceInitialSettlementCK as never,
    // Turn flow.
    rollDice: handleRollDiceCK as never,
    discard: handleDiscardCK as never,
    discardCK: handleDiscardCK as never,
    moveRobber: handleMoveRobberCK as never,
    endTurn: handleEndTurnCK as never,
    // Development cards are returned to the box (p.3).
    buyDevCard: handleBuyDevCardCK as never,
    playKnight: handlePlayKnightCK as never,
    playRoadBuilding: handlePlayRoadBuildingCK as never,
    playYearOfPlenty: handlePlayYearOfPlentyCK as never,
    playMonopoly: handlePlayMonopolyCK as never,
    // Building.
    buildCityWall: handleBuildCityWall as never,
    buildRoad: handleBuildRoadCK as never,
    buildCity: handleBuildCityCK as never,
    // Knights.
    recruitKnight: handleRecruitKnight as never,
    activateKnight: handleActivateKnight as never,
    promoteKnight: handlePromoteKnight as never,
    moveKnight: handleMoveKnight as never,
    displaceKnight: handleDisplaceKnight as never,
    displacedKnightMove: handleDisplacedKnightMove as never,
    chaseRobber: handleChaseRobber as never,
    // City improvements + metropolises.
    buildCityImprovement: handleBuildCityImprovement as never,
    placeMetropolis: handlePlaceMetropolis as never,
    aqueductPick: handleAqueductPick as never,
    // Barbarians.
    defenderTieDraw: handleDefenderTieDraw as never,
    choosePillagedCity: handleChoosePillagedCity as never,
    // Progress cards + follow-ups.
    playProgressCard: handlePlayProgressCard as never,
    chooseProgressCardPick: handleChooseProgressCardPick as never,
    removeRoad: handleRemoveRoad as never,
    discardProgressCard: handleDiscardProgressCard as never,
    placeMerchant: handlePlaceMerchant as never,
    treasonRemoveKnight: handleTreasonRemoveKnight as never,
    treasonPlaceKnight: handleTreasonPlaceKnight as never,
    commercialHarborPropose: handleCommercialHarborPropose as never,
    commercialHarborOffer: handleCommercialHarborOffer as never,
    weddingGive: handleWeddingGive as never,
    // Trading with commodities.
    bankTradeCK: handleBankTradeCK as never,
    proposeTrade: handleProposeTradeCK as never,
    counterTrade: handleCounterTradeCK as never,
    acceptTrade: handleAcceptTradeCK as never,
  },
};
