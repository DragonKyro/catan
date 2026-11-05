import type { RuleModule } from '../types';
import { handlePlaceInitialSettlement, handlePlaceInitialRoad } from '../../actions/setup';
import { handleDiscard } from '../../actions/robber';
import { handleEndTurn } from '../../actions/turn';
import { handleSpendGold, handleBuyGold } from '../traders/coins/actions';
import { EXPLORERS_PIRATES_EXPANSION_ID } from './constants';
import { handleEpSetupShip, withEpSetupRoad, withEpSetupSettlement } from './setup';
import { handleEpRollDice, withEpDiscard } from './production';
import { handleEpPlacePirate } from './pirate';
import {
  epRejectsAction,
  handleEpBuildCrew,
  handleEpBuildHarbor,
  handleEpBuildSettlement,
  handleEpBuildSettler,
  handleEpBuildShip,
  handleEpFastGold,
} from './build';
import {
  handleEpBoostShip,
  handleEpChasePirate,
  handleEpCrewFromLair,
  handleEpCrewToFarm,
  handleEpCrewToLair,
  handleEpDeliver,
  handleEpFishRoll,
  handleEpFoundSettlement,
  handleEpLoadFish,
  handleEpLoadSpice,
  handleEpMoveShip,
  handleEpTransfer,
  withEpEndTurn,
} from './movement';

// The Explorers & Pirates module (2025 rulebook, the complete "Explorers &
// Pirates" scenario). Roads, player trades and the bank trade (3:1 via
// state.supplyTradeRate) fall through to the base handlers; the land rules
// for roads and settlements live in placement.ts (epVertexBuildable /
// epEdgeBuildable). No cities, robber, development cards, Longest Road or
// Largest Army.
export const explorersPiratesModule: RuleModule = {
  id: EXPLORERS_PIRATES_EXPANSION_ID,
  name: 'Explorers & Pirates',
  handlers: {
    placeInitialSettlement: withEpSetupSettlement(handlePlaceInitialSettlement) as never,
    placeInitialRoad: withEpSetupRoad(handlePlaceInitialRoad) as never,
    placeInitialShip: handleEpSetupShip as never,
    rollDice: handleEpRollDice as never,
    discard: withEpDiscard(handleDiscard) as never,
    epPlacePirate: handleEpPlacePirate as never,
    buildSettlement: handleEpBuildSettlement as never,
    epBuildHarbor: handleEpBuildHarbor as never,
    epBuildShip: handleEpBuildShip as never,
    epBuildSettler: handleEpBuildSettler as never,
    epBuildCrew: handleEpBuildCrew as never,
    epFastGold: handleEpFastGold as never,
    // Coins: 2 gold → 1 resource twice a turn; 3 cards → 1 gold.
    spendGold: handleSpendGold as never,
    buyGold: handleBuyGold as never,
    endTurn: withEpEndTurn(handleEndTurn) as never,
    epMoveShip: handleEpMoveShip as never,
    epBoostShip: handleEpBoostShip as never,
    epTransfer: handleEpTransfer as never,
    epFoundSettlement: handleEpFoundSettlement as never,
    epCrewToLair: handleEpCrewToLair as never,
    epCrewFromLair: handleEpCrewFromLair as never,
    epCrewToFarm: handleEpCrewToFarm as never,
    epLoadSpice: handleEpLoadSpice as never,
    epLoadFish: handleEpLoadFish as never,
    epDeliver: handleEpDeliver as never,
    epChasePirate: handleEpChasePirate as never,
    epFishRoll: handleEpFishRoll as never,
    buildCity: epRejectsAction('Cities') as never,
    buyDevCard: epRejectsAction('Development cards') as never,
    playKnight: epRejectsAction('Development cards') as never,
    playRoadBuilding: epRejectsAction('Development cards') as never,
    playYearOfPlenty: epRejectsAction('Development cards') as never,
    playMonopoly: epRejectsAction('Development cards') as never,
    moveRobber: epRejectsAction('The robber and its moves') as never,
    buildShip: epRejectsAction('Seafarers ships') as never,
    moveShip: epRejectsAction('Seafarers ships') as never,
  },
};
