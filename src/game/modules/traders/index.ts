import type { RuleModule, ModuleValidators } from '../types';
import type { GameState, MoveRobberAction } from '../../types';
import { handleBuildBridge } from './actions/buildBridge';
import { handleBuildRoadWithRiverGold } from './actions/buildRoad';
import { handleBuildSettlementWithRiverGold } from './actions/buildSettlement';
import { handleBuildCityWithStrongestPortsRefresh } from './actions/buildCity';
import { handlePlaceInitialSettlementWithRiverGold } from './actions/placeInitialSettlement';
import { handlePlaceInitialRoadWithRiverGold } from './actions/placeInitialRoad';
import { handleSpendFish } from './actions/spendFish';
import { handlePassOldBoot } from './actions/passOldBoot';
import {
  handleSubmitWagonVote,
  handleAssignWagonVotes,
  handlePlaceWagon,
} from './merchantTrains/voting';
import { handleEndTurnTraders } from './turn';
import {
  handleBuyDevCardTraders,
  handleDiscardBarbarianAttack,
  handleRollDiceBarbarianAttack,
  withBarbarianLandingOnCity,
  withBarbarianLandingOnSettlement,
  withBarbarianSetupCity,
} from './barbarianAttack/hooks';
import { handleResolveBarbarianCard } from './barbarianAttack/cards';
import { handleMoveBarbarianKnight } from './barbarianAttack/turn';
import { handleStealResource } from '../seafarers/pirateIslands';
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
    buildSettlement: withBarbarianLandingOnSettlement(handleBuildSettlementWithRiverGold) as never,
    buildCity: withBarbarianLandingOnCity(handleBuildCityWithStrongestPortsRefresh) as never,
    placeInitialSettlement: withBarbarianSetupCity(handlePlaceInitialSettlementWithRiverGold) as never,
    placeInitialRoad: handlePlaceInitialRoadWithRiverGold as never,
    spendFish: handleSpendFish as never,
    passOldBoot: handlePassOldBoot as never,
    submitWagonVote: handleSubmitWagonVote as never,
    assignWagonVotes: handleAssignWagonVotes as never,
    placeWagon: handlePlaceWagon as never,
    endTurn: handleEndTurnTraders as never,
    // Barbarian Attack (each passes through to base outside the scenario).
    rollDice: handleRollDiceBarbarianAttack as never,
    discard: handleDiscardBarbarianAttack as never,
    buyDevCard: handleBuyDevCardTraders as never,
    stealResource: handleStealResource as never,
    resolveBarbarianCard: handleResolveBarbarianCard as never,
    moveBarbarianKnight: handleMoveBarbarianKnight as never,
  },
  validators: {
    // (The Friendly Robber variant has its own module — see ./variants.)
    moveRobber: combineRobberValidators(
      validateMoveRobberFishingScenario,
    ),
  },
};

// Compose multiple moveRobber validators into a single function. First
// non-null return wins. Lets T&B stack the Friendly Robber variant on top
// of any scenario-specific bans (e.g. the lake produces fish so the robber
// CAN sit on it, but only when active — already handled by base rules —
// while a hypothetical future scenario could veto specific hex ids here).
function combineRobberValidators(
  ...vs: NonNullable<ModuleValidators['moveRobber']>[]
): NonNullable<ModuleValidators['moveRobber']> {
  return (state, action) => {
    for (const v of vs) {
      const err = v(state, action);
      if (err) return err;
    }
    return null;
  };
}

// Fishing on Catan: the robber may sit on the lake (rulebook explicitly
// allows this — it blocks lake production). The "no fishing grounds"
// clause is naturally enforced because our model anchors fishing grounds
// to vertices, not hexes — the robber never sits on a vertex.
//
// Left as a stub for now so future scenarios (Barbarian Attack's castle
// hex, Merchant Trains' watering hole) can plug in additional bans here.
function validateMoveRobberFishingScenario(
  _state: GameState,
  _action: MoveRobberAction,
): string | null {
  return null;
}
