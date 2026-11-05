import type { Action, GameState, PlayerId } from '@/game/types';
import { isPairedPlayer2 } from '@/game/helpers';
import { firstLegal } from './common';
import { cheapestCards, mostWantedResource } from './value';
import { chooseRobberMoveCK } from './robber';
import { chooseCKMainAction } from './main';
import {
  chooseDisplacedKnightMove,
  choosePillagedCity,
  chooseTreasonPlacement,
  chooseTreasonRemoval,
} from './knights';
import { chooseMetropolisVertex } from './improvements';
import {
  chooseAlchemy,
  chooseCommercialHarborReply,
  chooseDefenderTieDraw,
  chooseMerchantHex,
  chooseProgressDiscard,
  chooseProgressPick,
  chooseRemoveRoad,
  chooseWeddingGive,
} from './progress';

export { isCitiesAndKnights } from './common';

// Cities & Knights decisions. Returns:
//   - an Action to dispatch,
//   - null  = "end the turn" (Action phase, nothing worth doing),
//   - undefined = not a C&K decision; the base AI handles it (setup).
export function chooseCitiesAndKnightsAction(
  state: GameState,
  playerId: PlayerId,
  rollDice: () => [number, number],
): Action | null | undefined {
  switch (state.phase) {
    case 'defenderTieDraw':
      return chooseDefenderTieDraw(state, playerId);
    case 'choosePillage':
      return choosePillagedCity(state, playerId);
    case 'rollOrPlayKnight': {
      const alchemy = chooseAlchemy(state, playerId);
      if (alchemy) return alchemy;
      return { type: 'rollDice', playerId, dice: rollDice() };
    }
    case 'discard': {
      // (0 is possible: Sabotage halves a 1-card hand to nothing.)
      const required = state.discardState?.required[playerId];
      if (required === undefined) return null;
      const pick = cheapestCards(state, playerId, required);
      return { type: 'discardCK', playerId, resources: pick.resources, commodities: pick.commodities };
    }
    case 'moveRobber':
      return chooseRobberMoveCK(state, playerId);
    case 'main':
      // 5+ players: the paired turn's Player 2 trades only with the bank.
      return chooseCKMainAction(state, playerId, { allowPlayerTrade: !isPairedPlayer2(state) });
    case 'displacedKnightMove':
      return chooseDisplacedKnightMove(state, playerId);
    case 'placeMetropolis':
      return chooseMetropolisVertex(state, playerId);
    case 'aqueductPick': {
      const r = mostWantedResource(state, playerId);
      return r ? firstLegal(state, [{ type: 'aqueductPick', playerId, resource: r }]) : null;
    }
    case 'progressCardDiscard':
      return chooseProgressDiscard(state, playerId);
    case 'chooseProgressCardPick':
      return chooseProgressPick(state, playerId);
    case 'placeMerchant':
      return chooseMerchantHex(state, playerId);
    case 'removeRoad':
      return chooseRemoveRoad(state, playerId);
    case 'treasonRemoveKnight':
      return chooseTreasonRemoval(state, playerId);
    case 'treasonPlaceKnight':
      return chooseTreasonPlacement(state, playerId);
    case 'commercialHarborOffer':
      return chooseCommercialHarborReply(state, playerId);
    case 'weddingGive':
      return chooseWeddingGive(state, playerId);
    default:
      // Setup and anything the base AI already answers.
      return undefined;
  }
}
