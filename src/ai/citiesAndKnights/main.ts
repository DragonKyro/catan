import type { Action, GameState, PlayerId, VertexId } from '@/game/types';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { canPlaceSettlement } from '@/game/placement';
import { shouldAcceptTrade, tryProposeFavorableTrade, tryProposeTrade } from '../trade';
import { tryBankTrade } from '../main';
import { tryBuildRoadCK } from './roads';
import { vertexScore } from '../value';
import { firstLegal, handSizeCK, playerById } from './common';
import { barbarianOutlook, safeActiveStrength } from './barbarians';
import {
  tryBarbarianDefense,
  tryChaseRobber,
  tryDisplace,
  tryKnightUpkeep,
  tryMoveTowardRobber,
  trySparePromotion,
} from './knights';
import { tryBuildImprovement, tryBuildWall } from './improvements';
import {
  tryCommercialHarborPropose,
  tryCrane,
  tryEngineering,
  tryMedicine,
  tryPlayProgressCard,
} from './progress';
import { tryCommodityTrade, tryProposeCommodityTrade } from './trade';

export interface CKMainOptions {
  allowPlayerTrade?: boolean;
}

// City upgrade: the settlement whose hexes pay the most — commodity hexes
// count extra (ckVertexBonus inside vertexScore).
function tryBuildCity(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (p.settlements.length === 0 || p.cities.length >= 4) return null;
  const cost = state.medicineActive ? COSTS.cityMedicine : COSTS.city;
  if (!canAfford(p.resources, cost)) return null;
  if (cityWouldBePillaged(state, playerId)) return null;
  const ranked = [...p.settlements].sort(
    (a, b) => vertexScore(state, b, playerId) - vertexScore(state, a, playerId),
  );
  return firstLegal(
    state,
    ranked.map((vertex) => ({ type: 'buildCity' as const, playerId, vertex })),
  );
}

// The barbarians are probably landing before our next turn and the new
// city would be the one they take (we'd be the weakest defender): keep the
// cards for a knight first. A big hand builds anyway — a 7 would eat it.
function cityWouldBePillaged(state: GameState, playerId: PlayerId): boolean {
  const o = barbarianOutlook(state, playerId, 1);
  if (o.pAttackSoon < 0.3) return false;
  if (handSizeCK(playerById(state, playerId)) >= 8) return false;
  return o.myActive < safeActiveStrength(o);
}

function tryBuildSettlement(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (p.settlements.length >= 5 || !canAfford(p.resources, COSTS.settlement)) return null;
  const spots: Array<{ v: VertexId; s: number }> = [];
  for (const v of state.board.vertexIds) {
    if (canPlaceSettlement(state, playerId, v)) spots.push({ v, s: vertexScore(state, v, playerId) });
  }
  spots.sort((a, b) => b.s - a.s);
  return firstLegal(
    state,
    spots.slice(0, 4).map((x) => ({ type: 'buildSettlement' as const, playerId, vertex: x.v })),
  );
}

// The Cities & Knights Action-phase priority tree. One action per call; the
// driver calls again after it's applied. null = end the turn.
//
//   progress cards that pay off now → barbarian defence → chase the robber
//   → city (Medicine) → city improvement (Crane) → settlement → knight
//   upkeep → displacement → city wall (Engineering) → road → trades
export function chooseCKMainAction(
  state: GameState,
  playerId: PlayerId,
  opts: CKMainOptions = {},
): Action | null {
  const allowPlayerTrade = opts.allowPlayerTrade ?? true;

  // A pending trade involving us comes first (same as the base tree).
  if (state.pendingTrade) {
    if (state.pendingTrade.proposerId === playerId) return { type: 'cancelTrade', playerId };
    if (shouldAcceptTrade(state, playerId)) return { type: 'acceptTrade', playerId };
    return { type: 'cancelTrade', playerId };
  }

  return (
    tryCommercialHarborPropose(state, playerId) ??
    tryPlayProgressCard(state, playerId) ??
    tryBarbarianDefense(state, playerId) ??
    tryChaseRobber(state, playerId) ??
    tryMedicine(state, playerId) ??
    tryBuildCity(state, playerId) ??
    tryCrane(state, playerId) ??
    tryBuildImprovement(state, playerId) ??
    tryBuildSettlement(state, playerId) ??
    tryKnightUpkeep(state, playerId) ??
    tryDisplace(state, playerId) ??
    tryMoveTowardRobber(state, playerId) ??
    tryEngineering(state, playerId) ??
    tryBuildWall(state, playerId) ??
    tryBuildRoadCK(state, playerId) ??
    trySparePromotion(state, playerId) ??
    tryCommodityTrade(state, playerId) ??
    (allowPlayerTrade ? tryProposeCommodityTrade(state, playerId) : null) ??
    (allowPlayerTrade ? legalOrNull(state, tryProposeFavorableTrade(state, playerId)) : null) ??
    (allowPlayerTrade ? legalOrNull(state, tryProposeTrade(state, playerId)) : null) ??
    legalOrNull(state, tryBankTrade(state, playerId))
  );
}

function legalOrNull(state: GameState, a: Action | null): Action | null {
  return a ? firstLegal(state, [a]) : null;
}
