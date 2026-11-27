import { create } from 'zustand';
import type {
  Action,
  BarbarianTreasonMove,
  EdgeId,
  EpLocation,
  HexId,
  KnightStrength,
  PendingTrade,
  PlayerId,
  VertexId,
} from '@/game/types';
import { applyAction } from '@/game/engine';
import { createGame, type CreateGameOptions } from '@/game/createGame';
import { getActingPlayerId } from '@/game/helpers';
import type { GameState } from '@/game/types';
import { useLogStore, type LogStoreSnapshot } from './logStore';
import { emitBoardTransition } from './boardEvents';

// Re-export the pure helper for callers used to importing it from the store.
export { getActingPlayerId };

/**
 * An offer's identity: who proposed what for what. Answers (a yes, a no)
 * don't change it; a counter-offer or a new offer does.
 */
export function tradeOfferKey(t: PendingTrade): string {
  return [
    t.proposerId,
    JSON.stringify(t.give),
    JSON.stringify(t.receive),
    JSON.stringify(t.giveCommodities ?? {}),
    JSON.stringify(t.receiveCommodities ?? {}),
    t.giveGold ?? 0,
    t.receiveGold ?? 0,
  ].join('|');
}

/** Where the menus open after a game ends: the New Game settings or the online menu (null = home). */
export type MenuStart = 'local' | 'online';

/** The counter-offer being written: who is countering, and the offer (its tradeOfferKey) they answer. */
export interface TradeCounter {
  as: PlayerId;
  key: string;
}

/** The game plus its log, as captured for undo and for online rollbacks. */
export interface GameSnapshot {
  game: GameState;
  log: LogStoreSnapshot;
}

// Optional broadcast hook — when the network layer is active it registers a
// function here so dispatched actions are sent to the room as a side effect.
// `before` is the state the action was applied to (the room may roll back to
// it). Kept here (rather than in networkStore) to avoid a circular import.
// `at` is when the action was made (it's logged with that time everywhere).
let broadcastHandler: ((action: Action, before: GameSnapshot, at: number) => void) | null = null;
export function registerBroadcastHandler(
  fn: ((action: Action, before: GameSnapshot, at: number) => void) | null,
): void {
  broadcastHandler = fn;
}

// Online, a device may only act for its own seat (and the host for AI
// seats). The network layer registers the check; it returns an error
// message to refuse the action, or null to allow it.
let dispatchGuard: ((action: Action) => string | null) | null = null;
export function registerDispatchGuard(fn: ((action: Action) => string | null) | null): void {
  dispatchGuard = fn;
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
  // Fishing on Catan — picking the edge for a road paid with these fish.
  | { kind: 'fishRoad'; tokens: Array<'one' | 'two' | 'three'> }
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
  // Traders & Barbarians scenario — the End of Turn wagon moves, and placing
  // a barbarian (`pick` = the barbarian chosen, before its edge).
  | { kind: 'tbWagon' }
  | { kind: 'tbBarbarian'; pick?: number }
  // Explorers & Pirates — Action phase: a coastal settlement to upgrade to
  // a harbor settlement; a sea edge for a new ship (`recycle` = the ship
  // returned first when all 3 are on the board); where a new settler /
  // crew goes (`at` = the full spot picked, waiting for what to evict).
  // Setup round 3's ship. Movement phase: `ship` = the selected ship.
  // Placing your pirate ship.
  | { kind: 'epHarbor' }
  | { kind: 'epShip'; recycle?: string }
  | { kind: 'epPiece'; piece: 'settler' | 'crew'; at?: EpLocation }
  | { kind: 'epSetupShip' }
  | { kind: 'epMove'; ship?: string }
  | { kind: 'epPirate' }
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
  // Cities & Knights — barbarians won: pick which of your cities is pillaged.
  | { kind: 'choosePillage' }
  // Cities & Knights / Treason — the target removes a knight; the attacker
  // places one (strength picked in the dialog first).
  | { kind: 'treasonRemoveKnight' }
  | { kind: 'treasonPlaceKnight'; strength?: KnightStrength }
  // Cities & Knights progress cards played by clicking the board: the card
  // is only played (with its payload) once the picks are complete.
  | { kind: 'progressRoadBuilding'; first?: EdgeId }
  | { kind: 'smithing'; selected: VertexId[] }
  | { kind: 'intrigue' }
  | { kind: 'engineering' }
  | { kind: 'medicine' }
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
  // Traders & Barbarians coins (spend / buy gold)
  | 'coins'
  // Cities & Knights dialogs opened from the ActionBar (sub-phase prompts
  // follow game.phase instead — see ui/dialogs/citiesAndKnights/CKDialogs).
  | 'cityImprovements'
  | 'progressCards'
  | 'alchemy'
  | 'knights'
  | 'commercialHarbor'
  // Explorers & Pirates: Fast Gold (1 card → 1 gold) and moving pieces
  // between a ship and the harbor settlement next to it.
  | 'epFastGold'
  | 'epTransfer';

interface AppStore {
  game: GameState | null;
  uiMode: UIMode;
  dialog: DialogName | null;
  /**
   * Set while the trade dialog is open as a counter-offer (PendingTradeBanner's
   * Counter button). Other players' moves normally close any open dialog;
   * this one stays open while the offer it answers stands.
   */
  tradeCounter: TradeCounter | null;
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
  // Pre-action snapshot for solo/hot-seat undo (the top of `undoStack`).
  // Set after a successful dispatch of one of UNDOABLE_ACTION_TYPES; cleared
  // by any non-undoable action, by undo, or by starting/resetting a game.
  // Bundles game state + log-store state so undo rewinds both together.
  lastActionSnapshot: GameSnapshot | null;
  // Every undo step still open, oldest first. Hot-seat keeps one (the last
  // build / bank trade); a game against AIs only (one human) keeps the whole
  // turn's builds and trades, a completed trade with an AI undoing back to
  // before the offer (the AIs' answers in between don't count as moves).
  undoStack: GameSnapshot[];
  // The most-recent dice token to highlight on the board (production
  // pulse). null when nothing should pulse. Cleared by a timeout in
  // BoardSVG ~1.5s after a roll. Excluded from network sync — each
  // peer sets it locally when it sees the rollDice action.
  lastRolledHighlight: number | null;

  newGame: (opts: CreateGameOptions) => void;
  /** Show `state` as a fresh game; `startedAt` sets the game clock's start (default now). */
  setGameState: (state: GameState, startedAt?: number) => void;
  /** Back to the menus; `then` opens one of them instead of home (read once by HomeMenu). */
  resetGame: (opts?: { then?: MenuStart }) => void;
  /** Set by resetGame({ then }); HomeMenu opens there and clears it. */
  menuStart: MenuStart | null;
  dispatch: (action: Action) => void;
  /** Dispatch moves in order as one (a mixed bank trade): stops at the first refusal, and undo takes back all of them. */
  dispatchAll: (actions: Action[]) => void;
  /** Apply an action without broadcasting it (moves from the room), logged at time `at`. False when the engine rejects it. */
  applyLocal: (action: Action, at?: number) => boolean;
  /** Current game + log, for `restoreSnapshot`. */
  takeSnapshot: () => GameSnapshot | null;
  /** Put the game and its log back to a snapshot (online rollback). */
  restoreSnapshot: (snap: GameSnapshot) => void;
  undo: () => void;
  setMode: (mode: UIMode) => void;
  openDialog: (d: DialogName) => void;
  /** Open the trade dialog as `as`'s counter to the pending offer. */
  openCounterDialog: (as: PlayerId) => void;
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
  'bankTradeCK',
  'buildShip',
  'moveShip',
  // Traders & Barbarians: bridges and coin trades reveal nothing.
  'buildBridge',
  'spendGold',
  'buyGold',
  // Traders & Barbarians scenario: a wagon upgrade reveals nothing.
  'upgradeWagon',
  // Explorers & Pirates Action-phase builds (a ship that explores a hex
  // can't be taken back — see revealedSomething).
  'epBuildHarbor',
  'epBuildShip',
  'epBuildSettler',
  'epBuildCrew',
  'epFastGold',
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
  // Explorers & Pirates: a new ship turned over a face-down hex.
  const hidden = (s: GameState) => Object.keys(s.explorersPirates?.hidden ?? {}).length;
  if (hidden(before) !== hidden(next)) return true;
  // Anything that rolled dice (T&B Barbarian Attack landings after a build).
  if (before.rngState !== next.rngState) return true;
  return next.phase !== before.phase;
}

// Against AIs only: our offer's state from just before we made it, so a
// trade that completes undoes back to there (cleared by anything else we do).
let tradeStart: GameSnapshot | null = null;

/** AI answers to an offer: they don't end the offerer's undo history. */
const TRADE_ANSWERS = new Set<Action['type']>(['acceptTrade', 'rejectTrade', 'counterTrade', 'cancelTrade']);

type UndoSet = (s: { lastActionSnapshot: GameSnapshot | null; undoStack: GameSnapshot[] }) => void;

function setUndo(set: UndoSet, stack: GameSnapshot[]): void {
  set({ undoStack: stack, lastActionSnapshot: stack[stack.length - 1] ?? null });
}

/**
 * Undo bookkeeping after one of this device's moves. Hot-seat: the last
 * build / bank trade only (one step). Against AIs (one human seat): every
 * build and trade of the turn, in order; an offer to the AIs that gets
 * taken (our confirm, or our accept of their counter) is one step back to
 * before the offer. Anything else clears the history.
 */
function recordUndo(
  set: UndoSet,
  get: () => { undoStack: GameSnapshot[] },
  before: GameState,
  action: Action,
  next: GameState,
  log: LogStoreSnapshot,
  solo: boolean,
): void {
  const entry: GameSnapshot = { game: before, log };
  const humans = before.players.filter((p) => !p.isAI);
  const vsAi = solo && humans.length === 1;
  const me = humans[0]?.id;
  const by = 'playerId' in action ? action.playerId : null;
  const stack = get().undoStack;
  if (!solo) {
    tradeStart = null;
    setUndo(set, []);
    return;
  }
  if (vsAi && by !== me && TRADE_ANSWERS.has(action.type)) return; // an AI answering
  if (vsAi && by === me && action.type === 'proposeTrade') {
    tradeStart = entry;
    return;
  }
  if (vsAi && by === me && action.type === 'cancelTrade') {
    tradeStart = null;
    return;
  }
  const traded = (action.type === 'confirmTrade' || action.type === 'acceptTrade')
    && !!before.pendingTrade && !next.pendingTrade;
  if (vsAi && by === me && traded && tradeStart) {
    setUndo(set, [...stack, tradeStart]);
    tradeStart = null;
    return;
  }
  tradeStart = null;
  if (UNDOABLE_ACTION_TYPES.has(action.type) && !revealedSomething(before, next)) {
    setUndo(set, vsAi ? [...stack, entry] : [entry]);
  } else {
    setUndo(set, []);
  }
}

const phaseToMode = (state: GameState): UIMode => {
  if (
    state.phase === 'setupRound1' ||
    state.phase === 'setupRound2' ||
    state.phase === 'setupRound3'
  ) {
    // Explorers & Pirates round 3: the ship (with a settler) after the road.
    if (state.setupState?.step === 'ship' && state.explorersPirates) return { kind: 'epSetupShip' };
    return state.setupState?.step === 'settlement'
      ? { kind: 'placeSetupSettlement' }
      : { kind: 'placeSetupRoad' };
  }
  // Explorers & Pirates: the Movement phase, placing your pirate ship.
  if (state.phase === 'epMovement') {
    const moving = state.explorersPirates?.movement?.moving;
    return moving ? { kind: 'epMove', ship: moving } : { kind: 'epMove' };
  }
  if (state.phase === 'epPlacePirate') return { kind: 'epPirate' };
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
  // T&B scenario: placing a barbarian (a drive-off fixes which one), and
  // the End of Turn wagon moves.
  if (state.phase === 'moveBarbarian') {
    const pick = state.tradersBarbarians?.pendingBarbarian?.barbarian;
    return pick !== undefined ? { kind: 'tbBarbarian', pick } : { kind: 'tbBarbarian' };
  }
  if (state.phase === 'wagonMoves') return { kind: 'tbWagon' };
  // Cities & Knights sub-phases that drive board interactions.
  if (state.phase === 'displacedKnightMove') return { kind: 'displacedKnightMove' };
  if (state.phase === 'placeMerchant') return { kind: 'placeMerchant' };
  if (state.phase === 'removeRoad') return { kind: 'removeRoad' };
  if (state.phase === 'placeMetropolis') return { kind: 'placeMetropolis' };
  if (state.phase === 'choosePillage') return { kind: 'choosePillage' };
  if (state.phase === 'treasonRemoveKnight') return { kind: 'treasonRemoveKnight' };
  if (state.phase === 'treasonPlaceKnight') return { kind: 'treasonPlaceKnight' };
  return { kind: 'idle' };
};

// Shared transition logic — called by both `dispatch` (local action) and
// `applyLocal` (action arriving over the network) so they keep the store
// in the same shape and fire the same handoff logic.
function applyTransition(
  set: (s: Partial<{
    game: GameState;
    uiMode: UIMode;
    dialog: DialogName | null;
    tradeCounter: TradeCounter | null;
    error: string | null;
    handoffPending: boolean;
    handoffAcknowledgedForPlayer: PlayerId | null;
    pendingRobberHex: null;
    pendingPirateHex: null;
  }>) => void,
  get: () => {
    handoffAcknowledgedForPlayer: PlayerId | null;
    uiMode: UIMode;
    dialog: DialogName | null;
    tradeCounter: TradeCounter | null;
  },
  before: GameState,
  next: GameState,
): void {
  // A counter-offer being written survives other players' answers to the
  // offer it counters; if the offer itself goes (taken, withdrawn, or
  // replaced by someone else's counter) the dialog closes and says why.
  const counter = get().dialog === 'playerTrade' ? get().tradeCounter : null;
  const counterStands = !!counter && !!next.pendingTrade && tradeOfferKey(next.pendingTrade) === counter.key;
  const counterLost = !!counter && !counterStands && next.pendingTrade?.proposerId !== counter.as;
  let uiMode = phaseToMode(next);
  // Explorers & Pirates Movement phase: a free ship action (loading,
  // unloading, a crew landing…) keeps the ship the player had selected.
  const prev = get().uiMode;
  if (
    uiMode.kind === 'epMove' &&
    !uiMode.ship &&
    before.phase === 'epMovement' &&
    prev.kind === 'epMove' &&
    prev.ship &&
    next.explorersPirates?.ships.some((s) => s.id === prev.ship)
  ) {
    uiMode = { kind: 'epMove', ship: prev.ship };
  }
  const beforeActor = getActingPlayerId(before);
  const nextActor =
    next.phase === 'gameOver' ? beforeActor : getActingPlayerId(next);
  const nextActorPlayer = next.players.find((p) => p.id === nextActor);
  const online = isOnlinePredicate();
  // Pass-device handoff is for hot-seat only: it needs two or more humans
  // sharing this device. AI never needs handoff, and a lone human playing
  // against AIs never passes the device (they used to get a "Pass the
  // device" screen at the start of every turn). Online sessions never use
  // it — each player has their own device.
  const humanSeats = next.players.filter((p) => !p.isAI).length;
  const handoff =
    !online &&
    humanSeats >= 2 &&
    next.phase !== 'gameOver' &&
    beforeActor !== nextActor &&
    !nextActorPlayer?.isAI &&
    nextActor !== get().handoffAcknowledgedForPlayer;
  // The acknowledged seat tracks the last HUMAN at the device; AI moves in
  // between don't reset it (so hot-seat players only see the handoff when
  // the device really changes hands). All-AI games keep following the actor.
  const acknowledged = handoff
    ? get().handoffAcknowledgedForPlayer
    : nextActorPlayer?.isAI && humanSeats > 0
      ? get().handoffAcknowledgedForPlayer
      : nextActor;
  set({
    game: next,
    uiMode,
    dialog: counterStands ? 'playerTrade' : null,
    tradeCounter: counterStands ? counter : null,
    error: counterLost ? 'That offer changed before your counter went in.' : null,
    handoffPending: handoff,
    handoffAcknowledgedForPlayer: acknowledged,
    pendingRobberHex: null,
    pendingPirateHex: null,
  });
}

export const useGameStore = create<AppStore>((set, get) => ({
  game: null,
  uiMode: { kind: 'idle' },
  dialog: null,
  tradeCounter: null,
  menuStart: null,
  handoffPending: false,
  handoffAcknowledgedForPlayer: null,
  error: null,
  pendingRobberHex: null,
  pendingPirateHex: null,
  lastActionSnapshot: null,
  undoStack: [],
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
      undoStack: [],
    });
  },

  resetGame: (opts) => {
    useLogStore.getState().reset();
    set({
      menuStart: opts?.then ?? null,
      game: null,
      uiMode: { kind: 'idle' },
      dialog: null,
      handoffPending: false,
      handoffAcknowledgedForPlayer: null,
      error: null,
      pendingRobberHex: null,
      pendingPirateHex: null,
      lastActionSnapshot: null,
      undoStack: [],
    });
  },

  dispatch: (action) => {
    const before = get().game;
    if (!before) return;
    const refused = dispatchGuard?.(action);
    if (refused) {
      set({ error: refused });
      return;
    }
    const at = Date.now();
    // Capture log snapshot BEFORE record(), so undo can rewind both stores.
    // Only matters for undoable actions — cheap enough to always do.
    const logBefore = useLogStore.getState().snapshot();
    try {
      const next = applyAction(before, action);
      useLogStore.getState().record(before, action, next, at);
      applyTransition(set, get, before, next);
      emitBoardTransition(before, action, next, at);
      // Production-pulse highlight: only on real production rolls (not 7).
      // Cleared by the BoardSVG effect ~1.5s later.
      // A new roll (or, with Catan Event Cards, the production after the
      // flipped card's event) pulses the hexes of its number.
      if (next.lastRoll && next.lastRoll !== before.lastRoll) {
        const total = next.lastRoll.total;
        set({ lastRolledHighlight: total !== 7 ? total : null });
      }
      // Broadcast only after the local apply succeeds.
      if (broadcastHandler) broadcastHandler(action, { game: before, log: logBefore }, at);
      // Update snapshot bookkeeping for undo (solo/hot-seat only).
      recordUndo(set, get, before, action, next, logBefore, !isOnlinePredicate());
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  dispatchAll: (actions) => {
    const start = get().takeSnapshot();
    const depth = get().undoStack.length;
    for (const action of actions) {
      const before = get().game;
      get().dispatch(action);
      if (get().game === before) return;
    }
    // Each move left an undo snapshot from just before itself; fold them into
    // one from before the first so undo takes back the whole batch.
    const stack = get().undoStack;
    if (start && stack.length > depth) setUndo(set, [...stack.slice(0, depth), start]);
  },

  applyLocal: (action, at) => {
    const before = get().game;
    if (!before) return false;
    try {
      const next = applyAction(before, action);
      useLogStore.getState().record(before, action, next, at);
      applyTransition(set, get, before, next);
      // `at` is when the move was made: a rejoin's replay of old moves is
      // too old to animate (BoardAnimations skips it).
      emitBoardTransition(before, action, next, at ?? Date.now());
      // A new roll (or, with Catan Event Cards, the production after the
      // flipped card's event) pulses the hexes of its number.
      if (next.lastRoll && next.lastRoll !== before.lastRoll) {
        const total = next.lastRoll.total;
        set({ lastRolledHighlight: total !== 7 ? total : null });
      }
      // Remote actions never produce an undo snapshot — clear any stale one.
      tradeStart = null;
      set({ lastActionSnapshot: null, undoStack: [] });
      return true;
    } catch (e) {
      // Remote action failed locally — log but don't surface as user error.
      console.warn('[gameStore] applyLocal rejected action:', (e as Error).message);
      return false;
    }
  },

  takeSnapshot: () => {
    const game = get().game;
    return game ? { game, log: useLogStore.getState().snapshot() } : null;
  },

  restoreSnapshot: (snap) => {
    useLogStore.getState().restore(snap.log);
    set({
      game: snap.game,
      uiMode: phaseToMode(snap.game),
      dialog: null,
      pendingRobberHex: null,
      pendingPirateHex: null,
      lastActionSnapshot: null,
      undoStack: [],
    });
  },

  undo: () => {
    const stack = get().undoStack;
    const snap = stack[stack.length - 1];
    if (!snap) return;
    useLogStore.getState().restore(snap.log);
    tradeStart = null;
    const rest = stack.slice(0, -1);
    set({
      game: snap.game,
      uiMode: phaseToMode(snap.game),
      dialog: null,
      error: null,
      pendingRobberHex: null,
      pendingPirateHex: null,
      lastActionSnapshot: rest[rest.length - 1] ?? null,
      undoStack: rest,
    });
  },

  setGameState: (state, startedAt) => {
    // A fresh log from this state (online, the room's action log is then
    // replayed into it).
    useLogStore.getState().reset(state, startedAt);
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
      undoStack: [],
    });
  },

  setMode: (mode) => set({ uiMode: mode, error: null }),
  openDialog: (d) => set({ dialog: d, tradeCounter: null, error: null }),
  openCounterDialog: (as) => {
    const trade = get().game?.pendingTrade;
    if (!trade) return;
    set({ dialog: 'playerTrade', tradeCounter: { as, key: tradeOfferKey(trade) }, error: null });
  },
  closeDialog: () => set({ dialog: null, tradeCounter: null }),
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
