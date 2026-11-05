import type {
  DiscardAction,
  GameState,
  PlayerId,
  Resource,
  RollDiceAction,
} from '../../types';
import { RESOURCES } from '../../types';
import type { ActionHandler } from '../types';
import { currentPlayerId, updatePlayer } from '../../helpers';
import { startSevenResolution } from '../../actions/dice';
import { addGold } from '../traders/coins/gold';
import { EP_GOLD_FIELD_GOLD, EP_NOTHING_PRODUCED_GOLD } from './constants';
import { isExplorersPirates, patchEp, pushEpEvents, type EpGame } from './state';

// Production phase (Rulebook p. 8). As in CATAN, a hex produces for each
// building on it (harbor settlements collect like settlements). A captured
// gold field pays 2 gold per building. Anyone who gets nothing from the roll
// takes 1 gold instead. A 7: everyone with more than 7 cards discards half,
// then the roller activates their pirate ship (no robber).
//
// ASSUMPTION: the 1-gold consolation is paid on every roll but a 7 (a 7
// produces nothing — it is "Resolve a 7", not "Collect Resources"), to
// every player, and a player who got gold from a gold field did receive
// something.
export function handleEpRollDice(state: GameState, action: RollDiceAction): GameState {
  if (!isExplorersPirates(state)) throw new Error('Not an Explorers & Pirates game');
  if (state.phase !== 'rollOrPlayKnight') throw new Error(`Cannot roll dice in phase ${state.phase}`);
  if (state.hasRolledThisTurn) throw new Error('Already rolled this turn');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const [d1, d2] = action.dice;
  if (d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6) throw new Error('Invalid dice values');
  const total = d1 + d2;
  const rolled: EpGame = {
    ...state,
    hasRolledThisTurn: true,
    lastRoll: { dice: action.dice, total, player: action.playerId },
  };
  if (total === 7) return sevenToPirate(startSevenResolution(rolled));
  return produce(rolled, total);
}

function produce(state: EpGame, total: number): GameState {
  const ep = state.explorersPirates;
  const grants = new Map<PlayerId, Record<Resource, number>>();
  const gold: Record<PlayerId, number> = {};
  for (const p of state.players) {
    grants.set(p.id, { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
    gold[p.id] = 0;
  }
  for (const hex of Object.values(state.board.hexes)) {
    if (hex.numberToken !== total || ep.hidden[hex.id]) continue;
    const isGold = hex.terrain === 'gold';
    const isResource = (RESOURCES as readonly string[]).includes(hex.terrain);
    if (!isGold && !isResource) continue;
    if (isGold) {
      const lair = ep.lairs.find((l) => l.hex === hex.id);
      if (!lair?.captured || ep.pendingLairs.includes(hex.id)) continue;
    }
    for (const v of hex.corners) {
      for (const p of state.players) {
        if (!p.settlements.includes(v)) continue;
        if (isGold) gold[p.id]! += EP_GOLD_FIELD_GOLD;
        else grants.get(p.id)![hex.terrain as Resource] += 1;
      }
    }
  }
  // CATAN's shortage rule: a resource the supply can't pay in full goes to
  // nobody, unless only one player is owed it (they get what's left).
  for (const r of RESOURCES) {
    const owed = state.players.filter((p) => grants.get(p.id)![r] > 0);
    const demand = owed.reduce((n, p) => n + grants.get(p.id)![r], 0);
    if (demand <= state.bank[r]) continue;
    for (const p of owed) grants.get(p.id)![r] = owed.length > 1 ? 0 : state.bank[r];
  }
  let next: GameState = state;
  const consolation: Record<PlayerId, number> = {};
  for (const p of state.players) {
    const g = grants.get(p.id)!;
    const cards = RESOURCES.reduce((n, r) => n + g[r], 0);
    if (cards > 0) {
      next = updatePlayer(next, p.id, (pl) => {
        const resources = { ...pl.resources };
        for (const r of RESOURCES) resources[r] += g[r];
        return { ...pl, resources };
      });
      const bank = { ...next.bank };
      for (const r of RESOURCES) bank[r] -= g[r];
      next = { ...next, bank };
    }
    let coins = gold[p.id]!;
    if (cards === 0 && coins === 0) coins = EP_NOTHING_PRODUCED_GOLD;
    if (coins > 0) {
      next = addGold(next, p.id, coins);
      consolation[p.id] = coins;
    }
  }
  return pushEpEvents({ ...(next as EpGame), phase: 'main' }, [{ kind: 'production', total, gold: consolation }]);
}

export function withEpDiscard(inner: ActionHandler<DiscardAction>): ActionHandler<DiscardAction> {
  return (state, action) => {
    const next = inner(state, action);
    return isExplorersPirates(next) ? sevenToPirate(next) : next;
  };
}

// After the discards (or straight away) the base 7 would move the robber;
// here the roller activates their pirate ship.
function sevenToPirate(state: GameState): GameState {
  if (!isExplorersPirates(state)) return state;
  if (state.phase === 'discard') return state;
  if (state.phase !== 'moveRobber' && state.phase !== 'chooseRobberOrPirate' && state.phase !== 'movePirate') {
    return state;
  }
  return openPirateActivation(
    { ...state, pendingRobberMove: undefined },
    currentPlayerId(state),
    'seven',
    'main',
  );
}

export function openPirateActivation(
  state: EpGame,
  playerId: PlayerId,
  reason: 'seven' | 'chase',
  returnTo: 'main' | 'epMovement',
): EpGame {
  return patchEp({ ...state, phase: 'epPlacePirate' }, (ep) => ({
    ...ep,
    pendingPirate: { playerId, reason, returnTo },
  }));
}
