import type { GameState, MoveTbBarbarianAction, PlayerId, Resource, TbEvent } from '../../../types';
import { RESOURCES } from '../../../types';
import { rngInt } from '../../../rng';
import { stealResource } from '../actions/spendFish';
import {
  barbarianTargetEdges,
  isTradersBarbarians,
  pushTbEvents,
  roadOwner,
  type TradersBarbariansGame,
} from './state';

// Barbarians stand on edges. A 7 (after discards), a Knight card or a
// successful drive-off opens phase 'moveBarbarian'; `moveTbBarbarian` puts
// one barbarian on an edge without a barbarian. After a 7 or a Knight, a
// barbarian put on a road robs the road's owner of 1 random resource card
// (not after a drive-off: "Do not steal a resource card").

// Open the barbarian step. `returnTo` is the phase play resumes in.
export function openBarbarianMove(
  state: TradersBarbariansGame,
  playerId: PlayerId,
  reason: 'seven' | 'knight' | 'driveOff',
  returnTo: 'rollOrPlayKnight' | 'main' | 'wagonMoves',
  barbarian?: number,
): TradersBarbariansGame {
  return {
    ...state,
    phase: 'moveBarbarian',
    pendingRobberMove: undefined,
    tradersBarbarians: {
      ...state.tradersBarbarians,
      pendingBarbarian: {
        playerId,
        reason,
        returnTo,
        ...(barbarian !== undefined ? { barbarian } : {}),
      },
    },
  };
}

export function handleMoveTbBarbarian(state: GameState, action: MoveTbBarbarianAction): GameState {
  if (!isTradersBarbarians(state)) throw new Error('No barbarians on edges in this game');
  if (state.phase !== 'moveBarbarian') throw new Error(`Cannot move a barbarian in phase ${state.phase}`);
  const tb = state.tradersBarbarians;
  const pending = tb.pendingBarbarian;
  if (!pending) throw new Error('No barbarian move pending');
  if (action.playerId !== pending.playerId) throw new Error('Not your barbarian to move');
  const idx = action.barbarian;
  if (!Number.isInteger(idx) || idx < 0 || idx >= tb.barbarians.length) {
    throw new Error('Unknown barbarian');
  }
  if (pending.barbarian !== undefined && idx !== pending.barbarian) {
    throw new Error('Move the barbarian you drove off');
  }
  if (!barbarianTargetEdges(state).includes(action.edge)) {
    throw new Error('A barbarian must go to an edge without a barbarian');
  }
  const from = tb.barbarians[idx]!;
  const barbarians = [...tb.barbarians];
  barbarians[idx] = action.edge;
  let next: TradersBarbariansGame = {
    ...state,
    phase: pending.returnTo,
    tradersBarbarians: { ...tb, barbarians, pendingBarbarian: undefined },
  };
  const event: Extract<TbEvent, { kind: 'barbarianMoved' }> = {
    kind: 'barbarianMoved',
    playerId: action.playerId,
    reason: pending.reason,
    barbarian: idx,
    from,
    to: action.edge,
  };
  if (pending.reason !== 'driveOff') {
    const owner = roadOwner(state, action.edge);
    if (owner && owner !== action.playerId) {
      event.victim = owner;
      const [after, stole] = stealRandomCard(next, action.playerId, owner);
      next = after as TradersBarbariansGame;
      event.stole = stole;
    }
  }
  return pushTbEvents(next, [event]);
}

// Take 1 random resource card (seeded) from `victimId`.
function stealRandomCard(
  state: GameState,
  thiefId: PlayerId,
  victimId: PlayerId,
): [GameState, boolean] {
  const victim = state.players.find((p) => p.id === victimId);
  if (!victim) return [state, false];
  const cards: Resource[] = [];
  for (const r of RESOURCES) for (let i = 0; i < victim.resources[r]; i++) cards.push(r);
  if (cards.length === 0) return [state, false];
  const [i, rng] = rngInt(state.rngState, cards.length);
  return [stealResource({ ...state, rngState: rng }, thiefId, victimId, cards[i]!), true];
}
