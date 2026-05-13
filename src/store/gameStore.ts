import { create } from 'zustand';
import type { Action, HexId, PlayerId } from '@/game/types';
import { applyAction } from '@/game/engine';
import { createGame, type CreateGameOptions } from '@/game/createGame';
import { getActingPlayerId } from '@/game/helpers';
import type { GameState } from '@/game/types';

// Re-export the pure helper for callers used to importing it from the store.
export { getActingPlayerId };

export type UIMode =
  | { kind: 'idle' }
  | { kind: 'buildSettlement' }
  | { kind: 'buildCity' }
  | { kind: 'buildRoad' }
  | { kind: 'placeSetupSettlement' }
  | { kind: 'placeSetupRoad' }
  | { kind: 'moveRobber' }
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

  newGame: (opts: CreateGameOptions) => void;
  resetGame: () => void;
  dispatch: (action: Action) => void;
  setMode: (mode: UIMode) => void;
  openDialog: (d: DialogName) => void;
  closeDialog: () => void;
  acknowledgeHandoff: () => void;
  dismissError: () => void;
  setPendingRobberHex: (hex: HexId | null) => void;
}

const phaseToMode = (state: GameState): UIMode => {
  if (state.phase === 'setupRound1' || state.phase === 'setupRound2') {
    return state.setupState?.step === 'settlement'
      ? { kind: 'placeSetupSettlement' }
      : { kind: 'placeSetupRoad' };
  }
  if (state.phase === 'moveRobber') return { kind: 'moveRobber' };
  return { kind: 'idle' };
};

export const useGameStore = create<AppStore>((set, get) => ({
  game: null,
  uiMode: { kind: 'idle' },
  dialog: null,
  handoffPending: false,
  handoffAcknowledgedForPlayer: null,
  error: null,
  pendingRobberHex: null,

  newGame: (opts) => {
    const game = createGame(opts);
    set({
      game,
      uiMode: phaseToMode(game),
      dialog: null,
      handoffPending: false,
      handoffAcknowledgedForPlayer: getActingPlayerId(game),
      error: null,
      pendingRobberHex: null,
    });
  },

  resetGame: () => set({
    game: null,
    uiMode: { kind: 'idle' },
    dialog: null,
    handoffPending: false,
    handoffAcknowledgedForPlayer: null,
    error: null,
    pendingRobberHex: null,
  }),

  dispatch: (action) => {
    const before = get().game;
    if (!before) return;
    try {
      const next = applyAction(before, action);
      const beforeActor = getActingPlayerId(before);
      const nextActor = next.phase === 'gameOver' ? beforeActor : getActingPlayerId(next);
      const nextActorPlayer = next.players.find((p) => p.id === nextActor);
      // Only fire pass-device handoff when the next actor is a human and we
      // genuinely changed actors. AI players never need a handoff.
      const handoff =
        next.phase !== 'gameOver' &&
        beforeActor !== nextActor &&
        !nextActorPlayer?.isAI &&
        nextActor !== get().handoffAcknowledgedForPlayer;
      // Preserve playerTrade dialog through dispatch when proposer's trade
      // was just created and we want them to keep it open. For now always
      // clear on dispatch — caller can re-open if needed.
      set({
        game: next,
        uiMode: phaseToMode(next),
        dialog: null,
        error: null,
        handoffPending: handoff,
        handoffAcknowledgedForPlayer: handoff ? get().handoffAcknowledgedForPlayer : nextActor,
        pendingRobberHex: null,
      });
    } catch (e) {
      set({ error: (e as Error).message });
    }
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
