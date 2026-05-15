import type { GameState, GameSettings, Player, DevCardType, PlayerColor } from './types';
import { generateBoard } from './board/generator';
import { shuffle } from './rng';
import { emptyBank, bankFull } from './resources';

const DEFAULT_COLORS: PlayerColor[] = ['red', 'blue', 'orange', 'white'];

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

// Base game dev deck (25 cards total).
const DEV_DECK: DevCardType[] = [
  ...Array<DevCardType>(14).fill('knight'),
  ...Array<DevCardType>(2).fill('roadBuilding'),
  ...Array<DevCardType>(2).fill('yearOfPlenty'),
  ...Array<DevCardType>(2).fill('monopoly'),
  ...Array<DevCardType>(5).fill('victoryPoint'),
];

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
  if (numPlayers < 2 || numPlayers > 4) {
    // The engine still tolerates 2 players (used by tests and edge cases),
    // but the official rules and the standard new-game flow require 3 or 4.
    throw new Error(`Catan supports 2-4 players, got ${numPlayers}`);
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

  const settings: GameSettings = {
    numPlayers,
    victoryPointsToWin: opts.settings?.victoryPointsToWin ?? 10,
    expansions: opts.settings?.expansions ?? [],
  };

  let rng = opts.seed >>> 0;
  const boardResult = generateBoard(rng);
  rng = boardResult.rngState;

  let devCardDeck: DevCardType[];
  [devCardDeck, rng] = shuffle(rng, DEV_DECK);

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
    board: boardResult.board,
    players,
    playerOrder,
    currentPlayerIndex: 0,
    phase: 'setupRound1',
    setupState: { step: 'settlement', lastPlacedSettlement: null },
    bank: bankFull(19),
    devCardDeck,
    hasRolledThisTurn: false,
    hasPlayedDevCardThisTurn: false,
    tradesProposedThisTurn: 0,
    largestArmy: null,
    longestRoad: null,
    lastRoll: null,
    winner: null,
  };
}
