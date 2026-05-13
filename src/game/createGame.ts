import type { GameState, GameSettings, Player, DevCardType, PlayerColor } from './types';
import { generateBoard } from './board/generator';
import { shuffle } from './rng';
import { emptyBank, bankFull } from './resources';

const DEFAULT_COLORS: PlayerColor[] = ['red', 'blue', 'orange', 'white'];

// Base game dev deck (25 cards total).
const DEV_DECK: DevCardType[] = [
  ...Array<DevCardType>(14).fill('knight'),
  ...Array<DevCardType>(2).fill('roadBuilding'),
  ...Array<DevCardType>(2).fill('yearOfPlenty'),
  ...Array<DevCardType>(2).fill('monopoly'),
  ...Array<DevCardType>(5).fill('victoryPoint'),
];

export interface CreateGameOptions {
  playerNames: string[];
  seed: number;
  settings?: Partial<GameSettings>;
}

export function createGame(opts: CreateGameOptions): GameState {
  const numPlayers = opts.playerNames.length;
  if (numPlayers < 2 || numPlayers > 4) {
    throw new Error(`Catan supports 2-4 players, got ${numPlayers}`);
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
    color: DEFAULT_COLORS[i]!,
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

  return {
    settings,
    rngState: rng,
    board: boardResult.board,
    players,
    playerOrder: players.map((p) => p.id),
    currentPlayerIndex: 0,
    phase: 'setupRound1',
    setupState: { step: 'settlement', lastPlacedSettlement: null },
    bank: bankFull(19),
    devCardDeck,
    hasRolledThisTurn: false,
    hasPlayedDevCardThisTurn: false,
    largestArmy: null,
    longestRoad: null,
    lastRoll: null,
    winner: null,
  };
}
