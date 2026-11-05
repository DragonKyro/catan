import type { EndTurnAction, GameState, PlayerId } from '../../types';
import type { RuleModule } from '../types';
import { SEAFARERS_EXPANSION_ID } from './constants';
import {
  handleBuildShip,
  handlePlaceInitialShip,
  handlePlayRoadBuildingSeafarers,
} from './actions/buildShip';
import { handleMoveShip } from './actions/moveShip';
import { handleChooseGoldResource } from './actions/chooseGoldResource';
import {
  handleChooseRobber,
  handleChoosePirate,
} from './actions/chooseRobberOrPirate';
import { handleMovePirate } from './actions/movePirate';
import {
  handleBuildSettlementSeafarers,
  handlePlaceInitialSettlementSeafarers,
} from './actions/buildSettlement';
import {
  handleBuildRoadSeafarers,
  handlePlaceInitialRoadSeafarers,
} from './actions/buildRoad';
import { handleBuildWonder, handleClaimWonder } from './actions/buildWonder';
import { handlePlaceTribePort } from './tribe';
import {
  beforeEndTurnPirateIslands,
  handlePlayKnightPirateIslands,
  handleRollDicePirateIslands,
  handleStealResource,
  hasRecapturedFortress,
} from './pirateIslands';
import { handlePlayKnight as basePlayKnight } from '../../actions/devcard';
import { handleEndTurn as baseEndTurn } from '../../actions/turn';
import { calculateVictoryPoints } from '../../scoring/points';
import { hasPlayerWon } from '../../engine';
import { calculateLongestTradeRoute } from './scoring/longestTradeRoute';
import { wonderLevelLead } from './wonders/catalogue';
import { EXHAUSTED_VILLAGES_TO_END, exhaustedVillageCount } from './cloth';

// End of a turn: Pirate Islands fortress assault (before the turn passes),
// then the base end-turn, then Cloth for Catan's "5+ empty villages" end.
function handleEndTurnSeafarers(state: GameState, action: EndTurnAction): GameState {
  let next = beforeEndTurnPirateIslands(state, action);
  // Recapturing your fortress at the end of your turn wins at once if you
  // already have the VP — it's still your turn.
  if (next !== state && hasPlayerWon(next, action.playerId)) {
    return { ...next, winner: action.playerId, phase: 'gameOver' };
  }
  next = baseEndTurn(next, action);
  if (next.clothVillages && exhaustedVillageCount(next) >= EXHAUSTED_VILLAGES_TO_END) {
    next = { ...next, winner: clothEndWinner(next), phase: 'gameOver' };
  }
  return next;
}

// Cloth for Catan: "If there are 5 or more villages without cloth tokens at
// the end of the turn, the player with the most VPs wins! In the case of a
// tie, the tied player with the most cloth tokens wins." A remaining tie
// goes to the tied player who comes first in turn order.
export function clothEndWinner(state: GameState): PlayerId {
  let best: PlayerId = state.playerOrder[0]!;
  let bestKey = [-1, -1];
  for (const pid of state.playerOrder) {
    const vp = calculateVictoryPoints(state, pid, true);
    const cloth = state.players.find((p) => p.id === pid)?.cloth ?? 0;
    if (vp > bestKey[0]! || (vp === bestKey[0] && cloth > bestKey[1]!)) {
      best = pid;
      bestKey = [vp, cloth];
    }
  }
  return best;
}

// The Seafarers module. Only action types listed here are routed to this
// module; the base module handles everything else. Wrapped base actions
// call the base handler and then run the Seafarers hooks (see hooks.ts).
export const seafarersModule: RuleModule = {
  id: SEAFARERS_EXPANSION_ID,
  name: 'Seafarers',
  handlers: {
    buildShip: handleBuildShip as never,
    moveShip: handleMoveShip as never,
    placeInitialShip: handlePlaceInitialShip as never,
    playRoadBuilding: handlePlayRoadBuildingSeafarers as never,
    chooseGoldResource: handleChooseGoldResource as never,
    chooseRobber: handleChooseRobber as never,
    choosePirate: handleChoosePirate as never,
    movePirate: handleMovePirate as never,
    buildSettlement: handleBuildSettlementSeafarers as never,
    placeInitialSettlement: handlePlaceInitialSettlementSeafarers as never,
    buildRoad: handleBuildRoadSeafarers as never,
    placeInitialRoad: handlePlaceInitialRoadSeafarers as never,
    claimWonder: handleClaimWonder as never,
    buildWonder: handleBuildWonder as never,
    placeTribePort: handlePlaceTribePort as never,
    stealResource: handleStealResource as never,
    rollDice: handleRollDicePirateIslands as never,
    playKnight: ((state: GameState, action: never) =>
      state.pirateIslands
        ? handlePlayKnightPirateIslands(state, action)
        : basePlayKnight(state, action)) as never,
    endTurn: handleEndTurnSeafarers as never,
  },
  // Longest Route: roads and ships, joined only at your own buildings.
  routeLength: calculateLongestTradeRoute,
  hasWon: (state, playerId, vp) => {
    const target = state.settings.victoryPointsToWin;
    // Wonders of Catan: finishing a wonder wins outright (buildWonder ends
    // the game); otherwise you need the VP target AND a strictly higher
    // wonder level than everyone else.
    if (state.wonders) return vp >= target && wonderLevelLead(state, playerId);
    // Pirate Islands: recapture your fortress AND reach the VP target.
    if (state.pirateIslands) return vp >= target && hasRecapturedFortress(state, playerId);
    return undefined;
  },
};
