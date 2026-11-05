import type { EndTurnAction, GameState, MoveBarbarianKnightAction } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { handleEndTurn as baseHandleEndTurn } from '../../../actions/turn';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { calculateVictoryPoints } from '../../../scoring/points';
import { BARBARIAN_KNIGHT_BOOST_COST } from '../constants';
import { isBarbarianAttack, patchBarbarianAttack, type BarbarianAttackGame } from './state';
import { knightMoveTargets, knightsThatMustMove, playerKnightEdges } from './knights';
import { expelBarbarians } from './expel';

// Barbarian Attack end of turn (rulebook p.17): "After you finish your Action
// phase, you may move your knights. Then expel the barbarians from Catan."
//
// `endTurn` in the main phase opens the 'barbarianKnightMoves' step when the
// player has a knight on the board (otherwise it expels straight away). In
// that step the player moves knights with `moveBarbarianKnight`; a second
// `endTurn` ("Done") expels the barbarians and passes the turn. A knight on a
// castle edge must move before the turn can end.
export function handleEndTurnBarbarianAttack(state: GameState, action: EndTurnAction): GameState {
  if (!isBarbarianAttack(state)) return baseHandleEndTurn(state, action);
  if (state.phase === 'main') {
    if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
    if (!state.hasRolledThisTurn) throw new Error('Must roll dice before ending turn');
    if (playerKnightEdges(state, action.playerId).length > 0) {
      return {
        ...patchBarbarianAttack(state, (ba) => ({ ...ba, movedKnights: [] })),
        phase: 'barbarianKnightMoves',
        pendingTrade: undefined,
      };
    }
    return finishTurn(state, action);
  }
  if (state.phase === 'barbarianKnightMoves') {
    if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
    if (knightsThatMustMove(state, action.playerId).length > 0) {
      throw new Error('Your knight on a castle edge must move first');
    }
    return finishTurn(state, action);
  }
  return baseHandleEndTurn(state, action);
}

function finishTurn(state: BarbarianAttackGame, action: EndTurnAction): GameState {
  let next = expelBarbarians(state, action.playerId) as BarbarianAttackGame;
  next = {
    ...patchBarbarianAttack(next, (ba) => ({ ...ba, movedKnights: undefined })),
    phase: 'main',
  };
  // Prisoners taken (or buildings liberated) during your own End of turn
  // phase can win the game before the turn passes.
  if (calculateVictoryPoints(next, action.playerId, true) >= next.settings.victoryPointsToWin) {
    return { ...next, winner: action.playerId, phase: 'gameOver' };
  }
  return baseHandleEndTurn(next, action);
}

export function handleMoveBarbarianKnight(
  state: GameState,
  action: MoveBarbarianKnightAction,
): GameState {
  if (!isBarbarianAttack(state)) throw new Error('Barbarian Attack is not active');
  if (state.phase !== 'barbarianKnightMoves') {
    throw new Error('Knights move at the end of your turn');
  }
  const pid = action.playerId;
  if (pid !== currentPlayerId(state)) throw new Error('Not your turn');
  const ba = state.barbarianAttack;
  if (ba.knights[action.from] !== pid) throw new Error('No knight of yours there');
  if ((ba.movedKnights ?? []).includes(action.from)) {
    throw new Error('That knight already moved this turn');
  }
  const target = knightMoveTargets(state, action.from).find((t) => t.edge === action.to);
  if (!target) {
    throw new Error(
      'A knight moves up to 3 edges (5 for 1 wheat) and must end on an edge without a knight, not on the castle',
    );
  }
  let next: GameState = state;
  if (target.boost) {
    if (!action.boost) throw new Error('Moving 4 or 5 edges costs 1 wheat');
    if (!canAfford(getPlayer(state, pid).resources, BARBARIAN_KNIGHT_BOOST_COST)) {
      throw new Error('You need 1 wheat to move a knight 4 or 5 edges');
    }
    next = updatePlayer(next, pid, (p) => ({
      ...p,
      resources: subtractResources(p.resources, BARBARIAN_KNIGHT_BOOST_COST),
    }));
    next = { ...next, bank: addResources(next.bank, BARBARIAN_KNIGHT_BOOST_COST) };
  }
  const knights = { ...ba.knights };
  delete knights[action.from];
  knights[action.to] = pid;
  return {
    ...next,
    barbarianAttack: {
      ...ba,
      knights,
      movedKnights: [...(ba.movedKnights ?? []), action.to],
    },
  };
}
