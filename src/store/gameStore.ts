import { create } from 'zustand';
import type { Action, HexId, PlayerId } from '@/game/types';
import { applyAction } from '@/game/engine';
import { createGame, type CreateGameOptions } from '@/game/createGame';
import { getActingPlayerId } from '@/game/helpers';
import type { GameState } from '@/game/types';
import { useLogStore, type LogStoreSnapshot } from './logStore';

// Re-export the pure helper for callers used to importing it from the store.
export { getActingPlayerId };

// Optional broadcast hook — when the network layer is active it registers a
// function here so dispatched actions are sent to peers as a side effect.
// Kept here (rather than in networkStore) to avoid a circular module import.
let broadcastHandler: ((action: Action) => void) | null = null;
export function registerBroadcastHandler(fn: ((a: Action) => void) | null): void {
  broadcastHandler = fn;
}

// Some store behavior (pass-device handoff) needs to know if we're in an
// online session. Provide a hook for the network layer to set this.
let isOnlinePredicate: () => boolean = () => false;
export function registerOnlinePredicate(fn: () => boolean): void {
  isOnlinePredicate = fn;
}

export type UIMode =
  | { kind: 'idle' }
  | { kind: 'buildSettlement' }
  | { kind: 'buildCity' }
  | { kind: 'buildRoad' }
  | { kind: 'buildShip' }
  | { kind: 'placeSetupSettlement' }
  | { kind: 'placeSetupRoad' }
  | { kind: 'moveRobber' }
  | { kind: 'movePirate' }
  | { kind: 'roadBuilding'; remaining: 1 | 2 };

export type DialogName =
  | 'bankTrade'
  | 'playerTrade'
  | 'yearOfPlenty'
  | 'monopoly';

interface AppStore {
  game: GameState | null;
  uiMode: UIMode;
  dialog: DialogName | null;
  handoffPending: boolean;
  handoffAcknowledgedForPlayer: PlayerId | null;
  error: string | null;
  // When the user has clicked a hex during moveRobber and there are 2+ steal
  // candidates, this holds the chosen hex until the steal-target dialog
  // resolves and dispatches the actual moveRobber action.
  pendingRobberHex: HexId | null;
  // Pre-action snapshot for solo/hot-seat undo. Set after a successful
  // dispatch of one of UNDOABLE_ACTION_TYPES; cleared by any non-undoable
  // action, by undo, or by starting/resetting a game.
  // Bundles game state + log-store state so undo rewinds both together.
  lastActionSnapshot: { game: GameState; log: LogStoreSnapshot } | null;

  newGame: (opts: CreateGameOptions) => void;
  setGameState: (state: GameState) => void;
  resetGame: () => void;
  dispatch: (action: Action) => void;
  applyLocal: (action: Action) => void;
  undo: () => void;
  setMode: (mode: UIMode) => void;
  openDialog: (d: DialogName) => void;
  closeDialog: () => void;
  acknowledgeHandoff: () => void;
  dismissError: () => void;
  setPendingRobberHex: (hex: HexId | null) => void;
}

// Actions whose effects are local + reversible (no hidden info revealed, no
// turn boundary crossed). Only these create an undo snapshot. Undo is
// solo/hot-seat only — broadcasting an undo would require a wire protocol.
const UNDOABLE_ACTION_TYPES = new Set<Action['type']>([
  'buildRoad',
  'buildSettlement',
  'buildCity',
  'buyDevCard',
  'bankTrade',
]);

const phaseToMode = (state: GameState): UIMode => {
  if (state.phase === 'setupRound1' || state.phase === 'setupRound2') {
    return state.setupState?.step === 'settlement'
      ? { kind: 'placeSetupSettlement' }
      : { kind: 'placeSetupRoad' };
  }
  if (state.phase === 'moveRobber') return { kind: 'moveRobber' };
  if (state.phase === 'movePirate') return { kind: 'movePirate' };
  return { kind: 'idle' };
};

// Shared transition logic — called by both `dispatch` (local action) and
// `applyLocal` (action arriving over the network) so they keep the store
// in the same shape and fire the same handoff logic.
function applyTransition(
  set: (s: Partial<{
    game: GameState;
    uiMode: UIMode;
    dialog: null;
    error: null;
    handoffPending: boolean;
    handoffAcknowledgedForPlayer: PlayerId | null;
    pendingRobberHex: null;
  }>) => void,
  get: () => { handoffAcknowledgedForPlayer: PlayerId | null },
  before: GameState,
  next: GameState,
): void {
  const beforeActor = getActingPlayerId(before);
  const nextActor =
    next.phase === 'gameOver' ? beforeActor : getActingPlayerId(next);
  const nextActorPlayer = next.players.find((p) => p.id === nextActor);
  const online = isOnlinePredicate();
  // Pass-device handoff is for hot-seat only. AI never needs handoff.
  // Online sessions never use it — each player has their own device.
  const handoff =
    !online &&
    next.phase !== 'gameOver' &&
    beforeActor !== nextActor &&
    !nextActorPlayer?.isAI &&
    nextActor !== get().handoffAcknowledgedForPlayer;
  set({
    game: next,
    uiMode: phaseToMode(next),
    dialog: null,
    error: null,
    handoffPending: handoff,
    handoffAcknowledgedForPlayer: handoff
      ? get().handoffAcknowledgedForPlayer
      : nextActor,
    pendingRobberHex: null,
  });
}

export const useGameStore = create<AppStore>((set, get) => ({
  game: null,
  uiMode: { kind: 'idle' },
  dialog: null,
  handoffPending: false,
  handoffAcknowledgedForPlayer: null,
  error: null,
  pendingRobberHex: null,
  lastActionSnapshot: null,

  newGame: (opts) => {
    const game = createGame(opts);
    useLogStore.getState().reset(game);
    set({
      game,
      uiMode: phaseToMode(game),
      dialog: null,
      handoffPending: false,
      handoffAcknowledgedForPlayer: getActingPlayerId(game),
      error: null,
      pendingRobberHex: null,
      lastActionSnapshot: null,
    });
  },

  resetGame: () => {
    useLogStore.getState().reset();
    set({
      game: null,
      uiMode: { kind: 'idle' },
      dialog: null,
      handoffPending: false,
      handoffAcknowledgedForPlayer: null,
      error: null,
      pendingRobberHex: null,
      lastActionSnapshot: null,
    });
  },

  dispatch: (action) => {
    const before = get().game;
    if (!before) return;
    // Capture log snapshot BEFORE record(), so undo can rewind both stores.
    // Only matters for undoable actions — cheap enough to always do.
    const logBefore = useLogStore.getState().snapshot();
    try {
      const next = applyAction(before, action);
      useLogStore.getState().record(before, action, next);
      applyTransition(set, get, before, next);
      // Broadcast to peers only after local apply succeeds.
      if (broadcastHandler) broadcastHandler(action);
      // Update snapshot bookkeeping for undo (solo/hot-seat only).
      const solo = !isOnlinePredicate();
      if (solo && UNDOABLE_ACTION_TYPES.has(action.type)) {
        set({ lastActionSnapshot: { game: before, log: logBefore } });
      } else {
        set({ lastActionSnapshot: null });
      }
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  applyLocal: (action) => {
    const before = get().game;
    if (!before) return;
    try {
      const next = applyAction(before, action);
      useLogStore.getState().record(before, action, next);
      applyTransition(set, get, before, next);
      // Remote actions never produce an undo snapshot — clear any stale one.
      set({ lastActionSnapshot: null });
    } catch (e) {
      // Remote action failed locally — log but don't surface as user error.
      console.warn('[gameStore] applyLocal rejected action:', (e as Error).message);
    }
  },

  undo: () => {
    const snap = get().lastActionSnapshot;
    if (!snap) return;
    useLogStore.getState().restore(snap.log);
    set({
      game: snap.game,
      uiMode: phaseToMode(snap.game),
      dialog: null,
      error: null,
      pendingRobberHex: null,
      lastActionSnapshot: null,
    });
  },

  setGameState: (state) => {
    // Set on snapshot/rejoin — reset the log; we don't have history of the
    // pre-join actions.
    useLogStore.getState().reset(state);
    set({
      game: state,
      uiMode: phaseToMode(state),
      dialog: null,
      handoffPending: false,
      handoffAcknowledgedForPlayer: getActingPlayerId(state),
      error: null,
      pendingRobberHex: null,
      lastActionSnapshot: null,
    });
  },

  setMode: (mode) => set({ uiMode: mode, error: null }),
  openDialog: (d) => set({ dialog: d, error: null }),
  closeDialog: () => set({ dialog: null }),
  acknowledgeHandoff: () => {
    const game = get().game;
    if (!game) return;
    set({
      handoffPending: false,
      handoffAcknowledgedForPlayer: getActingPlayerId(game),
    });
  },
  dismissError: () => set({ error: null }),
  setPendingRobberHex: (hex) => set({ pendingRobberHex: hex }),
}));
