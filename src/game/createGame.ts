import type { GameState, GameSettings, Player, DevCardType, PlayerColor, BoardState, IslandChip, TribeToken, WonderState } from './types';
import { WONDERS } from './modules/seafarers/wonders/catalogue';
import { generateBoard } from './board/generator';
import { generateSeafarersBoard } from './modules/seafarers/board/generator';
import { SEAFARERS_EXPANSION_ID } from './modules/seafarers/constants';
import { getScenario } from './modules/seafarers/board/scenarios';
import { shuffle } from './rng';
import { emptyBank, bankFull } from './resources';

const DEFAULT_COLORS: PlayerColor[] = ['red', 'blue', 'orange', 'white', 'purple', 'pink', 'teal', 'gold'];

const ALL_PLAYER_COLORS: PlayerColor[] = [
  'red',
  'blue',
  'orange',
  'white',
  'purple',
  'pink',
  'teal',
  'gold',
  'lime',
  'brown',
];

// Base dev deck (3-4p): 25 cards. 5-6p extension: 34 cards. 7-8p (unofficial):
// 35 cards — more knights so Largest Army stays competitive when twice as many
// players are chasing it.
const DEV_DECK_BASE: DevCardType[] = [
  ...Array<DevCardType>(14).fill('knight'),
  ...Array<DevCardType>(2).fill('roadBuilding'),
  ...Array<DevCardType>(2).fill('yearOfPlenty'),
  ...Array<DevCardType>(2).fill('monopoly'),
  ...Array<DevCardType>(5).fill('victoryPoint'),
];

const DEV_DECK_5_6: DevCardType[] = [
  ...Array<DevCardType>(20).fill('knight'),
  ...Array<DevCardType>(3).fill('roadBuilding'),
  ...Array<DevCardType>(3).fill('yearOfPlenty'),
  ...Array<DevCardType>(3).fill('monopoly'),
  ...Array<DevCardType>(5).fill('victoryPoint'),
];

const DEV_DECK_7_8: DevCardType[] = [
  ...Array<DevCardType>(20).fill('knight'),
  ...Array<DevCardType>(3).fill('roadBuilding'),
  ...Array<DevCardType>(3).fill('yearOfPlenty'),
  ...Array<DevCardType>(3).fill('monopoly'),
  ...Array<DevCardType>(6).fill('victoryPoint'),
];

// Resource bank size per resource. 3-4p uses 19 (base game). 5-6p and 7-8p
// use 24 — the 5-6 extension officially ships 24 of each so larger groups
// don't starve the bank, and the unofficial 7-8 extension reuses that pool.
function bankSizeFor(numPlayers: number): number {
  return numPlayers >= 5 ? 24 : 19;
}

function devDeckFor(numPlayers: number): DevCardType[] {
  if (numPlayers >= 7) return DEV_DECK_7_8;
  if (numPlayers >= 5) return DEV_DECK_5_6;
  return DEV_DECK_BASE;
}

// Base-game default VP target. Official rule is 10 regardless of player
// count; the 5-6p extension keeps 10 VP, and the unofficial 7-8p extension
// stays at 10 too (more players already lengthens wall-clock time per
// round, so raising the target compounds that rather than balancing it).
function defaultVpFor(_numPlayers: number): number {
  return 10;
}

export type PlayerKind = 'human' | 'ai';

export interface CreateGameOptions {
  playerNames: string[];
  playerTypes?: PlayerKind[]; // same length as playerNames; defaults to all 'human'
  playerColors?: PlayerColor[]; // same length; defaults to the standard set
  seed: number;
  settings?: Partial<GameSettings>;
  // Whether to shuffle the turn order on start. Defaults to true.
  randomizeTurnOrder?: boolean;
}

export function createGame(opts: CreateGameOptions): GameState {
  const numPlayers = opts.playerNames.length;
  if (numPlayers < 2 || numPlayers > 8) {
    // The engine still tolerates 2 players (used by tests and edge cases),
    // but the official rules and the standard new-game flow require 3-6
    // (with 5-6 using the larger expansion map + Special Build Phase).
    // 7-8 is an unofficial extension (37-hex board, scaled bank + dev deck).
    throw new Error(`Catan supports 2-8 players, got ${numPlayers}`);
  }
  if (opts.playerTypes && opts.playerTypes.length !== numPlayers) {
    throw new Error('playerTypes length must match playerNames');
  }
  if (opts.playerColors) {
    if (opts.playerColors.length !== numPlayers) {
      throw new Error('playerColors length must match playerNames');
    }
    for (const c of opts.playerColors) {
      if (!ALL_PLAYER_COLORS.includes(c)) {
        throw new Error(`Unknown player color: ${c}`);
      }
    }
    const seen = new Set(opts.playerColors);
    if (seen.size !== opts.playerColors.length) {
      throw new Error('playerColors must be unique');
    }
  }

  // Seafarers has no official 7-8p layout. Until per-scenario 7-8 boards
  // are designed, refuse the combination at the engine boundary so the
  // generator doesn't silently fall back to the 5-6 board for an
  // 8-player game (which would be undersized).
  const expansions = opts.settings?.expansions ?? [];
  if (expansions.includes(SEAFARERS_EXPANSION_ID) && numPlayers > 6) {
    throw new Error(
      `Seafarers supports at most 6 players (got ${numPlayers}); a 7-8p Seafarers extension does not yet exist.`,
    );
  }

  // VP target precedence: explicit override > scenario default > player-count
  // default. Scenarios ship with rulebook-correct VP targets (e.g. Heading for
  // New Shores = 12 at 3-4p / 14 at 5-6p) so picking one without an override
  // does the right thing.
  const scenarioId = opts.settings?.scenarioId;
  const scenarioVp = ((): number | undefined => {
    if (!expansions.includes(SEAFARERS_EXPANSION_ID) || !scenarioId) return undefined;
    const sc = getScenario(scenarioId);
    if (numPlayers >= 5 && sc.defaultVpToWin5_6 != null) return sc.defaultVpToWin5_6;
    return sc.defaultVpToWin;
  })();
  const settings: GameSettings = {
    numPlayers,
    victoryPointsToWin:
      opts.settings?.victoryPointsToWin ?? scenarioVp ?? defaultVpFor(numPlayers),
    expansions,
    scenarioId,
    turnTimerSec: opts.settings?.turnTimerSec,
  };

  let rng = opts.seed >>> 0;
  let board: BoardState;
  let islandChips: IslandChip[] | undefined;
  let tribeTokens: TribeToken[] | undefined;
  let unrevealedFogHexes: string[] | undefined;
  let wonders: WonderState[] | undefined;
  const boardVariant: '3-4' | '5-6' | '7-8' =
    numPlayers >= 7 ? '7-8' : numPlayers >= 5 ? '5-6' : '3-4';
  if (settings.expansions.includes(SEAFARERS_EXPANSION_ID)) {
    const result = generateSeafarersBoard(settings.scenarioId, rng, numPlayers);
    board = result.board;
    rng = result.rngState;
    islandChips = result.islandChips;
    tribeTokens = result.tribeTokens.length > 0 ? result.tribeTokens : undefined;
    unrevealedFogHexes =
      result.unrevealedFogHexes.length > 0 ? result.unrevealedFogHexes : undefined;
    // Wonders of Catan: seed every wonder at level 0 / unclaimed. Other
    // scenarios leave `wonders` undefined so the build action stays gated.
    if (settings.scenarioId === 'wondersOfCatan') {
      wonders = WONDERS.map((w) => ({ id: w.id, builtBy: null, level: 0 }));
    }
  } else {
    const baseResult = generateBoard(rng, boardVariant);
    board = baseResult.board;
    rng = baseResult.rngState;
  }

  let devCardDeck: DevCardType[];
  [devCardDeck, rng] = shuffle(rng, devDeckFor(numPlayers));

  const players: Player[] = opts.playerNames.map((name, i) => ({
    id: `p${i}`,
    name,
    color: opts.playerColors?.[i] ?? DEFAULT_COLORS[i]!,
    isAI: (opts.playerTypes?.[i] ?? 'human') === 'ai',
    resources: emptyBank(),
    devCards: {
      unplayed: [],
      boughtThisTurn: [],
      playedKnights: 0,
      victoryPoints: 0,
    },
    settlements: [],
    cities: [],
    roads: [],
    ports: [],
    hasLongestRoad: false,
    hasLargestArmy: false,
    ships: [],
  }));

  // Determine turn order. By default we shuffle so signup order doesn't
  // confer a first-player advantage; pass `randomizeTurnOrder: false` for
  // tests that rely on a deterministic seat order.
  let playerOrder: string[];
  if (opts.randomizeTurnOrder === false) {
    playerOrder = players.map((p) => p.id);
  } else {
    const ids = players.map((p) => p.id);
    let shuffled: string[];
    [shuffled, rng] = shuffle(rng, ids);
    playerOrder = shuffled;
  }

  return {
    settings,
    rngState: rng,
    board,
    players,
    playerOrder,
    currentPlayerIndex: 0,
    phase: 'setupRound1',
    setupState: { step: 'settlement', lastPlacedSettlement: null },
    bank: bankFull(bankSizeFor(numPlayers)),
    devCardDeck,
    hasRolledThisTurn: false,
    hasPlayedDevCardThisTurn: false,
    tradesProposedThisTurn: 0,
    largestArmy: null,
    longestRoad: null,
    lastRoll: null,
    winner: null,
    boardVariant,
    turnHolderIndex: 0,
    islandChips,
    tribeTokens,
    unrevealedFogHexes,
    wonders,
  };
}
