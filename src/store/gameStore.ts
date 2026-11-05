import { create } from 'zustand';
import type { Action, BarbarianTreasonMove, EdgeId, HexId, PlayerId, VertexId } from '@/game/types';
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
  // Seafarers: move one ship — pick the ship, then where it goes.
  | { kind: 'moveShip'; from?: EdgeId }
  // Seafarers / Forgotten Tribe: place a port taken from the tribe.
  | { kind: 'placeTribePort' }
  // Traders & Barbarians — picking a river edge to span with a bridge.
  | { kind: 'buildBridge' }
  // Traders & Barbarians / Merchant Trains — placing a trade wagon after a
  // vote resolution that named a placer (no clear vote-winner edge).
  | { kind: 'placeWagon' }
  // Traders & Barbarians / Barbarian Attack — the choice for a card just
  // bought (Capture hex / knight edge), Treason's barbarian moves (picked
  // one hex at a time: `from` set = choosing where it goes; null = from the
  // supply), and the end-of-turn knight moves (`from` = the picked knight).
  | { kind: 'baCard' }
  | { kind: 'baTreason'; moves: BarbarianTreasonMove[]; from?: HexId | null }
  | { kind: 'baKnightMove'; from?: EdgeId }
  // Cities & Knights — picking which of your own cities to put a wall under.
  | { kind: 'buildCityWall' }
  // Cities & Knights knight build/action modes.
  | { kind: 'recruitKnight' }
  | { kind: 'activateKnight' }
  | { kind: 'promoteKnight' }
  // Two-click flow: source own active knight, then destination empty vertex.
  | { kind: 'moveKnight'; sourceVertex?: VertexId }
  | { kind: 'displaceKnight'; sourceVertex?: VertexId }
  // Forced move of a displaced knight (kicks in via state.pendingKnightMove).
  | { kind: 'displacedKnightMove' }
  | { kind: 'chaseRobber' }
  // Cities & Knights — placing a metropolis (one of the player's cities).
  | { kind: 'placeMetropolis' }
  // Cities & Knights / Merchant card — pick a land hex adjacent to one of
  // your buildings.
  | { kind: 'placeMerchant' }
  // Cities & Knights / Diplomacy — pick an open road to remove.
  | { kind: 'removeRoad' }
  // Cities & Knights / Invention — pick two number-token hexes to swap.
  | { kind: 'swapTokens'; firstHex?: HexId }
  | { kind: 'placeSetupSettlement' }
  | { kind: 'placeSetupRoad' }
  | { kind: 'moveRobber' }
  | { kind: 'movePirate' }
  // While the user is placing the 2 free pieces from a Road Building card,
  // the FIRST click is buffered in `first` and the action is dispatched
  // only on the SECOND click (with both pieces). This is required because
  // the engine consumes the card up front — splitting the placement across
  // two playRoadBuilding actions would try to consume the card twice.
  // Seafarers: each piece may be a road or a ship.
  | { kind: 'roadBuilding'; remaining: 1 | 2; first?: { edge: EdgeId; ship: boolean } };

export type DialogName =
  | 'bankTrade'
  | 'playerTrade'
  | 'yearOfPlenty'
  | 'monopoly'
  | 'wonders'
  // Traders & Barbarians / Fishing on Catan
  | 'spendFish'
  | 'passBoot'
  // Cities & Knights dialogs.
  | 'cityImprovements'
  | 'progressCards'
  | 'alchemy'
  | 'smithing'
  | 'merchantFleet'
  | 'tradeMonopoly'
  | 'resourceMonopolyCK'
  | 'metropolisPlace'
  | 'progressCardPick'
  | 'treasonRemove'
  | 'treasonPlace'
  | 'commercialHarborOffer'
  | 'weddingGive'
  | 'progressCardDiscard'
  | 'defenderTieDraw'
  | 'aqueductPick';

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
  // Same for the pirate (Seafarers): the clicked sea hex while the player
  // picks whom to rob.
  pendingPirateHex: HexId | null;
  // Pre-action snapshot for solo/hot-seat undo. Set after a successful
  // dispatch of one of UNDOABLE_ACTION_TYPES; cleared by any non-undoable
  // action, by undo, or by starting/resetting a game.
  // Bundles game state + log-store state so undo rewinds both together.
  lastActionSnapshot: { game: GameState; log: LogStoreSnapshot } | null;
  // The most-recent dice token to highlight on the board (production
  // pulse). null when nothing should pulse. Cleared by a timeout in
  // BoardSVG ~1.5s after a roll. Excluded from network sync — each
  // peer sets it locally when it sees the rollDice action.
  lastRolledHighlight: number | null;

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
  setPendingPirateHex: (hex: HexId | null) => void;
  setLastRolledHighlight: (token: number | null) => void;
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
  'buildShip',
  'moveShip',
]);

// An otherwise-undoable action that uncovered something can't be taken back
// (Seafarers: lifting fog, picking up a face-down tribe card / token,
// opening a cloth trade, or landing in a follow-up step such as a gold
// pick) — undoing would let a player peek and retry.
function revealedSomething(before: GameState, next: GameState): boolean {
  if ((before.unrevealedFogHexes?.length ?? 0) !== (next.unrevealedFogHexes?.length ?? 0)) {
    return true;
  }
  const claimed = (s: GameState) => (s.tribeTokens ?? []).filter((t) => t.claimedBy).length;
  if (claimed(before) !== claimed(next)) return true;
  const partners = (s: GameState) =>
    (s.clothVillages ?? []).reduce((n, v) => n + v.partners.length, 0);
  if (partners(before) !== partners(next)) return true;
  // Anything that rolled dice (T&B Barbarian Attack landings after a build).
  if (before.rngState !== next.rngState) return true;
  return next.phase !== before.phase;
}

const phaseToMode = (state: GameState): UIMode => {
  if (
    state.phase === 'setupRound1' ||
    state.phase === 'setupRound2' ||
    state.phase === 'setupRound3'
  ) {
    return state.setupState?.step === 'settlement'
      ? { kind: 'placeSetupSettlement' }
      : { kind: 'placeSetupRoad' };
  }
  if (state.phase === 'moveRobber') return { kind: 'moveRobber' };
  if (state.phase === 'movePirate') return { kind: 'movePirate' };
  if (state.phase === 'placeTribePort') return { kind: 'placeTribePort' };
  // T&B Merchant Trains: the placer picks an edge.
  if (state.phase === 'placeWagon') return { kind: 'placeWagon' };
  // T&B Barbarian Attack: card choices and the end-of-turn knight moves.
  if (state.phase === 'barbarianCard') {
    return state.barbarianAttack?.pendingCard?.card === 'treason'
      ? { kind: 'baTreason', moves: [] }
      : { kind: 'baCard' };
  }
  if (state.phase === 'barbarianKnightMoves') return { kind: 'baKnightMove' };
  // Cities & Knights sub-phases that drive board interactions.
  if (state.phase === 'displacedKnightMove') return { kind: 'displacedKnightMove' };
  if (state.phase === 'placeMerchant') return { kind: 'placeMerchant' };
  if (state.phase === 'removeRoad') return { kind: 'removeRoad' };
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
    pendingPirateHex: null;
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
    pendingPirateHex: null,
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
  pendingPirateHex: null,
  lastActionSnapshot: null,
  lastRolledHighlight: null,

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
      pendingPirateHex: null,
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
      pendingPirateHex: null,
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
      // Production-pulse highlight: only on real production rolls (not 7).
      // Cleared by the BoardSVG effect ~1.5s later.
      if (action.type === 'rollDice') {
        const total = action.dice[0] + action.dice[1];
        set({ lastRolledHighlight: total !== 7 ? total : null });
      }
      // Broadcast to peers only after local apply succeeds.
      if (broadcastHandler) broadcastHandler(action);
      // Update snapshot bookkeeping for undo (solo/hot-seat only).
      const solo = !isOnlinePredicate();
      if (solo && UNDOABLE_ACTION_TYPES.has(action.type) && !revealedSomething(before, next)) {
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
      if (action.type === 'rollDice') {
        const total = action.dice[0] + action.dice[1];
        set({ lastRolledHighlight: total !== 7 ? total : null });
      }
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
      pendingPirateHex: null,
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
      pendingPirateHex: null,
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
  setPendingPirateHex: (hex) => set({ pendingPirateHex: hex }),
  setLastRolledHighlight: (token) => set({ lastRolledHighlight: token }),
}));
