import type { GameState, GameSettings, Player, DevCardType, PlayerColor, BoardState, IslandChip, TribeToken, WonderState, PirateFleet, CommodityBank, BarbarianState, VertexId, PlayerId, EdgeId, FishTokenType, FishingGround, HexId, TradeWagon, KnightSupply, ImprovementTrack, ProgressCardKind, MetropolisRecord, CastleState } from './types';
import { WONDERS } from './modules/seafarers/wonders/catalogue';
import { generateBoard } from './board/generator';
import { generateSeafarersBoard } from './modules/seafarers/board/generator';
import { generateBaseScenarioBoard } from './modules/base/scenarios/generator';
import { generateTradersBoard } from './modules/traders/board/generator';
import { buildInitialFishPool } from './modules/traders/fishing/pool';
import {
  TRADERS_SCENARIO_FISHING,
  TRADERS_SCENARIO_MERCHANT_TRAINS,
  TRADERS_SCENARIO_BARBARIAN_ATTACK,
  MERCHANT_WAGON_SUPPLY,
  BARBARIAN_KNIGHT_SUPPLY,
} from './modules/traders/constants';
import {
  getBaseScenario,
  DEFAULT_BASE_SCENARIO_ID,
} from './modules/base/scenarios';
import { SEAFARERS_EXPANSION_ID } from './modules/seafarers/constants';
import { TRADERS_EXPANSION_ID } from './modules/traders/constants';
import {
  CITIES_AND_KNIGHTS_EXPANSION_ID,
  CITIES_AND_KNIGHTS_DEFAULT_VP,
  COMMODITY_BANK_SIZE,
  KNIGHT_SUPPLY_PER_STRENGTH,
} from './modules/citiesAndKnights/constants';
import { shuffleProgressDecks } from './modules/citiesAndKnights/progress/catalogue';
import { getScenario } from './modules/seafarers/board/scenarios';
import { getTradersScenario } from './modules/traders/board/scenarios';
import { recalcWealthTiles } from './modules/traders/scoring/wealthTiles';
import { shuffle } from './rng';
import { emptyBank, bankFull } from './resources';
import { emptyCommodities, commoditiesFull } from './commodities';

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

// Public helper: total dev card composition for the cheatsheet. Returns
// the count of each kind in the starting deck for the current player
// count. The cheatsheet pairs these with `game.devCardDeck` counts to
// show "remaining/total" without leaking any private hand info.
export function devDeckTotalsFor(numPlayers: number): Record<DevCardType, number> {
  const totals: Record<DevCardType, number> = {
    knight: 0,
    roadBuilding: 0,
    yearOfPlenty: 0,
    monopoly: 0,
    victoryPoint: 0,
  };
  for (const c of devDeckFor(numPlayers)) totals[c]++;
  return totals;
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

  const hasCitiesKnights = expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
  const hasTraders = expansions.includes(TRADERS_EXPANSION_ID);

  // Cities & Knights + Seafarers can be combined per the rulebook, but the
  // combined ruleset has its own intercept points (knights on ships, pirate
  // on barbarian track, etc.) we haven't implemented yet. Refuse the combo
  // at the engine boundary so the UI picker is the only mutex to maintain.
  if (hasCitiesKnights && expansions.includes(SEAFARERS_EXPANSION_ID)) {
    throw new Error(
      'Cities & Knights cannot be combined with Seafarers yet (Phase 1 deferral).',
    );
  }

  // Traders & Barbarians compatibility limits for this phase:
  //   - 3-4 players only (no 5-6p scenario layouts yet).
  //   - Cannot combine with Seafarers (no merged scenario boards).
  //   - Cannot combine with Cities & Knights (variant interactions deferred).
  if (hasTraders) {
    if (numPlayers > 4) {
      throw new Error(
        `Traders & Barbarians is 3-4 players only in this build (got ${numPlayers}).`,
      );
    }
    if (expansions.includes(SEAFARERS_EXPANSION_ID)) {
      throw new Error(
        'Traders & Barbarians cannot be combined with Seafarers yet.',
      );
    }
    if (hasCitiesKnights) {
      throw new Error(
        'Traders & Barbarians cannot be combined with Cities & Knights yet.',
      );
    }
  }

  // VP target precedence: explicit override > scenario default > player-count
  // default. Scenarios ship with rulebook-correct VP targets (e.g. Heading for
  // New Shores = 12 at 3-4p / 14 at 5-6p) so picking one without an override
  // does the right thing. Both Seafarers and base-game scenarios participate.
  const scenarioId = opts.settings?.scenarioId;
  const baseScenarioId = opts.settings?.baseScenarioId ?? DEFAULT_BASE_SCENARIO_ID;
  const tradersScenarioId = opts.settings?.tradersScenarioId;
  const tradersVariants = opts.settings?.tradersVariants;
  const scenarioVp = ((): number | undefined => {
    if (hasTraders) {
      const sc = getTradersScenario(tradersScenarioId ?? 'riversOfCatan');
      return sc.defaultVpToWin;
    }
    if (expansions.includes(SEAFARERS_EXPANSION_ID)) {
      if (!scenarioId) return undefined;
      const sc = getScenario(scenarioId);
      if (numPlayers >= 5 && sc.defaultVpToWin5_6 != null) return sc.defaultVpToWin5_6;
      return sc.defaultVpToWin;
    }
    const sc = getBaseScenario(baseScenarioId);
    if (numPlayers >= 5 && sc.defaultVpToWin5_6 != null) return sc.defaultVpToWin5_6;
    return sc.defaultVpToWin;
  })();
  // VP precedence: explicit override > C&K default (13, overrides any base
  // scenario VP when the expansion is on) > scenario default > player-count
  // default (10). C&K's 13-VP target is rule-mandated for the expansion, so
  // it beats whatever the base map shipped as its default.
  const cnkVp = hasCitiesKnights ? CITIES_AND_KNIGHTS_DEFAULT_VP : undefined;
  // Strongest Ports variant: rulebook explicitly says "increase the number
  // of VPs needed to win by 1." Stacks on top of whatever else picked the VP.
  const strongestPortsBump =
    hasTraders && tradersVariants?.strongestPorts ? 1 : 0;
  const settings: GameSettings = {
    numPlayers,
    victoryPointsToWin:
      (opts.settings?.victoryPointsToWin ??
        cnkVp ??
        scenarioVp ??
        defaultVpFor(numPlayers)) + strongestPortsBump,
    expansions,
    scenarioId,
    baseScenarioId,
    tradersScenarioId: hasTraders ? tradersScenarioId ?? 'riversOfCatan' : undefined,
    tradersVariants: hasTraders ? tradersVariants : undefined,
    turnTimerSec: opts.settings?.turnTimerSec,
  };

  let rng = opts.seed >>> 0;
  let board: BoardState;
  let islandChips: IslandChip[] | undefined;
  let tribeTokens: TribeToken[] | undefined;
  let unrevealedFogHexes: string[] | undefined;
  let wonders: WonderState[] | undefined;
  let pirateFleet: PirateFleet | undefined;
  let clothHexes: string[] | undefined;
  let riverEdges: EdgeId[] | undefined;
  let lakeHexId: HexId | undefined;
  let fishingGrounds: FishingGround[] | undefined;
  let wateringHoleHexId: HexId | undefined;
  let castles: CastleState[] | undefined;
  const boardVariant: '3-4' | '5-6' | '7-8' =
    numPlayers >= 7 ? '7-8' : numPlayers >= 5 ? '5-6' : '3-4';
  if (hasTraders) {
    const result = generateTradersBoard(
      settings.tradersScenarioId,
      rng,
      numPlayers,
    );
    board = result.board;
    rng = result.rngState;
    riverEdges = result.riverEdges.length > 0 ? result.riverEdges : undefined;
    lakeHexId = result.lakeHexId ?? undefined;
    fishingGrounds =
      result.fishingGrounds.length > 0 ? result.fishingGrounds : undefined;
    wateringHoleHexId = result.wateringHoleHexId ?? undefined;
  } else if (settings.expansions.includes(SEAFARERS_EXPANSION_ID)) {
    const result = generateSeafarersBoard(settings.scenarioId, rng, numPlayers);
    board = result.board;
    rng = result.rngState;
    islandChips = result.islandChips;
    tribeTokens = result.tribeTokens.length > 0 ? result.tribeTokens : undefined;
    unrevealedFogHexes =
      result.unrevealedFogHexes.length > 0 ? result.unrevealedFogHexes : undefined;
    pirateFleet = result.pirateFleet;
    clothHexes = result.clothHexes.length > 0 ? result.clothHexes : undefined;
    // Wonders of Catan: seed every wonder at level 0 / unclaimed. Other
    // scenarios leave `wonders` undefined so the build action stays gated.
    if (settings.scenarioId === 'wondersOfCatan') {
      wonders = WONDERS.map((w) => ({ id: w.id, builtBy: null, level: 0 }));
    }
  } else if (baseScenarioId && baseScenarioId !== DEFAULT_BASE_SCENARIO_ID) {
    // Fun Maps (Gold Rush, Volcano, Black Forest, Diamond, Gear, Lakes,
    // Pond, Twirl) route through the modular layout system. The volcanoHex
    // (if any) is stamped onto BoardState inside the generator.
    const baseResult = generateBaseScenarioBoard(baseScenarioId, rng, numPlayers);
    board = baseResult.board;
    rng = baseResult.rngState;
  } else {
    const baseResult = generateBoard(rng, boardVariant);
    board = baseResult.board;
    rng = baseResult.rngState;
  }

  // Cities & Knights replaces dev cards with three progress card decks
  // (drawn on the event die). Phase 1 of C&K doesn't ship those decks yet,
  // so we just leave the dev card deck empty. Engine-side, the C&K module
  // intercepts every dev card action to throw so a stale dispatch can't
  // exercise it.
  let devCardDeck: DevCardType[];
  if (hasCitiesKnights) {
    devCardDeck = [];
  } else {
    [devCardDeck, rng] = shuffle(rng, devDeckFor(numPlayers));
  }

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
    ...(hasCitiesKnights
      ? {
          commodities: emptyCommodities(),
          cityWalls: 0,
          improvements: { science: 0, trade: 0, politics: 0 },
          progressCards: { science: [], trade: [], politics: [] },
          defenderTokens: 0,
        }
      : {}),
    ...(hasTraders ? { gold: 0, bridges: [] } : {}),
    ...(hasTraders && settings.tradersScenarioId === TRADERS_SCENARIO_FISHING
      ? { fishTokens: [] as Array<'one' | 'two' | 'three'> }
      : {}),
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

  // Cities & Knights state seeding.
  let commodityBank: CommodityBank | undefined;
  let barbarian: BarbarianState | undefined;
  let robberActive: boolean | undefined;
  let cityWallsByVertex: Record<VertexId, PlayerId> | undefined;
  let knights: Record<VertexId, import('./types').KnightRecord> | undefined;
  let knightSupply: KnightSupply | undefined;
  let metropolises: Record<ImprovementTrack, MetropolisRecord | null> | undefined;
  let progressDecks: Record<ImprovementTrack, ProgressCardKind[]> | undefined;
  if (hasCitiesKnights) {
    commodityBank = commoditiesFull(COMMODITY_BANK_SIZE);
    barbarian = { position: 0, attacksResolved: 0 };
    // Robber starts "offshore" in C&K — represented by a flag rather than a
    // sentinel hex. board.robberHex still points at the desert so the existing
    // renderer doesn't NPE; the gate lives in the dice / moveRobber handlers.
    robberActive = false;
    cityWallsByVertex = {};
    knights = {};
    knightSupply = {} as KnightSupply;
    for (const p of players) {
      knightSupply[p.id] = {
        1: KNIGHT_SUPPLY_PER_STRENGTH,
        2: KNIGHT_SUPPLY_PER_STRENGTH,
        3: KNIGHT_SUPPLY_PER_STRENGTH,
      };
    }
    metropolises = { science: null, trade: null, politics: null };
    const shuffled = shuffleProgressDecks(rng);
    progressDecks = shuffled.decks;
    rng = shuffled.rng;
  }

  // T&B initial wealth/Strongest Ports state. Players start at 0 gold so
  // wealthTiles encodes to { wealthiest: null, poor: [] }.
  const wealthTilesInit = hasTraders
    ? recalcWealthTiles({ players })
    : undefined;
  const strongestPortsInit =
    hasTraders && tradersVariants?.strongestPorts
      ? { holder: null }
      : undefined;

  // Fishing on Catan seeding. The robber starts off-board (rulebook: "It
  // will enter the game when you Resolve a 7 or play a Knight card"), the
  // 30-token fish pool is initialized face-down, and the boot starts in
  // the supply (oldBootHolder=null) until someone draws it.
  const isFishing =
    hasTraders && settings.tradersScenarioId === TRADERS_SCENARIO_FISHING;
  let fishTokenPool: FishTokenType[] | undefined;
  let fishTokenDiscard: FishTokenType[] | undefined;
  let oldBootHolder: PlayerId | null | undefined;
  if (isFishing) {
    [fishTokenPool, rng] = shuffle(rng, buildInitialFishPool());
    fishTokenDiscard = [];
    oldBootHolder = null;
    // Robber off-board until activated. Use the existing robberActive flag
    // shared with C&K. board.robberHex still points at whatever the
    // assembler chose (the lake, for Fishing) so renderers don't crash.
    robberActive = false;
  }

  // Merchant Trains seeding. The robber enters only on a 7 / Knight; the
  // 22-token wagon supply starts full; no wagons placed yet.
  const isMerchantTrains =
    hasTraders &&
    settings.tradersScenarioId === TRADERS_SCENARIO_MERCHANT_TRAINS;
  let wagons: TradeWagon[] | undefined;
  let wagonSupply: number | undefined;
  if (isMerchantTrains) {
    wagons = [];
    wagonSupply = MERCHANT_WAGON_SUPPLY;
    robberActive = false;
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
    pirateFleet,
    clothHexes,
    commodityBank,
    barbarian,
    robberActive,
    cityWalls: cityWallsByVertex,
    knights,
    knightSupply,
    metropolises,
    progressDecks,
    riverEdges,
    wealthTiles: wealthTilesInit,
    strongestPorts: strongestPortsInit,
    lakeHexId,
    fishingGrounds,
    fishTokenPool,
    fishTokenDiscard,
    oldBootHolder,
    wateringHoleHexId,
    wagons,
    wagonSupply,
  };
}
