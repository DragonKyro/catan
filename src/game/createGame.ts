import type { GameState, GameSettings, Player, DevCardType, PlayerColor, BoardState, IslandChip, TribeToken, WonderState, CommodityBank, BarbarianState, VertexId, PlayerId, EdgeId, FishTokenType, FishingGround, HexId, RiverPath, TradeWagon, WagonStartPoint, KnightSupply, ImprovementTrack, ProgressCardKind, MetropolisRecord, BarbarianAttackState } from './types';
import { wondersForPlayerCount } from './modules/seafarers/wonders/catalogue';
import { generateBoard } from './board/generator';
import {
  generateSeafarersBoard,
  type SeafarersBoardResult,
} from './modules/seafarers/board/generator';
import { pirateIslandsDevDeck, PIRATE_LAIRS } from './modules/seafarers/pirateIslands';
import { CLOTH_GENERAL_SUPPLY } from './modules/seafarers/cloth';
import { getPortAtVertex } from './board/adjacency';
import { generateBaseScenarioBoard } from './modules/base/scenarios/generator';
import { placeStartingPieces } from './modules/base/scenarios/startingSetup';
import { generateTradersBoard } from './modules/traders/board/generator';
import { resolveAllWagonStarts } from './modules/traders/merchantTrains/trains';
import { hasTradersVariant } from './modules/traders/variants';
import { buildEventDeck } from './modules/traders/variants/eventCards/deck';
import { buildInitialFishPool } from './modules/traders/fishing/pool';
import {
  TRADERS_SCENARIO_FISHING,
  TRADERS_SCENARIO_MERCHANT_TRAINS,
  TRADERS_SCENARIO_BARBARIAN_ATTACK,
  TRADERS_SCENARIO_TRADERS_BARBARIANS,
  MERCHANT_WAGON_SUPPLY,
  MERCHANT_WAGON_SUPPLY_5_6,
} from './modules/traders/constants';
import type { BarbarianBoardSetup } from './modules/traders/barbarianAttack/board';
import { initialBarbarianAttackState } from './modules/traders/barbarianAttack/init';
import type { TradersBarbariansBoardSetup } from './modules/traders/tradersBarbarians/board';
import { initialTradersBarbariansState } from './modules/traders/tradersBarbarians/init';
import { TB_START_GOLD } from './modules/traders/tradersBarbarians/constants';
import {
  getBaseScenario,
  baseScenarioAllowed,
  DEFAULT_BASE_SCENARIO_ID,
} from './modules/base/scenarios';
import { SEAFARERS_EXPANSION_ID } from './modules/seafarers/constants';
import { TRADERS_EXPANSION_ID } from './modules/traders/constants';
import {
  CITIES_AND_KNIGHTS_EXPANSION_ID,
  CITIES_AND_KNIGHTS_DEFAULT_VP,
  CITIES_AND_KNIGHTS_MAX_PLAYERS,
  COMMODITY_BANK_SIZE,
  COMMODITY_BANK_SIZE_5_6,
  KNIGHT_SUPPLY_PER_STRENGTH,
} from './modules/citiesAndKnights/constants';
import { shuffleProgressDecks } from './modules/citiesAndKnights/progress/catalogue';
import { getScenario } from './modules/seafarers/board/scenarios';
import { getTradersScenario } from './modules/traders/board/scenarios';
import { recalcWealthTiles } from './modules/traders/scoring/wealthTiles';
import { generateCustomMapBoard } from './customMap/generator';
import {
  EP_DEFAULT_VP,
  EP_MAX_PLAYERS,
  EP_MIN_PLAYERS,
  EP_START_GOLD,
  EP_SUPPLY_RATE,
  EXPLORERS_PIRATES_EXPANSION_ID,
  EXPLORERS_PIRATES_SCENARIO_ID,
} from './modules/explorersPirates/constants';
import { generateExplorersPiratesBoard, type EpBoardSetup } from './modules/explorersPirates/board';
import { initialExplorersPiratesState } from './modules/explorersPirates/init';
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
  'black',
  'forest',
  'lavender',
  'maroon',
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

  // Custom user-authored map. Validate the player count against the map's
  // declared range here so the failure is surfaced at game-creation time.
  const customMap = opts.settings?.customMap;
  if (customMap) {
    if (numPlayers < customMap.minPlayers || numPlayers > customMap.maxPlayers) {
      throw new Error(
        `Custom map "${customMap.name}" supports ${customMap.minPlayers}..${customMap.maxPlayers} players, got ${numPlayers}.`,
      );
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
  const hasExplorers = expansions.includes(EXPLORERS_PIRATES_EXPANSION_ID);

  // Explorers & Pirates plays its own board and turn (3-4 players; the 5-6
  // extension isn't built yet). It doesn't combine with the other
  // expansions or the T&B variants (no robber, ports or plain dice roll).
  if (hasExplorers) {
    if (numPlayers < EP_MIN_PLAYERS || numPlayers > EP_MAX_PLAYERS) {
      throw new Error(
        `Explorers & Pirates supports ${EP_MIN_PLAYERS}-${EP_MAX_PLAYERS} players (got ${numPlayers}).`,
      );
    }
    if (expansions.length > 1) {
      throw new Error('Explorers & Pirates cannot be combined with other expansions.');
    }
    const v = opts.settings?.tradersVariants;
    if (v && (v.friendlyRobber || v.strongestPorts || v.eventCards)) {
      throw new Error('The Traders & Barbarians variants cannot be used with Explorers & Pirates.');
    }
    if (opts.settings?.customMap) {
      throw new Error('Explorers & Pirates plays its own map.');
    }
  }

  // Cities & Knights + Seafarers can be combined per the rulebook, but the
  // combined ruleset has its own intercept points (knights on ships, pirate
  // on barbarian track, etc.) we haven't implemented yet. Refuse the combo
  // at the engine boundary so the UI picker is the only mutex to maintain.
  if (hasCitiesKnights && numPlayers > CITIES_AND_KNIGHTS_MAX_PLAYERS) {
    throw new Error(
      `Cities & Knights supports at most ${CITIES_AND_KNIGHTS_MAX_PLAYERS} players (got ${numPlayers}).`,
    );
  }
  if (hasCitiesKnights && expansions.includes(SEAFARERS_EXPANSION_ID)) {
    throw new Error(
      'Cities & Knights cannot be combined with Seafarers yet (Phase 1 deferral).',
    );
  }

  // Traders & Barbarians compatibility limits for this phase:
  //   - 3-6 players (T&B 5-6 boards per scenario; no 7-8 boards). A
  //     scenario without a 5-6 board (`layout5_6p`) stays 3-4.
  //   - Cannot combine with Seafarers (no merged scenario boards).
  //   - Cannot combine with Cities & Knights (variant interactions deferred).
  if (hasTraders) {
    const sc = getTradersScenario(opts.settings?.tradersScenarioId ?? 'riversOfCatan');
    if (numPlayers > sc.maxPlayers) {
      throw new Error(
        `Traders & Barbarians: ${sc.name} supports at most ${sc.maxPlayers} players (got ${numPlayers}).`,
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
  // Base-game maps tied to (or ruled out by) an expansion: the C&K first-game
  // board needs C&K; Gold Rush / Volcano can't be played with it.
  const baseMap =
    !customMap && !hasTraders && !hasExplorers && !expansions.includes(SEAFARERS_EXPANSION_ID)
      ? getBaseScenario(baseScenarioId)
      : undefined;
  if (baseMap && !baseScenarioAllowed(baseMap, expansions)) {
    throw new Error(`The "${baseMap.name}" map can't be played with these expansions.`);
  }
  // Beginner boards print every color's starting pieces (3-6 players).
  const startingSetup = baseMap?.startingSetup;
  if (startingSetup && (numPlayers < baseMap.minPlayers || numPlayers > baseMap.maxPlayers)) {
    throw new Error(
      `The "${baseMap.name}" map supports ${baseMap.minPlayers}-${baseMap.maxPlayers} players (got ${numPlayers}).`,
    );
  }
  const scenarioVp = ((): number | undefined => {
    if (customMap) return customMap.defaultVpToWin;
    if (hasExplorers) return EP_DEFAULT_VP;
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
  // Variants combine with any rule set (rulebook p. 4-6), not only T&B.
  const strongestPortsBump = tradersVariants?.strongestPorts ? 1 : 0;
  if (tradersVariants?.eventCards && hasCitiesKnights) {
    // C&K rolls the event die and red die alongside the card — not wired yet.
    throw new Error('Catan Event Cards cannot be combined with Cities & Knights yet.');
  }
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
    tradersVariants: hasTradersVariant({ tradersVariants }) ? tradersVariants : undefined,
    turnTimerSec: opts.settings?.turnTimerSec,
    aiLevel: opts.settings?.aiLevel,
    customMap,
    ...(hasExplorers
      ? { explorersPiratesScenarioId: EXPLORERS_PIRATES_SCENARIO_ID, setupRounds: 3 as const }
      : {}),
  };
  // Cloth for Catan: three starting settlements.
  if (
    !customMap &&
    expansions.includes(SEAFARERS_EXPANSION_ID) &&
    scenarioId &&
    getScenario(scenarioId).setupRounds === 3
  ) {
    settings.setupRounds = 3;
  }

  let rng = opts.seed >>> 0;
  let board: BoardState;
  let islandChips: IslandChip[] | undefined;
  let tribeTokens: TribeToken[] | undefined;
  let unrevealedFogHexes: string[] | undefined;
  let wonders: WonderState[] | undefined;
  let seafarers: SeafarersBoardResult | undefined;
  let riverEdges: EdgeId[] | undefined;
  let rivers: RiverPath[] | undefined;
  let lakeHexId: HexId | undefined;
  let lakeHexIds: HexId[] | undefined;
  let fishingGrounds: FishingGround[] | undefined;
  let wateringHoleHexId: HexId | undefined;
  let wateringHoleHexIds: HexId[] | undefined;
  let barbarianBoard: BarbarianBoardSetup | undefined;
  let tradersBarbariansBoard: TradersBarbariansBoardSetup | undefined;
  let explorersBoard: EpBoardSetup | undefined;
  const boardVariant: '3-4' | '5-6' | '7-8' =
    numPlayers >= 7 ? '7-8' : numPlayers >= 5 ? '5-6' : '3-4';
  if (customMap) {
    const result = generateCustomMapBoard(customMap, rng);
    board = result.board;
    rng = result.rngState;
    if (customMap.seafarers) {
      islandChips = result.islandChips.length > 0 ? result.islandChips : undefined;
      unrevealedFogHexes =
        result.unrevealedFogHexes.length > 0
          ? result.unrevealedFogHexes
          : undefined;
    }
  } else if (hasExplorers) {
    const result = generateExplorersPiratesBoard(rng);
    board = result.board;
    rng = result.rngState;
    explorersBoard = result.setup;
  } else if (hasTraders) {
    const result = generateTradersBoard(
      settings.tradersScenarioId,
      rng,
      numPlayers,
    );
    board = result.board;
    rng = result.rngState;
    riverEdges = result.riverEdges.length > 0 ? result.riverEdges : undefined;
    rivers = result.rivers.length > 0 ? result.rivers : undefined;
    lakeHexId = result.lakeHexId ?? undefined;
    // 5-6 players: two lakes / two watering holes (lists kept only then).
    lakeHexIds = result.lakeHexIds.length > 1 ? result.lakeHexIds : undefined;
    wateringHoleHexIds =
      result.wateringHoleHexIds.length > 1 ? result.wateringHoleHexIds : undefined;
    fishingGrounds =
      result.fishingGrounds.length > 0 ? result.fishingGrounds : undefined;
    wateringHoleHexId = result.wateringHoleHexId ?? undefined;
    barbarianBoard = result.barbarianAttack ?? undefined;
    tradersBarbariansBoard = result.tradersBarbarians ?? undefined;
  } else if (settings.expansions.includes(SEAFARERS_EXPANSION_ID)) {
    const result = generateSeafarersBoard(settings.scenarioId, rng, numPlayers);
    seafarers = result;
    board = result.board;
    rng = result.rngState;
    islandChips = result.islandChips.length > 0 ? result.islandChips : undefined;
    unrevealedFogHexes =
      result.unrevealedFogHexes.length > 0 ? result.unrevealedFogHexes : undefined;
    // Wonders of Catan: every wonder tile in play starts unclaimed.
    if (result.wonderSites) {
      wonders = wondersForPlayerCount(numPlayers).map((w) => ({
        id: w.id,
        claimedBy: null,
        level: 0,
      }));
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
  if (hasCitiesKnights || hasExplorers) {
    devCardDeck = [];
  } else {
    let deck = devDeckFor(numPlayers);
    // Pirate Islands: 3p removes the Victory Point cards; 4+ treats them as
    // Knights (which only make warships in this scenario).
    if (seafarers?.pirateIslands) deck = pirateIslandsDevDeck(deck, numPlayers);
    [devCardDeck, rng] = shuffle(rng, deck);
  }

  // Forgotten Tribe: "place the 4 topmost cards from the development card
  // deck face down on the indicated edges."
  if (seafarers?.tribeTokens) {
    tribeTokens = seafarers.tribeTokens.map((t) => {
      if (t.type !== 'devCard') return { ...t, claimedBy: null };
      const card = devCardDeck[devCardDeck.length - 1];
      devCardDeck = devCardDeck.slice(0, -1);
      return { ...t, ...(card ? { devCard: card } : {}), claimedBy: null };
    });
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
          progressVpCards: [],
          defenderTokens: 0,
        }
      : {}),
    ...(hasTraders ? { gold: 0, bridges: [] } : {}),
    // Explorers & Pirates: each player starts with 2 gold.
    ...(hasExplorers ? { gold: EP_START_GOLD } : {}),
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

  // Beginner boards: seat everyone on a printed color, place its two
  // settlements and roads, pay the starred settlement's resources, and
  // skip the placement rounds. At 5 players one color is left inactive.
  let bank = bankFull(bankSizeFor(numPlayers));
  let inactiveSettlements: VertexId[] | undefined;
  if (startingSetup) {
    const placed = placeStartingPieces(startingSetup, board, players, playerOrder, bank, rng);
    placed.players.forEach((p, i) => (players[i] = p));
    bank = placed.bank;
    rng = placed.rngState;
    if (placed.inactiveSettlements.length > 0) inactiveSettlements = placed.inactiveSettlements;
  }

  // Seafarers / Pirate Islands: each player starts with a settlement and a
  // ship on the main island's coast, and a pirate fortress (3 lair tokens)
  // in their color on the western islands. Slots follow turn order.
  let pirateIslands: GameState['pirateIslands'];
  if (seafarers?.pirateIslands) {
    const pi = seafarers.pirateIslands;
    const fortresses = playerOrder.map((pid, i) => {
      const slot = pi.slots[i]!;
      const port = getPortAtVertex(board, slot.settlement);
      const idx = players.findIndex((p) => p.id === pid);
      const p = players[idx]!;
      players[idx] = {
        ...p,
        settlements: [...p.settlements, slot.settlement],
        ships: [...p.ships, slot.ship],
        warships: [],
        ports: port && !p.ports.includes(port) ? [...p.ports, port] : p.ports,
      };
      return { playerId: pid, vertex: slot.fortress, beachhead: slot.beachhead, lairs: PIRATE_LAIRS };
    });
    pirateIslands = {
      mainIsland: pi.mainIsland,
      path: pi.path,
      fleetIndex: pi.fleetIndex,
      ...(pi.noAttackHex ? { noAttackHex: pi.noAttackHex } : {}),
      fortresses,
    };
  }
  const scenarioRules =
    seafarers && settings.scenarioId ? getScenario(settings.scenarioId) : undefined;

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
    commodityBank = commoditiesFull(numPlayers >= 5 ? COMMODITY_BANK_SIZE_5_6 : COMMODITY_BANK_SIZE);
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

  // T&B coins and wealth tiles, for the scenarios that use them (Rivers of
  // Catan). Everyone starts at 0 gold, tied for least: each player takes a
  // Poor Catanian tile at the start (rulebook setup).
  const tradersScenario = hasTraders
    ? getTradersScenario(settings.tradersScenarioId ?? 'riversOfCatan')
    : undefined;
  const coinsInPlay = tradersScenario?.coins ? true : undefined;
  const wealthTilesInit = tradersScenario?.wealthTiles
    ? recalcWealthTiles({ players })
    : undefined;
  const strongestPortsInit = tradersVariants?.strongestPorts
    ? { holder: null }
    : undefined;
  // Catan Event Cards: the event deck replaces the dice.
  let eventCards: GameState['eventCards'];
  if (tradersVariants?.eventCards) {
    let deck;
    [deck, rng] = buildEventDeck(rng);
    eventCards = { deck, current: null };
  }

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
    [fishTokenPool, rng] = shuffle(rng, buildInitialFishPool(numPlayers));
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
  let wagonStarts: WagonStartPoint[] | undefined;
  if (isMerchantTrains) {
    wagons = [];
    // T&B 5-6 adds 11 wagons.
    wagonSupply = numPlayers >= 5 ? MERCHANT_WAGON_SUPPLY_5_6 : MERCHANT_WAGON_SUPPLY;
    wagonStarts = wateringHoleHexId
      ? resolveAllWagonStarts(board, wateringHoleHexIds ?? [wateringHoleHexId])
      : undefined;
    robberActive = false;
  }

  // Barbarian Attack seeding: barbarians on the 2 and the 12, the
  // scenario's own 26-card deck (the base development cards, the Largest
  // Army tile and the robber stay in the box), and coins in play.
  const isBarbarianAttack =
    hasTraders &&
    settings.tradersScenarioId === TRADERS_SCENARIO_BARBARIAN_ATTACK;
  let barbarianAttack: BarbarianAttackState | undefined;
  if (isBarbarianAttack && barbarianBoard) {
    [barbarianAttack, rng] = initialBarbarianAttackState(
      barbarianBoard,
      players.map((p) => p.id),
      rng,
    );
    devCardDeck = [];
    robberActive = false;
  }

  // Traders & Barbarians scenario: barbarians on edges, the commodity
  // stacks, the scenario's 25-card deck (no base cards, robber or Longest
  // Road), 5 gold each, coins in play. Wagons arrive with the setup cities.
  let tradersBarbarians: GameState['tradersBarbarians'];
  if (
    hasTraders &&
    settings.tradersScenarioId === TRADERS_SCENARIO_TRADERS_BARBARIANS &&
    tradersBarbariansBoard
  ) {
    [tradersBarbarians, rng] = initialTradersBarbariansState(
      tradersBarbariansBoard,
      players.map((p) => p.id),
      rng,
    );
    devCardDeck = [];
    robberActive = false;
    for (let i = 0; i < players.length; i++) players[i] = { ...players[i]!, gold: TB_START_GOLD };
  }

  // Pirate Islands has no robber at all.
  if (pirateIslands) robberActive = false;
  // Seafarers New World: the robber waits beside the frame.
  if (seafarers?.robberOffBoard) robberActive = false;

  // Explorers & Pirates: no robber, coins in play, 3:1 supply trades, no
  // Longest Road / Largest Army (the bonus tiles stay in the CATAN box).
  const explorersPirates = explorersBoard
    ? initialExplorersPiratesState(explorersBoard, playerOrder)
    : undefined;
  if (explorersPirates) robberActive = false;

  return {
    settings,
    rngState: rng,
    board,
    players,
    playerOrder,
    currentPlayerIndex: 0,
    // Beginner boards start at the first roll; everything else places its
    // starting pieces in the setup rounds.
    ...(startingSetup
      ? { phase: 'rollOrPlayKnight' as const }
      : {
          phase: 'setupRound1' as const,
          setupState: { step: 'settlement' as const, lastPlacedSettlement: null },
        }),
    ...(inactiveSettlements ? { inactiveSettlements } : {}),
    bank,
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
    ...(seafarers
      ? {
          startingIslands: seafarers.startingIslands,
          settlementBlockedHexes: seafarers.settlementBlockedHexes,
          robberBlockedHexes: seafarers.robberBlockedHexes,
          setupBlockedVertices: seafarers.setupBlockedVertices,
          wonderSites: seafarers.wonderSites,
          clothVillages: seafarers.clothVillages,
          clothSupply: seafarers.clothVillages ? CLOTH_GENERAL_SUPPLY : undefined,
          pirateIslands,
          noLongestRoad: scenarioRules?.noLongestRoad || undefined,
          noLargestArmy: scenarioRules?.noLargestArmy || undefined,
        }
      : {}),
    commodityBank,
    barbarian,
    robberActive,
    cityWalls: cityWallsByVertex,
    knights,
    knightSupply,
    metropolises,
    progressDecks,
    riverEdges,
    rivers,
    coinsInPlay,
    wealthTiles: wealthTilesInit,
    strongestPorts: strongestPortsInit,
    eventCards,
    lakeHexId,
    ...(lakeHexIds ? { lakeHexIds } : {}),
    fishingGrounds,
    fishTokenPool,
    fishTokenDiscard,
    oldBootHolder,
    wateringHoleHexId,
    ...(wateringHoleHexIds ? { wateringHoleHexIds } : {}),
    wagons,
    wagonSupply,
    wagonStarts,
    merchantTrains: isMerchantTrains ? [] : undefined,
    ...(barbarianAttack
      ? { barbarianAttack, coinsInPlay: true, noLargestArmy: true }
      : {}),
    ...(explorersPirates
      ? {
          explorersPirates,
          coinsInPlay: true,
          supplyTradeRate: EP_SUPPLY_RATE,
          noLongestRoad: true,
          noLargestArmy: true,
        }
      : {}),
    ...(tradersBarbarians
      ? {
          tradersBarbarians,
          coinsInPlay: true,
          noLongestRoad: true,
          roadBlockedEdges: tradersBarbarians.locations.flatMap((l) => l.xEdges),
          setupBlockedVertices: tradersBarbariansBoard?.setupBlocked,
        }
      : {}),
  };
}
