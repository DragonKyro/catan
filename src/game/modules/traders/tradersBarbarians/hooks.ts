import type {
  BuyDevCardAction,
  DiscardAction,
  EndTurnAction,
  GameState,
  PlaceInitialSettlementAction,
  PlayKnightAction,
  RollDiceAction,
  TbEvent,
} from '../../../types';
import { COSTS } from '../../../types';
import type { ActionHandler } from '../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { rollDice } from '../../../rng';
import { handleEndTurn as baseHandleEndTurn } from '../../../actions/turn';
import { isTradersBarbarians, patchTradersBarbarians, pushTbEvents, type TradersBarbariansGame } from './state';
import { openBarbarianMove } from './barbarians';
import { freshWagonTurn } from './wagon';

// Traders & Barbarians scenario hooks around the T&B / base handlers. Each
// wrapper passes straight through to the wrapped handler outside the
// scenario.

// "When you roll a 2 or a 12 during your Production phase, reroll the
// dice." The re-roll uses the seeded RNG so every peer agrees. A 7 has no
// robber: after the discards the roller moves a barbarian.
export function withTbRoll(inner: ActionHandler<RollDiceAction>): ActionHandler<RollDiceAction> {
  return (state, action) => {
    if (!isTradersBarbarians(state)) return inner(state, action);
    let dice = action.dice;
    let rng = state.rngState;
    const rerolled: Array<[number, number]> = [];
    while (dice[0] + dice[1] === 2 || dice[0] + dice[1] === 12) {
      rerolled.push(dice);
      [dice, rng] = rollDice(rng);
    }
    const next = sevenToBarbarian(inner({ ...state, rngState: rng }, { ...action, dice }));
    if (rerolled.length === 0 || !isTradersBarbarians(next)) return next;
    return pushTbEvents(next, [{ kind: 'reroll', playerId: action.playerId, dice, rerolled }]);
  };
}

export function withTbDiscard(inner: ActionHandler<DiscardAction>): ActionHandler<DiscardAction> {
  return (state, action) => sevenToBarbarian(inner(state, action));
}

// The base 7 lands in 'moveRobber' (straight away or after the last
// discard); here that step moves a barbarian instead.
function sevenToBarbarian(state: GameState): GameState {
  if (!isTradersBarbarians(state) || state.phase !== 'moveRobber') return state;
  return openBarbarianMove(state, currentPlayerId(state), 'seven', 'main');
}

// "When placing your starting pieces, your second placement is a city …
// Place your wagon on the intersection with your city." The base handler
// already pays 1 resource per adjacent hex for the second placement.
export function withTbSetupCity(
  inner: ActionHandler<PlaceInitialSettlementAction>,
): ActionHandler<PlaceInitialSettlementAction> {
  return (state, action) => {
    const secondPlacement = state.phase === 'setupRound2';
    const next = inner(state, action);
    if (!isTradersBarbarians(next) || !secondPlacement) return next;
    const asCity = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      settlements: p.settlements.filter((v) => v !== action.vertex),
      cities: [...p.cities, action.vertex],
    })) as TradersBarbariansGame;
    return patchTradersBarbarians(asCity, (tb) => ({
      ...tb,
      wagons: {
        ...tb.wagons,
        [action.playerId]: { vertex: action.vertex, level: 1, cargo: null, delivered: 0 },
      },
    }));
  };
}

// The scenario's own 25-card deck replaces the base development cards.
// Normal buy rules: the card is hidden and can't be played the turn it is
// bought (VP cards count at once, revealed when they win the game).
export function withTbDevCards(inner: ActionHandler<BuyDevCardAction>): ActionHandler<BuyDevCardAction> {
  return (state, action) => {
    if (!isTradersBarbarians(state)) return inner(state, action);
    if (state.phase !== 'main') throw new Error(`Cannot buy dev card in phase ${state.phase}`);
    if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
    const tb = state.tradersBarbarians;
    if (tb.deck.length === 0) throw new Error('Dev card deck is empty');
    if (!canAfford(getPlayer(state, action.playerId).resources, COSTS.devCard)) {
      throw new Error('Cannot afford dev card');
    }
    const card = tb.deck[tb.deck.length - 1]!;
    let next = updatePlayer(state, action.playerId, (p) => {
      const resources = subtractResources(p.resources, COSTS.devCard);
      if (card === 'swiftJourney') return { ...p, resources };
      if (card === 'victoryPoint') {
        return { ...p, resources, devCards: { ...p.devCards, victoryPoints: p.devCards.victoryPoints + 1 } };
      }
      return {
        ...p,
        resources,
        devCards: { ...p.devCards, boughtThisTurn: [...p.devCards.boughtThisTurn, card] },
      };
    }) as TradersBarbariansGame;
    next = { ...next, bank: addResources(next.bank, COSTS.devCard) };
    return patchTradersBarbarians(next, (t) => {
      const held = t.swiftJourney[action.playerId] ?? { unplayed: 0, boughtThisTurn: 0 };
      return {
        ...t,
        deck: t.deck.slice(0, -1),
        swiftJourney:
          card === 'swiftJourney'
            ? { ...t.swiftJourney, [action.playerId]: { ...held, boughtThisTurn: held.boughtThisTurn + 1 } }
            : t.swiftJourney,
      };
    });
  };
}

// Knight: "Move 1 barbarian to an edge without a barbarian. If you place it
// on a road, steal 1 random resource card from the road's owner." Played
// like a base Knight (one development card a turn, not the turn it was
// bought, counts toward Largest Army) at any point of your turn — before
// the roll, in the Action phase or while your wagon moves.
export function withTbKnight(inner: ActionHandler<PlayKnightAction>): ActionHandler<PlayKnightAction> {
  return (state, action) => {
    if (!isTradersBarbarians(state)) return inner(state, action);
    if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
    if (state.hasPlayedDevCardThisTurn) throw new Error('Already played a development card this turn');
    const phase = state.phase;
    if (phase !== 'rollOrPlayKnight' && phase !== 'main' && phase !== 'wagonMoves') {
      throw new Error(`Cannot play dev card in phase ${phase}`);
    }
    const unplayed = getPlayer(state, action.playerId).devCards.unplayed;
    const idx = unplayed.indexOf('knight');
    if (idx < 0) throw new Error('You have no knight card to play');
    const next = updatePlayer(state, action.playerId, (p) => ({
      ...p,
      devCards: {
        ...p.devCards,
        unplayed: [...unplayed.slice(0, idx), ...unplayed.slice(idx + 1)],
        playedKnights: p.devCards.playedKnights + 1,
      },
    })) as TradersBarbariansGame;
    return openBarbarianMove({ ...next, hasPlayedDevCardThisTurn: true }, action.playerId, 'knight', phase);
  };
}

// End of turn: "After you finish your Action phase, you may move your
// wagon." `endTurn` in the Action phase opens 'wagonMoves'; `endTurn` there
// ("Done") passes the turn.
export function withTbEndTurn(inner: ActionHandler<EndTurnAction>): ActionHandler<EndTurnAction> {
  return (state, action) => {
    if (!isTradersBarbarians(state)) return inner(state, action);
    if (state.phase === 'main') {
      if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
      if (!state.hasRolledThisTurn) throw new Error('Must roll dice before ending turn');
      const wagon = state.tradersBarbarians.wagons[action.playerId];
      if (!wagon) return finishTurn(state, action);
      return patchTradersBarbarians(
        { ...state, phase: 'wagonMoves', pendingTrade: undefined },
        (tb) => ({ ...tb, wagonTurn: freshWagonTurn(wagon.level) }),
      );
    }
    if (state.phase === 'wagonMoves') {
      if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
      return finishTurn(state, action);
    }
    return inner(state, action);
  };
}

function finishTurn(state: TradersBarbariansGame, action: EndTurnAction): GameState {
  const tb = state.tradersBarbarians;
  const events: TbEvent[] = [];
  const steps = tb.wagonTurn ? tb.wagonTurn.steps : 0;
  if (tb.wagonTurn) events.push({ kind: 'wagonDone', playerId: action.playerId, steps });
  const held = tb.swiftJourney[action.playerId];
  let next: TradersBarbariansGame = {
    ...state,
    phase: 'main',
    tradersBarbarians: {
      ...tb,
      wagonTurn: undefined,
      swiftJourney:
        held && held.boughtThisTurn > 0
          ? {
              ...tb.swiftJourney,
              [action.playerId]: { unplayed: held.unplayed + held.boughtThisTurn, boughtThisTurn: 0 },
            }
          : tb.swiftJourney,
    },
  };
  next = pushTbEvents(next, events);
  return baseHandleEndTurn(next, action);
}
