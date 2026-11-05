import type {
  BoostWagonAction,
  DriveOffBarbarianAction,
  GameState,
  MoveWagonAction,
  PlayerId,
  PlaySwiftJourneyAction,
  TbEvent,
  TbWagonTurn,
  UpgradeWagonAction,
} from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { rollDie } from '../../../rng';
import { addGold } from '../coins/gold';
import {
  TB_BOOST_COST,
  TB_BOOST_MP,
  TB_MAX_WAGON_LEVEL,
  TB_TOLL_GOLD,
  TB_WAGON_UPGRADE_COSTS,
} from './constants';
import {
  driveOffTargets,
  edgeBetween,
  isTradersBarbarians,
  legalWagonSteps,
  locationAtPlaza,
  patchTradersBarbarians,
  pushTbEvents,
  wagonLevelInfo,
  type TradersBarbariansGame,
} from './state';
import { openBarbarianMove } from './barbarians';

// The End of Turn phase ('wagonMoves', rulebook p. 23): move the wagon from
// intersection to intersection spending movement points, try to drive off
// barbarians next to it, deliver / pick up at a plaza. A second `endTurn`
// ("Done") passes the turn (hooks.ts).
//
// Wheat boost: the rules text says "Once per turn, you may also spend 1 wheat
// to increase your MPs by two", the player aid prints "+2 MP (up to 2×/turn)".
// The two agree if the limit is once per "Move your wagon" action: once in a
// normal turn, twice when a Swift Journey grants a second move action. That
// is what we implement.

export function freshWagonTurn(level: number, prior?: TbWagonTurn): TbWagonTurn {
  return {
    mp: wagonLevelInfo(level).mp,
    moveAction: prior ? 2 : 1,
    boosted: false,
    ended: false,
    steps: 0,
    triedBarbarians: prior?.triedBarbarians ?? [],
    swiftJourney: prior !== undefined,
  };
}

function assertWagonTurn(state: GameState, playerId: PlayerId): TradersBarbariansGame {
  if (!isTradersBarbarians(state)) throw new Error('No wagons in this game');
  if (state.phase !== 'wagonMoves') throw new Error('Wagons move in the End of Turn phase');
  if (playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!state.tradersBarbarians.wagonTurn) throw new Error('No wagon move in progress');
  if (!state.tradersBarbarians.wagons[playerId]) throw new Error('You have no wagon on the board');
  return state;
}

function patchTurn(state: TradersBarbariansGame, fn: (t: TbWagonTurn) => TbWagonTurn): TradersBarbariansGame {
  return patchTradersBarbarians(state, (tb) => ({ ...tb, wagonTurn: fn(tb.wagonTurn!) }));
}

export function handleMoveWagon(state: GameState, action: MoveWagonAction): GameState {
  const s = assertWagonTurn(state, action.playerId);
  const tb = s.tradersBarbarians;
  const turn = tb.wagonTurn!;
  if (turn.ended) throw new Error('Your wagon entered a plaza: its move is over');
  const wagon = tb.wagons[action.playerId]!;
  const edge = edgeBetween(s, wagon.vertex, action.to);
  if (!edge) throw new Error('The wagon moves along one edge at a time');
  const step = legalWagonSteps(s, action.playerId).find((st) => st.to === action.to);
  if (!step) {
    throw new Error(`Not enough movement points (or gold for the toll) to take that edge`);
  }
  const events: TbEvent[] = [];
  let next: TradersBarbariansGame = s;
  if (step.toll) {
    next = addGold(next, action.playerId, -TB_TOLL_GOLD) as TradersBarbariansGame;
    next = addGold(next, step.toll, TB_TOLL_GOLD) as TradersBarbariansGame;
    events.push({ kind: 'toll', playerId: action.playerId, owner: step.toll });
  }
  const location = locationAtPlaza(next, action.to);
  next = patchTradersBarbarians(next, (t) => ({
    ...t,
    wagons: { ...t.wagons, [action.playerId]: { ...t.wagons[action.playerId]!, vertex: action.to } },
    wagonTurn: { ...turn, mp: turn.mp - step.mp, steps: turn.steps + 1, ended: location !== undefined },
  }));
  if (location) next = arriveAtPlaza(next, action.playerId, events);
  return pushTbEvents(next, events);
}

// "When your wagon enters the central plaza of a commodity hex, its
// movement ends. Then you may deliver your commodity token if it is one that
// hex wants … Then, if you have room on your wagon board, draw the top
// facedown commodity token from the stack." Both are always to the player's
// advantage, so they happen automatically.
function arriveAtPlaza(
  state: TradersBarbariansGame,
  playerId: PlayerId,
  events: TbEvent[],
): TradersBarbariansGame {
  const wagon = state.tradersBarbarians.wagons[playerId]!;
  const location = locationAtPlaza(state, wagon.vertex)!;
  let next = state;
  if (wagon.cargo && location.needs.includes(wagon.cargo.good)) {
    const gold = wagonLevelInfo(wagon.level).deliveryGold;
    const good = wagon.cargo.good;
    next = patchTradersBarbarians(next, (tb) => ({
      ...tb,
      wagons: { ...tb.wagons, [playerId]: { ...wagon, cargo: null, delivered: wagon.delivered + 1 } },
    }));
    next = addGold(next, playerId, gold) as TradersBarbariansGame;
    events.push({ kind: 'deliver', playerId, good, location: location.id, gold });
  }
  const after = next.tradersBarbarians.wagons[playerId]!;
  if (after.cargo === null) {
    const loc = next.tradersBarbarians.locations.find((l) => l.id === location.id)!;
    const good = loc.stack[loc.stack.length - 1];
    if (good) {
      next = patchTradersBarbarians(next, (tb) => ({
        ...tb,
        locations: tb.locations.map((l) => (l.id === loc.id ? { ...l, stack: l.stack.slice(0, -1) } : l)),
        wagons: { ...tb.wagons, [playerId]: { ...after, cargo: { good, from: loc.id } } },
      }));
      events.push({ kind: 'pickUp', playerId, good, location: loc.id });
    } else {
      events.push({ kind: 'stackEmpty', playerId, location: loc.id });
    }
  }
  return next;
}

export function handleBoostWagon(state: GameState, action: BoostWagonAction): GameState {
  const s = assertWagonTurn(state, action.playerId);
  const turn = s.tradersBarbarians.wagonTurn!;
  if (turn.ended) throw new Error('Your wagon entered a plaza: its move is over');
  if (turn.boosted) throw new Error('You already spent wheat on this move');
  if (!canAfford(getPlayer(s, action.playerId).resources, TB_BOOST_COST)) {
    throw new Error('You need 1 wheat');
  }
  let next = updatePlayer(s, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, TB_BOOST_COST),
  })) as TradersBarbariansGame;
  next = { ...next, bank: addResources(next.bank, TB_BOOST_COST) };
  next = patchTurn(next, (t) => ({ ...t, mp: t.mp + TB_BOOST_MP, boosted: true }));
  return pushTbEvents(next, [{ kind: 'boost', playerId: action.playerId }]);
}

// "Pause your wagon on an intersection adjacent to a barbarian. Roll 1 die.
// If the number is part of the range shown in the current column of your
// wagon board, move the barbarian to any edge that does not already have a
// barbarian. … You may only attempt to drive off each individual barbarian
// once per turn." The die comes from the seeded RNG.
export function handleDriveOffBarbarian(state: GameState, action: DriveOffBarbarianAction): GameState {
  const s = assertWagonTurn(state, action.playerId);
  const tb = s.tradersBarbarians;
  const wagon = tb.wagons[action.playerId]!;
  const min = wagonLevelInfo(wagon.level).driveOffMin;
  if (min === null) throw new Error('Upgrade your wagon to drive off barbarians');
  if (tb.wagonTurn!.triedBarbarians.includes(action.barbarian)) {
    throw new Error('You already tried to drive off that barbarian this turn');
  }
  if (!driveOffTargets(s, action.playerId).includes(action.barbarian)) {
    throw new Error('Your wagon must stand next to that barbarian');
  }
  const [die, rng] = rollDie(s.rngState);
  const success = die >= min;
  let next: TradersBarbariansGame = patchTurn(
    { ...s, rngState: rng },
    (t) => ({ ...t, triedBarbarians: [...t.triedBarbarians, action.barbarian] }),
  );
  next = pushTbEvents(next, [
    { kind: 'driveOff', playerId: action.playerId, barbarian: action.barbarian, die, success },
  ]);
  if (success) next = openBarbarianMove(next, action.playerId, 'driveOff', 'wagonMoves', action.barbarian);
  return next;
}

// Upgrade the wagon (Action phase): pay the cost to the right of the cube.
export function handleUpgradeWagon(state: GameState, action: UpgradeWagonAction): GameState {
  if (!isTradersBarbarians(state)) throw new Error('No wagons in this game');
  if (state.phase !== 'main') throw new Error('Upgrade your wagon during your Action phase');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const wagon = state.tradersBarbarians.wagons[action.playerId];
  if (!wagon) throw new Error('You have no wagon on the board');
  if (wagon.level >= TB_MAX_WAGON_LEVEL) throw new Error('Your wagon is fully upgraded');
  const cost = TB_WAGON_UPGRADE_COSTS[wagon.level]!;
  if (!canAfford(getPlayer(state, action.playerId).resources, cost)) {
    throw new Error('You cannot afford the upgrade');
  }
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, cost),
  })) as TradersBarbariansGame;
  next = { ...next, bank: addResources(next.bank, cost) };
  next = patchTradersBarbarians(next, (tb) => ({
    ...tb,
    wagons: { ...tb.wagons, [action.playerId]: { ...wagon, level: wagon.level + 1 } },
  }));
  return pushTbEvents(next, [{ kind: 'upgrade', playerId: action.playerId, level: wagon.level + 1 }]);
}

// Swift Journey: "After you take a 'Move your wagon' action this turn, take
// that action again." Played in the End of Turn phase during the first move
// action; that move ends (leftover MP are lost, as always) and a fresh one
// starts with the wagon board's full MP. Counts as the turn's development
// card.
export function handlePlaySwiftJourney(state: GameState, action: PlaySwiftJourneyAction): GameState {
  const s = assertWagonTurn(state, action.playerId);
  const tb = s.tradersBarbarians;
  const held = tb.swiftJourney[action.playerId] ?? { unplayed: 0, boughtThisTurn: 0 };
  if (held.unplayed <= 0) {
    throw new Error(
      held.boughtThisTurn > 0
        ? 'You cannot play a card the turn you buy it'
        : 'You have no Swift Journey card',
    );
  }
  if (s.hasPlayedDevCardThisTurn) throw new Error('Already played a development card this turn');
  const turn = tb.wagonTurn!;
  if (turn.moveAction !== 1) throw new Error('You already took a second move');
  const wagon = tb.wagons[action.playerId]!;
  const next: TradersBarbariansGame = {
    ...s,
    hasPlayedDevCardThisTurn: true,
    tradersBarbarians: {
      ...tb,
      swiftJourney: { ...tb.swiftJourney, [action.playerId]: { ...held, unplayed: held.unplayed - 1 } },
      wagonTurn: freshWagonTurn(wagon.level, turn),
    },
  };
  return pushTbEvents(next, [{ kind: 'swiftJourney', playerId: action.playerId }]);
}
