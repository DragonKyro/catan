// ============================================================================
// Resources
// ============================================================================

export type Resource = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';

export const RESOURCES: readonly Resource[] = [
  'wood',
  'brick',
  'sheep',
  'wheat',
  'ore',
] as const;

export type ResourceBank = Record<Resource, number>;

// ============================================================================
// Cities & Knights commodities
// ============================================================================

// Cities & Knights adds three commodities. Cities adjacent to wood/sheep/ore
// hexes produce both their resource and the matching commodity on a roll.
// Commodities are spendable on city improvements / progress card abilities,
// counted toward the 7-roll discard threshold, and stealable by the robber.
export type Commodity = 'paper' | 'cloth' | 'coin';

export const COMMODITIES: readonly Commodity[] = ['paper', 'cloth', 'coin'] as const;

export type CommodityBank = Record<Commodity, number>;

// Anything that can change hands with the supply under Cities & Knights.
export type TradeGood = Resource | Commodity;

// Maps the base-game terrain to the commodity its cities produce. Wheat and
// brick fields don't produce a commodity — their cities just yield 2 of the
// base resource (per the rulebook).
export const TERRAIN_TO_COMMODITY: Partial<Record<Resource, Commodity>> = {
  wood: 'paper',
  sheep: 'cloth',
  ore: 'coin',
};

// The third die rolled in Cities & Knights. Three faces are barbarian-ship
// (advance the track / trigger an attack) and the other three are the city
// improvement icons that determine which progress-card deck draws this turn.
export type EventDieFace = 'barbarian' | 'science' | 'trade' | 'politics';

export const EVENT_DIE_FACES: readonly EventDieFace[] = [
  'barbarian',
  'barbarian',
  'barbarian',
  'science',
  'trade',
  'politics',
] as const;

export interface BarbarianState {
  // Track position. Starts at 0; rulebook track has 7 spaces — the ship
  // attacks when `position` first reaches `BARBARIAN_TRACK_LENGTH`.
  position: number;
  // How many attacks have resolved so far. Useful for UI + log derivation
  // (the very first attack also activates the robber).
  attacksResolved: number;
}

// ============================================================================
// Cities & Knights — knights, improvements, progress cards
// ============================================================================

// Knight strength. 1=basic, 2=strong, 3=mighty.
export type KnightStrength = 1 | 2 | 3;

export interface KnightRecord {
  playerId: PlayerId;
  strength: KnightStrength;
  active: boolean;
  // Set when this knight was stood up this turn (Activate, Encouragement, an
  // active Treason placement). Rulebook p.9: only knights that were active
  // at the start of the Action phase may take a knight action. Cleared at
  // endTurn. Read through `knightCanAct` (knights/legal.ts).
  activatedThisTurn?: true;
  // Set when this knight was promoted this turn: a knight may only be
  // promoted once per turn (p.9, Smithing p.14). Cleared at endTurn.
  promotedThisTurn?: true;
}

// Per-player supply of knight tokens by strength. Rulebook ships 2 of each.
export type KnightSupply = Record<PlayerId, Record<KnightStrength, number>>;

// Three city-improvement tracks. Each player has a level 0..5 on each track.
export type ImprovementTrack = 'science' | 'trade' | 'politics';

export const IMPROVEMENT_TRACKS: readonly ImprovementTrack[] = [
  'science',
  'trade',
  'politics',
] as const;

export type ImprovementLevels = Record<ImprovementTrack, number>;

// Which commodity feeds which improvement track.
export const TRACK_COMMODITY: Record<ImprovementTrack, Commodity> = {
  science: 'paper',
  trade: 'cloth',
  politics: 'coin',
};

export interface MetropolisRecord {
  playerId: PlayerId;
  // City vertex hosting the metropolis.
  vertex: VertexId;
  // True once the owner has reached level 5 — locked, can no longer be
  // taken by another player.
  permanent: boolean;
}

// Progress card kinds (rulebook p.13-16). 18 per deck × 3 decks = 54 cards.
// The two VP cards (printing, constitution) are auto-revealed when drawn
// (they don't count toward the 4-card hand limit).
export type ProgressCardKind =
  // Science (18 = 2+2+1+2+2+2+2+2+2+1)
  | 'alchemy'
  | 'crane'
  | 'engineering'
  | 'invention'
  | 'irrigation'
  | 'medicine'
  | 'mining'
  | 'progressRoadBuilding'
  | 'smithing'
  | 'printing'
  // Trade (18 = 2+2+6+2+4+2)
  | 'commercialHarborCard'
  | 'guildDues'
  | 'merchantCard'
  | 'merchantFleet'
  | 'resourceMonopoly'
  | 'tradeMonopoly'
  // Politics (18 = 2+2+3+2+2+2+2+1+2)
  | 'diplomacy'
  | 'encouragement'
  | 'espionage'
  | 'intrigue'
  | 'sabotage'
  | 'taxation'
  | 'treason'
  | 'constitution'
  | 'wedding';

export interface ProgressCardHand {
  science: ProgressCardKind[];
  trade: ProgressCardKind[];
  politics: ProgressCardKind[];
}

// ============================================================================
// Terrain & hexes
// ============================================================================

export type Terrain =
  | Resource
  | 'desert'
  | 'sea'
  | 'gold'
  | 'swamp'
  | 'lake'
  | 'wateringHole'
  | 'castle';

export interface HexCoord {
  q: number;
  r: number;
}

export type HexId = string;

export interface Hex {
  id: HexId;
  coord: HexCoord;
  terrain: Terrain;
  numberToken: number | null;
  // Further numbers this hex also produces on, beyond `numberToken`. Absent
  // on ordinary hexes. Traders & Barbarians uses it for the Rivers of Catan
  // hex that carries both the 12 and the 2 disc, and for Fishing on Catan's
  // lake (printed 2 / 3 / 11 / 12). Read a hex's numbers through
  // `hexNumbers` / `hexRollsOn` in src/game/board/hexNumbers.ts.
  extraNumbers?: number[];
  corners: VertexId[]; // 6 vertex IDs in clockwise order, for SVG polygon rendering
  center: { x: number; y: number }; // pixel center of the hex
}

// ============================================================================
// Vertices & edges (graph derived from hex corners)
// ============================================================================

export type VertexId = string;
export type EdgeId = string;

export interface Vertex {
  id: VertexId;
  position: { x: number; y: number };
  hexes: HexId[];
  edges: EdgeId[];
  neighborVertices: VertexId[];
}

export interface Edge {
  id: EdgeId;
  vertices: [VertexId, VertexId];
  hexes: HexId[];
  neighborEdges: EdgeId[];
}

// ============================================================================
// Ports
// ============================================================================

export type PortType = 'generic' | Resource;

export interface Port {
  edge: EdgeId;
  type: PortType;
}

// ============================================================================
// Board
// ============================================================================

export interface BoardState {
  hexes: Record<HexId, Hex>;
  vertices: Record<VertexId, Vertex>;
  edges: Record<EdgeId, Edge>;
  ports: Port[];
  robberHex: HexId;
  hexIds: HexId[];
  vertexIds: VertexId[];
  edgeIds: EdgeId[];
  // Seafarers extension: present when the 'seafarers' expansion is active.
  pirateHex?: HexId;
  islandOfHex?: Record<HexId, string>;
  // Base-game Volcano scenario: the hex that erupts on its number roll.
  // When set, setup placement is blocked on any vertex adjacent to this hex
  // and the dice handler destroys a random adjacent building inline when
  // the volcano's number is rolled (settlements vanish, cities downgrade).
  volcanoHex?: HexId;
}

// ============================================================================
// Players & dev cards
// ============================================================================

export type PlayerId = string;
export type PlayerColor =
  | 'red'
  | 'blue'
  | 'orange'
  | 'white'
  | 'purple'
  | 'pink'
  | 'teal'
  | 'gold'
  | 'lime'
  | 'brown'
  | 'black'
  | 'forest'
  | 'lavender'
  | 'maroon';

export type DevCardType =
  | 'knight'
  | 'roadBuilding'
  | 'yearOfPlenty'
  | 'monopoly'
  | 'victoryPoint';

export interface DevCardHand {
  unplayed: DevCardType[];
  boughtThisTurn: DevCardType[];
  playedKnights: number;
  victoryPoints: number;
}

export interface Player {
  id: PlayerId;
  name: string;
  color: PlayerColor;
  isAI: boolean;
  resources: ResourceBank;
  devCards: DevCardHand;
  settlements: VertexId[];
  cities: VertexId[];
  roads: EdgeId[];
  ports: PortType[];
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
  // Seafarers extension. `ships` is always initialised to []; only ever
  // non-empty when the 'seafarers' expansion is active.
  ships: EdgeId[];
  movedShipThisTurn?: boolean;
  // Seafarers: ships built during the current turn. They may not be moved
  // this turn (rulebook p.2). Cleared when the turn advances.
  builtShipsThisTurn?: EdgeId[];
  // Seafarers / Forgotten Tribe: ports picked up from the tribe that the
  // player has not placed yet (no valid coastal-settlement edge at pickup
  // time). Placed as soon as a valid edge exists.
  heldPorts?: PortType[];
  // Seafarers / Forgotten Tribe: VP tokens picked up by ships (1 VP each).
  tribeVp?: number;
  // Seafarers / Cloth for Catan: cloth tokens collected from villages. Not a
  // resource — can't be traded or spent. Each pair is worth 1 VP.
  cloth?: number;
  // Seafarers / Pirate Islands: ships converted to warships with Knight
  // cards. Subset of `ships`. Strength against the pirates = count.
  warships?: EdgeId[];
  // Cities & Knights commodity hand (paper / cloth / coin). Empty bank when
  // the expansion isn't active. Note: `Player.cloth` (Seafarers cloth tokens)
  // and `commodities.cloth` (C&K commodity) are distinct — the two
  // expansions are mutually exclusive in Phase 1, so collisions can't happen.
  commodities?: CommodityBank;
  // Cities & Knights: number of city walls built (0-3). Each wall adds 2 to
  // the player's 7-roll hand-limit; a city wall comes off if a wall'd city is
  // pillaged.
  cityWalls?: number;
  // Cities & Knights: improvement track levels (0..5 each). Only populated
  // under C&K.
  improvements?: ImprovementLevels;
  // Cities & Knights: progress card hand by track. Secret, counted toward
  // the 4-card hand limit. Victory Point cards never sit here.
  progressCards?: ProgressCardHand;
  // Cities & Knights: Victory Point progress cards (Printing, Constitution)
  // placed face up in the player area as soon as they're drawn (p.10). Not
  // part of the hand: no limit, no Espionage, worth 1 VP each.
  progressVpCards?: ProgressCardKind[];
  // Cities & Knights: number of "Defender of Catan" VP tokens earned by
  // contributing the most defender strength when the barbarians lost. 1 VP
  // each.
  defenderTokens?: number;
  // Traders & Barbarians: coins / gold pieces. Earned by building on river
  // tiles (1/build) and bridges (3/build), or by trading resources to the
  // supply at the player's normal bank trade rate. Spent 2-for-1 to buy any
  // resource (max twice per turn). Not part of the resource hand — does not
  // count toward the 7-roll discard threshold and can't be stolen.
  gold?: number;
  // Traders & Barbarians / Rivers of Catan: edges where this player has built
  // a bridge. Bridges count as roads for Longest Road but are separate
  // pieces with their own placement rule (must sit on a river edge).
  bridges?: EdgeId[];
  // Traders & Barbarians / Fishing on Catan: drawn fish tokens. Each entry
  // is a value token ('one' | 'two' | 'three' fish). The old boot is NOT a
  // fish token — it lives in `state.oldBootHolder`. Capped at 7 tokens per
  // the rulebook. Not a resource — doesn't count toward 7-roll discard,
  // can't be stolen by robber, can't be traded.
  fishTokens?: Array<'one' | 'two' | 'three'>;
}

// ----- Traders & Barbarians / Fishing on Catan -----

// Pool of fish tokens shipped with the scenario. 11 ones + 10 twos + 8
// threes = 29 fish tokens, plus a single 'oldBoot' acquired by whoever
// draws it (then visible to all). Discarded fish go to a face-up pile and
// the pile reshuffles into a fresh pool when the pool empties.
export type FishTokenType = 'one' | 'two' | 'three' | 'oldBoot';

// Fishing ground tile: a frame piece filling one of the six coastal "V"
// notches. It touches two coastal edges and so three corners of the island;
// when its number is rolled every settlement (1 fish) / city (2 fish) on one
// of those corners draws fish tokens. Not a hex: the robber never sits here.
export interface FishingGround {
  // The three coastal corners the tile touches (the notch's inner corner
  // is the middle one).
  vertices: VertexId[];
  // The two coastal edges the tile lies against.
  edges: EdgeId[];
  token: number;
}

// ----- Traders & Barbarians / Rivers of Catan -----

// One river tile: the hexes it runs through, from its source (inside the
// first hex, a mountain) downstream, plus the coastal edge where it meets
// the sea (null if it ends inland). Every edge the river crosses or meets is
// a bridge site (`state.riverEdges`).
export interface RiverPath {
  hexes: HexId[];
  mouth: EdgeId | null;
}

// ----- Traders & Barbarians / Merchant Trains -----

// A placed trade wagon. Neutral pieces — they're not owned by any player,
// but they extend the road of whichever player owns a road on the same
// edge. Wagons form merchant trains starting at the watering hole hex.
export interface TradeWagon {
  edge: EdgeId;
  // The intersection the wagon faces (the train's front when it was
  // placed). Wagons sit nose-to-tail, so this is what shows which way a
  // train runs. Optional for snapshots from before trains were modelled.
  front?: VertexId;
  // Id of the merchant train the wagon was added to.
  train?: number;
}

// One of the watering hole's three train start points (rulebook: its NW,
// NE and S corners). A new train's first wagon goes on `edge`, the edge
// leaving `corner` away from the watering hole, facing `head`.
export interface WagonStartPoint {
  label: 'NW' | 'NE' | 'S';
  corner: VertexId;
  edge: EdgeId;
  head: VertexId;
}

// A merchant train: a string of wagons from a watering-hole corner. Only
// the front (`head`) can be extended — trains never branch.
export interface MerchantTrain {
  id: number;
  start: VertexId;
  head: VertexId;
  // No more wagons can be added: it ran into another train's middle, was
  // merged into another train, or its front has no free edge left.
  ended: boolean;
  // The train this one merged into (its head met that train's head; the
  // merged train continues from there).
  mergedInto?: number;
}

// Where a wagon can go: the edge, plus the train it extends (null = start a
// new train on a start edge). The same edge can extend two different
// trains when their fronts face each other, so the pair is the identity.
export interface WagonPlacement {
  edge: EdgeId;
  train: number | null;
}

// A player's public bid in the voting round: wool and wheat cards laid face
// up (both 0 = the player passed).
export interface WagonVoteBid {
  sheep: number;
  wheat: number;
}

// State for the Merchant Trains voting round (end of a turn in which the
// active player built a settlement or city). Bids go round once, starting
// with the active player clockwise. With no absolute majority, every bidder
// then names one location for all of their votes (stage 'assign').
export interface WagonVoteState {
  // Player who acquired the wagon (the active player).
  acquirerId: PlayerId;
  // Everyone, starting with the active player, clockwise.
  order: PlayerId[];
  stage: 'bid' | 'assign';
  // Index of the next player to act: into `order` while bidding, into the
  // bidders (players with a bid of 1+, in `order`) while assigning.
  turn: number;
  // Bids placed so far (public).
  bids: Record<PlayerId, WagonVoteBid>;
  // Assign stage: the location each bidder gave their votes to.
  assignments: Record<PlayerId, WagonPlacement>;
}

// Mid-resolution: the voting closed and a player must choose where the
// wagon goes. `reason` is for the prompt / log.
export interface PendingWagonPlacement {
  placerId: PlayerId;
  reason?: 'majority' | 'mostVotes' | 'activePlayer' | 'noVotes';
}

// Outcome of the latest voting round, for the Scenario panel and the log.
export interface WagonVoteResult {
  acquirerId: PlayerId;
  bids: Record<PlayerId, WagonVoteBid>;
  assignments: Record<PlayerId, WagonPlacement>;
  // How the location was decided.
  decidedBy: 'majority' | 'location' | 'mostVotes' | 'activePlayer' | 'noVotes' | 'onlyOption';
  chooser: PlayerId | null;
  placement: WagonPlacement;
}

// ----- Traders & Barbarians / Catan Event Cards -----

export type EventCardKind =
  | 'beautifulDay'
  | 'calmSeas'
  | 'conflict'
  | 'earthquake'
  | 'epidemic'
  | 'goodNeighbors'
  | 'helpfulNeighbor'
  | 'newYear'
  | 'plentifulYear'
  | 'robberAttacks'
  | 'robberFlees'
  | 'tournament'
  | 'tradeAdvantage';

export interface EventCard {
  id: number;
  kind: EventCardKind;
  // Production number on the card's disc. null only for New Year.
  number: number | null;
}

// One answer an event is waiting for, from one player.
export interface EventChoice {
  playerId: PlayerId;
  // takeResource: pick 1 resource from the supply (Plentiful Year, Calm
  // Seas, Tournament). giveResource: give 1 card of your choice (Good
  // Neighbors: to `recipients[0]`, the player on your left; Helpful
  // Neighbor: to any of `recipients`). steal: take 1 random card from a
  // player of your choice, or pass (Conflict, Trade Advantage). damageRoad:
  // turn one of your roads sideways (Earthquake).
  kind: 'takeResource' | 'giveResource' | 'steal' | 'damageRoad';
  recipients?: PlayerId[];
}

export interface EventCardsState {
  // Face-down deck; index 0 is the top card.
  deck: EventCard[];
  // The card flipped this turn (shown in place of the dice). Kept until the
  // next flip.
  current: EventCard | null;
  // True when this turn's flip hit New Year and the deck was rebuilt.
  newYear?: boolean;
  // An event waiting on answers (phase 'eventResolution'); production for
  // `card.number` follows once `choices` is empty.
  pending?: {
    card: EventCard;
    choices: EventChoice[];
    // Good Neighbors: gifts are handed over together once everyone chose,
    // so nobody passes on a card they just received.
    gifts: Array<{ from: PlayerId; to: PlayerId; resource: Resource }>;
  };
}

// ----- Traders & Barbarians / Barbarian Attack -----

// The scenario's own 26-card development deck (rulebook p.15). A bought card
// is played at once.
export type BarbarianCardType = 'capture' | 'knighthood' | 'swiftKnight' | 'treason';

// Treason moves one barbarian. `from: null` = from the supply (only when the
// coastal hexes don't hold enough barbarians to move).
export interface BarbarianTreasonMove {
  from: HexId | null;
  to: HexId;
}

// Knight-loss die faces → the castle tile's three edge colours. Purple = the
// edges parallel to a hex's NW and SE edges ("/"), green = parallel to NE and
// SW ("\"), brown = the vertical W / E edges.
export type BarbarianEdgeColor = 'purple' | 'green' | 'brown';

// One victory over the barbarians on a coastal hex (expel step), kept for
// the log and the scenario panel.
export interface BarbarianExpelResult {
  hex: HexId;
  barbarians: number;
  // Knights on the hex's edges, per involved player.
  knights: Record<PlayerId, number>;
  prisoners: Record<PlayerId, number>;
  // Involved players who got no prisoner (3 gold each instead).
  consolation: PlayerId[];
  // Tie-break dice (2d6 sums), in the order rolled, when any were needed.
  rolls?: Record<PlayerId, number[]>;
  // The hex was conquered and is now liberated.
  liberated: boolean;
  lossDie: number;
  lossColor: BarbarianEdgeColor;
  knightsLost: Record<PlayerId, number>;
}

export type BarbarianAttackEvent =
  | {
      kind: 'landing';
      playerId: PlayerId;
      // The accepted rolls (7s and repeats were re-rolled), in order.
      rolls: Array<{ dice: [number, number]; hex: HexId; placed: boolean; conquered: boolean }>;
      // The supply ran out before the third roll.
      supplyEmpty: boolean;
    }
  | {
      kind: 'cardDrawn';
      playerId: PlayerId;
      card: BarbarianCardType;
      // Capture cards drawn first and discarded (no barbarian to capture).
      skippedCaptures: number;
      // The card could not be used (no knight left / no free castle edge /
      // no legal Treason move) and was discarded.
      wasted: boolean;
    }
  | { kind: 'expel'; playerId: PlayerId; results: BarbarianExpelResult[] };

export interface BarbarianAttackState {
  // Barbarians standing on each coastal hex (0-3). Missing key = 0. Three
  // barbarians = the hex is conquered.
  barbarians: Record<HexId, number>;
  // Barbarians next to the board. 36 total = supply + on hexes + prisoners.
  supply: number;
  // The 12 coastal hexes in expel order: clockwise from the 4 next to the
  // castle, ending with the castle hex.
  coastalHexes: HexId[];
  castleHex: HexId;
  // Knights on edges. One knight per edge.
  knights: Record<EdgeId, PlayerId>;
  // Barbarians taken prisoner, per player. Every 2 = 1 VP.
  prisoners: Record<PlayerId, number>;
  // Face-down development deck (drawn from the end) and the discard pile
  // (reshuffled with the seeded RNG when the deck runs out).
  deck: BarbarianCardType[];
  discard: BarbarianCardType[];
  // A bought card waiting for its choice (phase 'barbarianCard').
  pendingCard?: { playerId: PlayerId; card: BarbarianCardType };
  // End-of-turn knight movement (phase 'barbarianKnightMoves'): edges where
  // a knight already moved this turn sits.
  movedKnights?: EdgeId[];
  // Events produced by the most recent action that produced any (landing
  // rolls, card draws, expel results). `seq` increments each time so the log
  // can tell a new batch from an old one.
  lastEvents?: { seq: number; events: BarbarianAttackEvent[] };
}

// ============================================================================
// Game phase & state
// ============================================================================

export type GamePhase =
  | 'setupRound1'
  | 'setupRound2'
  // Seafarers / Cloth for Catan: a third starting settlement, placed in
  // normal turn order after the snake rounds.
  | 'setupRound3'
  | 'rollOrPlayKnight'
  | 'discard'
  | 'moveRobber'
  | 'main'
  | 'gameOver'
  // Traders & Barbarians / Merchant Trains: end-of-turn voting + placement.
  | 'wagonVoting'
  | 'placeWagon'
  // Traders & Barbarians / Barbarian Attack: the choice for a development
  // card played on purchase, and the end-of-turn knight movement step.
  | 'barbarianCard'
  | 'barbarianKnightMoves'
  // Traders & Barbarians / Catan Event Cards: players answer the flipped
  // event (pick / give / steal / damage a road) before production.
  | 'eventResolution'
  // Traders & Barbarians / Fishing on Catan: players whose fish draws hit
  // the 7-token cap this production decide (in turn order) whether to swap
  // one token for a fresh draw (`swapFish`).
  | 'fishSwap'
  // Seafarers extension phases.
  | 'chooseRobberOrPirate'
  | 'movePirate'
  | 'chooseGoldResource'
  // Seafarers / Forgotten Tribe: place a port picked up from the tribe.
  | 'placeTribePort'
  // Seafarers / Pirate Islands: there is no robber; on a 7 the roller
  // steals one random card from any player.
  | 'stealResource'
  // Cities & Knights sub-phases. All transitions live on the C&K module.
  | 'displacedKnightMove'
  | 'placeMetropolis'
  | 'chooseProgressCardPick'
  | 'progressCardDiscard'
  | 'placeMerchant'
  | 'removeRoad'
  | 'treasonRemoveKnight'
  | 'treasonPlaceKnight'
  | 'commercialHarborOffer'
  | 'weddingGive'
  | 'aqueductPick'
  // Barbarians driven off with a tie at the top: each tied player draws a
  // progress card from the deck of their choice (pendingDefenderTieDraw).
  | 'defenderTieDraw'
  // Barbarians won: a losing player with 2+ pillageable cities picks which
  // one is reduced to a settlement (pendingPillage).
  | 'choosePillage';

export interface SetupState {
  step: 'settlement' | 'road';
  lastPlacedSettlement: VertexId | null;
}

export interface DiscardState {
  required: Record<PlayerId, number>;
}

export interface RobberMoveContext {
  // 'knight' covers BOTH the legacy dev-card knight (base/Seafarers) and
  // the C&K "chase the robber" knight action. 'taxation' is C&K only.
  reason: 'sevenRoll' | 'knight' | 'taxation';
  returnTo: 'main' | 'rollOrPlayKnight';
}

export type AiLevel = 'easy' | 'normal' | 'hard';

export interface GameSettings {
  numPlayers: number;
  victoryPointsToWin: number;
  expansions: string[];
  // Optional scenario identifier. Currently used by the Seafarers expansion
  // to pick between 'headingForNewShores' / 'fourIslands' / 'fogIsland'.
  scenarioId?: string;
  // Optional base-game scenario identifier. Picks between the colonist.io-
  // style Fun Maps ('standard' / 'goldRush' / 'volcano' / 'blackForest' /
  // 'diamond' / 'gear' / 'lakes' / 'pond' / 'twirl'). Ignored when the
  // Seafarers expansion is active. Defaults to 'standard'.
  baseScenarioId?: string;
  // Per-turn time limit for human players, in seconds. 0/undefined = no
  // limit. Resets on every turn change. When the timer hits zero the UI
  // auto-finishes any committed sub-phase (discard / robber / etc.) using
  // AI defaults, then ends the turn. AI seats ignore this — they pace
  // themselves via AIDriver.
  turnTimerSec?: number;
  // Strength of every AI seat in a base game (standard board, no
  // expansions): a trained network from src/ai/nn (easy / normal / hard).
  // Other rule sets — and a base game without it — use the heuristic AI.
  aiLevel?: AiLevel;
  // Traders & Barbarians: scenario picker (currently only 'riversOfCatan').
  // Only consulted when expansions includes the T&B id. Mutually exclusive
  // with `scenarioId` (Seafarers) and `baseScenarioId` (Fun Maps).
  tradersScenarioId?: string;
  // Traders & Barbarians: opt-in variants layered on top of any game.
  // Variants are tiny rule modifiers shipped with the T&B box but composable
  // with base / Seafarers / Fun Map games.
  tradersVariants?: {
    // "Friendly Robber" — the robber may not go to a hex with a building of
    // a player who has only 2 (public) VPs. With no valid hex it goes to
    // the desert, stealing only from a neighbour with more than 2 VPs.
    // Variants work with any rule set (base, Seafarers, T&B scenarios).
    friendlyRobber?: boolean;
    // "Strongest Ports / Harbors of Catan" — the first player with 3 VPs
    // in buildings on harbors takes a 2 VP tile; a player with more takes
    // it over. Target VP bumps by 1 when on.
    strongestPorts?: boolean;
    // "Catan Event Cards" — an event deck replaces the dice: each turn
    // flips a card, resolves its event, then produces for its number.
    eventCards?: boolean;
  };
  // User-authored custom map. When set, overrides every other board source
  // (Seafarers scenario, Fun Map, base) — createGame routes through
  // `generateCustomMapBoard`. The map's `seafarers` flag determines whether
  // island chips / fog state are populated.
  customMap?: import('./customMap/types').CustomMap;
  // Number of starting-settlement rounds. 3 = Cloth for Catan (a third
  // settlement in normal order; only the third collects resources).
  // Set by createGame from the scenario; undefined = 2.
  setupRounds?: 2 | 3;
}

export interface PendingTrade {
  proposerId: PlayerId;
  give: Partial<ResourceBank>;
  receive: Partial<ResourceBank>;
  // Traders & Barbarians coins (only when `state.coinsInPlay`): gold the
  // proposer offers / asks for alongside (or instead of) cards.
  giveGold?: number;
  receiveGold?: number;
  // Cities & Knights: commodities on either side of the offer (p.7 "you may
  // trade any combination of resources and commodities").
  giveCommodities?: Partial<CommodityBank>;
  receiveCommodities?: Partial<CommodityBank>;
  // Players who have explicitly rejected this offer. Purely informational —
  // a rejection does not cancel the trade; the proposer can still wait for
  // another player to accept or for the timer/end-turn auto-cancel.
  rejectedBy: PlayerId[];
}

export interface GameState {
  settings: GameSettings;
  rngState: number;
  board: BoardState;
  players: Player[];
  playerOrder: PlayerId[];
  currentPlayerIndex: number;
  phase: GamePhase;
  setupState?: SetupState;
  discardState?: DiscardState;
  pendingRobberMove?: RobberMoveContext;
  pendingTrade?: PendingTrade;
  bank: ResourceBank;
  devCardDeck: DevCardType[];
  hasRolledThisTurn: boolean;
  hasPlayedDevCardThisTurn: boolean;
  tradesProposedThisTurn: number;
  largestArmy: { holder: PlayerId; size: number } | null;
  longestRoad: { holder: PlayerId; length: number } | null;
  lastRoll: { dice: [number, number]; total: number; player: PlayerId } | null;
  winner: PlayerId | null;
  // Which board layout this game uses. '5-6' = 5-6 player expansion (30 hexes,
  // 11 ports, 28 number tokens). '7-8' = unofficial 7-8 player extension
  // (37 hexes, 13 ports, 35 number tokens, scaled bank + dev deck). Both
  // 5+ player layouts use the 2022 paired-player turn rule.
  // Optional for backwards-compat with snapshots from before the expansion.
  boardVariant?: '3-4' | '5-6' | '7-8';
  // 5+ player paired-player rule: index of Player 1 (the dice-roller and full
  // trader) within `playerOrder`. Player 2 is derived as
  // `(turnHolderIndex + 3) % players.length`. During a paired turn,
  // `currentPlayerIndex` rotates between the two — equal to turnHolderIndex
  // when Player 1 is acting, equal to Player 2's index when Player 2 is acting.
  // Optional only for backwards-compat with snapshots that pre-date it;
  // 5+ player games always set it.
  turnHolderIndex?: number;
  // Per-player log of which resources they've given/received via TRADES
  // (bank trades + accepted player trades) during the current real turn.
  // Used by the AI to skip reverse / roundabout trade proposals — if you
  // just RECEIVED ore, you shouldn't immediately propose to GIVE ore. Cleared
  // when the turn-holder advances; entries are arrays-as-sets for wire
  // serialization (Sets don't survive JSON round-trips).
  tradeResourcesThisTurn?: Record<
    PlayerId,
    { given: Resource[]; received: Resource[] }
  >;
  // Per-player log of trade SHAPES already proposed this turn (whether
  // they were accepted, cancelled, or rejected). The AI consults this to
  // avoid re-proposing the exact same {give, receive} when opponents'
  // hands haven't changed since the last attempt — that's the loop that
  // drags games out. Cleared on real turn advance.
  proposedTradesThisTurn?: Record<
    PlayerId,
    Array<{ give: Partial<ResourceBank>; receive: Partial<ResourceBank> }>
  >;
  // Seafarers extension. All optional, only populated when expansion is active.
  pendingPirateMove?: RobberMoveContext;
  // `returnTo` records what phase to resume once every pending player has
  // picked. Defaults to 'main' (the gold-roll case). 'setupRound2' is used
  // when a gold-adjacent settlement was placed during setup round 2 — after
  // the pick is made we drop back into setup road placement.
  goldChoiceState?: {
    pending: Record<PlayerId, number>;
    returnTo?: 'main' | 'setupRound1' | 'setupRound2' | 'setupRound3' | 'rollOrPlayKnight';
    // Pirate Islands: the picks came from beating the pirate fleet on a 7;
    // once they're made, "Resolve a 7" starts (discards, then the steal).
    afterPicks?: 'resolveSeven';
  };
  islandChips?: IslandChip[];
  // Seafarers: island ids (see board.islandOfHex) that starting settlements
  // must touch. Undefined = anywhere.
  startingIslands?: string[];
  // Seafarers: land hexes that don't count as land for settlement placement
  // (Forgotten Tribe: hexes without a number disc; Cloth for Catan: the
  // small village islands). A settlement needs at least one adjacent land
  // hex outside this list.
  settlementBlockedHexes?: HexId[];
  // Seafarers: land hexes the robber may not be moved to (Forgotten Tribe:
  // hexes without a number disc; Cloth for Catan: the small islands).
  robberBlockedHexes?: HexId[];
  // Seafarers: vertices where starting settlements may not go (Wonders of
  // Catan: Great Wall / Great Bridge / "X" markers).
  setupBlockedVertices?: VertexId[];
  // Seafarers: the Longest Route / Largest Army tiles are returned to the box
  // in some scenarios (Cloth for Catan, Pirate Islands).
  noLongestRoad?: boolean;
  noLargestArmy?: boolean;
  // Seafarers / Forgotten Tribe: VP tokens, development cards and ports
  // placed on edges around the tribe's islands. Picked up by building or
  // moving a ship onto the edge.
  tribeTokens?: TribeToken[];
  // Seafarers / Forgotten Tribe: port being placed in the 'placeTribePort'
  // phase (taken from the placing player's `heldPorts`).
  pendingTribePort?: { playerId: PlayerId; portType: PortType };
  // Seafarers / Wonders of Catan: marker vertices that gate wonder claims
  // (Great Wall, Great Bridge, Lighthouse).
  wonderSites?: Partial<Record<WonderId, VertexId[]>>;
  // Seafarers / Cloth for Catan: the villages on the small islands, plus
  // the general cloth supply.
  clothVillages?: ClothVillage[];
  clothSupply?: number;
  // Seafarers / Pirate Islands state (fleet path, fortresses, last attack).
  pirateIslands?: PirateIslandsState;
  // Seafarers / Fog Island: hexes that start hidden under fog. Removed
  // from this list as players build settlements / roads / ships adjacent
  // to them. Empty / undefined when no fog is active. The terrain on the
  // hex itself is still set; we just gate the UI on this list and grant
  // the reveal bonus at the moment of unveiling.
  unrevealedFogHexes?: HexId[];
  // Seafarers / Wonders of Catan: one entry per wonder tile in play. A
  // player claims one wonder (meeting its requirement), then builds its
  // four levels. Completing level 4 wins; so does reaching the VP target
  // with a strictly higher wonder level than everyone else.
  wonders?: WonderState[];
  // ----- Cities & Knights extension -----
  // Commodity bank (paper / cloth / coin). Mirrors `bank` but for the three
  // C&K commodities. Decrements when cities produce commodities; refunds on
  // spend.
  commodityBank?: CommodityBank;
  // Barbarian track state — present iff C&K is active. Cleared back to {0,n}
  // when the barbarians attack.
  barbarian?: BarbarianState;
  // Last event-die face rolled this game. Stored for the UI to render the
  // event die alongside the production dice.
  lastEventDie?: EventDieFace;
  // Whether the robber is "active". In C&K the robber starts offshore — it
  // doesn't move or steal on 7s until the first barbarian attack resolves,
  // at which point it activates on the desert. Always considered true in
  // base / Seafarers games (the flag is just absent there).
  robberActive?: boolean;
  // Which city-vertices currently have a city wall built. Keyed by vertex
  // so the board renderer can find walls without scanning players. Walls
  // come off when the city is pillaged.
  cityWalls?: Record<VertexId, PlayerId>;
  // Knights placed on the board, keyed by vertex. Each knight tracks its
  // owner, strength (1/2/3), and active/inactive status. Vertices not in
  // the map have no knight.
  knights?: Record<VertexId, KnightRecord>;
  // Per-player supply of knight tokens remaining. Rulebook: 2 of each
  // strength per player.
  knightSupply?: KnightSupply;
  // Per-track metropolis owner. `null` means no one has reached level 4
  // yet. `permanent: true` means the holder reached level 5 first; no
  // other player can take it.
  metropolises?: Record<ImprovementTrack, MetropolisRecord | null>;
  // Three face-down progress card decks (drawn on the event die). Shuffled
  // at game start. Each draws from the top.
  progressDecks?: Record<ImprovementTrack, ProgressCardKind[]>;
  // The merchant piece (C&K progress card "Merchant"). Owner gets +1 VP
  // and a 2:1 trade rate on the hex's resource (not commodity).
  merchant?: { ownerId: PlayerId; hexId: HexId };
  // Per-turn flags reset on endTurn:
  // Deprecated: promotion is once per KNIGHT per turn
  // (KnightRecord.promotedThisTurn). Never set any more.
  promotedKnightThisTurn?: boolean;
  // Vertices of knights activated this turn (they can't take an action this
  // same turn, p.9). Kept for readers; the source of truth is
  // KnightRecord.activatedThisTurn (see knightCanAct).
  activatedKnightsThisTurn?: VertexId[];
  // Commercial Harbor played this turn: the active player may offer each
  // other player one resource (once each) for a commodity of their choice.
  commercialHarbor?: { offererId: PlayerId; offeredTo: PlayerId[] };
  // Set when endTurn found the active player over the 4-card progress limit:
  // once they've discarded down, the turn ends by itself.
  endTurnAfterProgressDiscard?: boolean;
  hasPlayedProgressCardThisTurn?: boolean;
  // Merchant Fleet card flag (this turn only): 2:1 on this resource/commodity.
  merchantFleetActive?: {
    kind: 'resource' | 'commodity';
    which: Resource | Commodity;
  };
  // Crane: next buildCityImprovement costs 1 fewer commodity.
  craneActive?: boolean;
  // Engineering: next buildCityWall is free.
  engineeringActive?: boolean;
  // Medicine: next buildCity costs 1 wheat + 2 ore (instead of 2+3).
  medicineActive?: boolean;
  // Diplomacy "remove own road" follow-up — true when the next buildRoad
  // is free because we just diplomatically removed one of our own roads.
  diplomacyFreeRoad?: boolean;
  // Alchemy pre-roll override. When set, the next rollDice uses these
  // values instead of the action payload.
  pendingAlchemy?: [number, number];
  // Sub-phase containers:
  pendingMetropolis?: { track: ImprovementTrack };
  pendingKnightMove?: {
    playerId: PlayerId;
    sourceVertex: VertexId;
    // Carried for the displaced-knight-move sub-phase so the engine knows
    // what strength piece to drop back on the board after the owner picks
    // their destination. Optional — only set when the knight is currently
    // off-board (post-displacement).
    knightStrength?: KnightStrength;
    knightActive?: boolean;
    returnTo: GamePhase;
  };
  // Progress-card pick state (Espionage, Guild Dues).
  progressPickState?: {
    kind: 'espionage' | 'guildDues';
    picker: PlayerId;
    targetId: PlayerId;
    remaining: number;
  };
  pendingTreason?: {
    attackerId: PlayerId;
    targetId: PlayerId;
    removedStrength?: KnightStrength;
    // Status of the removed knight: the attacker's replacement takes it.
    removedActive?: boolean;
  };
  pendingWedding?: { collector: PlayerId; remaining: PlayerId[] };
  // One Commercial Harbor offer in flight: `targetId` must answer with one of
  // their commodities in exchange for `resource`.
  pendingCommercialHarbor?: {
    offererId: PlayerId;
    targetId: PlayerId;
    resource: Resource;
  };
  // Barbarians won: players (in turn order from the active player) who must
  // pick which of their cities is pillaged.
  pendingPillage?: PlayerId[];
  // Progress card discard required after a draw pushed someone over the
  // 4-card cap. Same shape as `discardState.required` but for progress
  // cards.
  progressCardDiscardRequired?: Record<PlayerId, number>;
  // Aqueduct (science L3) free-pick state: after a production that gave
  // the player nothing, they get one free resource.
  pendingAqueduct?: PlayerId[];
  // Defender-of-Catan tie: when a barbarian attack is won but the top
  // contribution is tied across multiple players, each tied player draws
  // a progress card of their choice. Queued here in turn order.
  pendingDefenderTieDraw?: PlayerId[];
  // Production dice total held back while a barbarian attack still needs
  // answers (tie draws, pillage choices): cities pillaged by the attack
  // produce as settlements on the same roll (p.6: the event die resolves
  // before production). Set and consumed by the C&K roll flow.
  pendingProduction?: number;
  // Outcome of the most recent barbarian attack, for the tracker and log.
  lastBarbarianAttack?: {
    barbarianStrength: number;
    defenderStrength: number;
    outcome: 'defended' | 'pillaged';
    // Defended: the unique top contributor (VP token), or the tied players
    // who each draw a progress card.
    defender?: PlayerId;
    tied?: PlayerId[];
    // Pillaged: players who lose a city (filled in as choices resolve).
    losers?: PlayerId[];
  };
  // ----- Traders & Barbarians extension -----
  // Edges flagged as "river edges" by the active T&B scenario. Roads are
  // forbidden on these edges; bridges are the only structure that can
  // occupy them. Empty / undefined when T&B is inactive.
  riverEdges?: EdgeId[];
  // Rivers of Catan: the two river tiles (hexes source → mouth). Every
  // corner / edge of these hexes pays gold on build; the renderer draws the
  // water along them.
  rivers?: RiverPath[];
  // Traders & Barbarians scenarios that use coins (Rivers of Catan,
  // Barbarian Attack, Traders & Barbarians): enables `spendGold` (2 gold → 1
  // resource of choice, at most twice per turn) and `buyGold` (resources →
  // 1 gold at your bank trade rate). Set by createGame from the scenario.
  coinsInPlay?: boolean;
  // How many times the acting player has spent gold this turn (the
  // 2-per-turn cap). Cleared when a new turn starts.
  goldSpendsThisTurn?: number;
  // Wealthiest / Poor Catanian bonus tiles. Recalculated after every gold
  // change. `wealthiest` = unique max-gold player (≥ 1 gold; ties leave it
  // null). `poor` = all players strictly below the min — i.e. everyone tied
  // at the lowest gold count (which can be everyone at 0). Each Poor entry
  // is worth -2 VP; Wealthiest is +1 VP.
  wealthTiles?: {
    wealthiest: PlayerId | null;
    poor: PlayerId[];
  };
  // Strongest Ports variant: holder of the 2 VP "Strongest Ports" tile.
  // Recalculated after every settlement/city build. Holder must have ≥ 3 VPs
  // worth of buildings on ports (1 per port settlement, 2 per port city) and
  // strictly more than every other player. Ties leave it null.
  strongestPorts?: {
    holder: PlayerId | null;
  };
  // Traders & Barbarians / Fishing on Catan: face-down draw pile of fish
  // tokens (the 30-token bag: 11/10/8 fish + 1 old boot). Drawn one at a
  // time when settlements/cities on fishing grounds or the lake produce.
  // When empty, `fishTokenDiscard` is shuffled in to make a new pool.
  fishTokenPool?: FishTokenType[];
  // Face-up pile of discarded fish tokens (spent on actions, or from the
  // 7-token discard-and-replace rule). The boot never lands here — once
  // drawn it stays on a player until passed or game-end.
  fishTokenDiscard?: FishTokenType[];
  // Fishing ground tiles (anchor vertex + number token). 6 in the 3-4p
  // scenario, placed at the rulebook's coastal "V" notches.
  fishingGrounds?: FishingGround[];
  // Hex id of the lake (a non-resource hex with a number that produces fish
  // on roll). Robber may sit on the lake to block its production.
  lakeHexId?: HexId;
  // Fishing on Catan: present iff phase is 'fishSwap'. Players (turn order)
  // whose draws were cut off by the 7-token cap and may still swap one token.
  // `returnTo` is the phase play resumes in afterwards.
  fishSwap?: { queue: PlayerId[]; returnTo: GamePhase };
  // Holder of the old boot (≥1 extra VP needed to win). Drawn from the fish
  // pool. Players may pass it during their turn to any player with ≥ their
  // VPs. null when in the supply.
  oldBootHolder?: PlayerId | null;
  // Merchant Trains: hex id of the watering hole (non-producing centre hex,
  // origin of every merchant train).
  wateringHoleHexId?: HexId;
  // All placed trade wagons in the scenario. Neutral pieces — they extend
  // the road network of whichever player owns a road on the same edge.
  wagons?: TradeWagon[];
  // Remaining trade wagons in the supply. Starts at 22 (rulebook); decrements
  // each placement. When 0, no more wagons can be placed (and the voting
  // phase still runs but resolves to a no-op).
  wagonSupply?: number;
  // Did the active player build a building (settlement or city) in their
  // Action phase this turn? Earns the turn's wagon, placed in the voting
  // round when the turn ends. Roads and bridges don't count. Cleared when
  // the turn ends.
  builtThisTurn?: boolean;
  // The watering hole's three train start points (NW, NE, S corners).
  wagonStarts?: WagonStartPoint[];
  // Every merchant train on the board, in the order they were started.
  merchantTrains?: MerchantTrain[];
  // Voting state — present iff phase is 'wagonVoting'.
  wagonVote?: WagonVoteState;
  // Pending placement — present iff phase is 'placeWagon'. Resolved by a
  // `placeWagon` action.
  pendingWagonPlacement?: PendingWagonPlacement;
  // Traders & Barbarians / Barbarian Attack: barbarians on the coast, knights
  // on edges, prisoners and the scenario's development deck. Undefined in
  // every other game.
  barbarianAttack?: BarbarianAttackState;
  // The latest voting round's outcome (Scenario panel / log).
  lastWagonVote?: WagonVoteResult;
  // ----- Traders & Barbarians variant: Catan Event Cards -----
  // The event deck that replaces the dice (`tradersVariants.eventCards`).
  eventCards?: EventCardsState;
  // Earthquake: roads turned sideways. Their owners can't build roads until
  // they repair them all, and nobody may build a settlement at either end.
  // They still count for the Longest Route.
  damagedRoads?: EdgeId[];
}

// Seafarers island bonus. Every player earns an island's bonus once, on
// their first settlement there — it does not matter whether other players
// settled it first (rulebook). Islands a player started on are that
// player's home islands and never pay them a bonus.
export interface IslandChip {
  islandId: string;
  vp: number;
  // Players who have earned this island's bonus.
  claimedBy: PlayerId[];
  // Players for whom this is a home island (a starting settlement is here).
  homeOf: PlayerId[];
}

export type TribeTokenType = 'victoryPoint' | 'devCard' | 'port';

export interface TribeToken {
  edge: EdgeId;
  type: TribeTokenType;
  // type 'port': which port the tribe hands over.
  portType?: PortType;
  // type 'devCard': the face-down card (drawn from the deck at setup).
  devCard?: DevCardType;
  claimedBy: PlayerId | null;
}

export type WonderId =
  | 'grandCastle'
  | 'grandMonument'
  | 'greatBridge'
  | 'grandTheater'
  | 'greatWall'
  // Seafarers 5-6 player extension.
  | 'lighthouse'
  | 'greatLibrary';

export interface WonderState {
  id: WonderId;
  // The player who claimed this wonder (each player may claim one). Locked
  // for the rest of the game.
  claimedBy: PlayerId | null;
  // Levels built, 0..4. Level 4 = complete.
  level: number;
}

// Cloth for Catan village: a number disc on a small-island intersection.
export interface ClothVillage {
  vertex: VertexId;
  number: number;
  // Cloth tokens left next to this village. 0 = exhausted (no production).
  supply: number;
  // Players who established trade relations (a route from one of their
  // buildings to this village).
  partners: PlayerId[];
}

// Pirate Islands fortress: a pirate-held settlement in one player's color.
export interface PirateFortress {
  playerId: PlayerId;
  vertex: VertexId;
  // The player's beachhead marker: their western line of ships must pass
  // here, and they may build a settlement here once it arrives.
  beachhead: VertexId;
  // Pirate lair tokens left (3 → 0). 0 = recaptured (becomes a settlement).
  lairs: number;
}

export interface PirateIslandsState {
  // Island id (board.islandOfHex) of the eastern main island. Everything
  // else is a pirate island.
  mainIsland: string;
  // The pirate fleet's loop of sea hexes, in travel order.
  path: HexId[];
  // Seafarers 5-6: the fleet doesn't attack from this hex.
  noAttackHex?: HexId;
  // Index into `path` of the fleet's hex. -1 once every fortress is
  // recaptured and the pirate ship is removed.
  fleetIndex: number;
  fortresses: PirateFortress[];
  // Most recent fleet attack, for the log / UI.
  lastFleetAttack?: {
    hex: HexId;
    strength: number;
    results: Array<{
      playerId: PlayerId;
      warships: number;
      outcome: 'lost' | 'won' | 'tied';
      discarded: number;
    }>;
  };
  // Most recent fortress attack, for the log / UI.
  lastFortressAttack?: {
    playerId: PlayerId;
    die: number;
    warships: number;
    outcome: 'won' | 'lost' | 'tied';
    shipsLost: number;
    captured: boolean;
  };
}

// ============================================================================
// Actions (discriminated union)
// ============================================================================

interface ActionBase {
  type: string;
  playerId: PlayerId;
}

export interface PlaceInitialSettlementAction extends ActionBase {
  type: 'placeInitialSettlement';
  vertex: VertexId;
}

export interface PlaceInitialRoadAction extends ActionBase {
  type: 'placeInitialRoad';
  edge: EdgeId;
}

export interface RollDiceAction extends ActionBase {
  type: 'rollDice';
  // [red, yellow]. In the base game both dice are interchangeable and only
  // the sum matters. Under Cities & Knights they're distinct: the RED die
  // alone determines whether a progress card draws this turn (it must be
  // <= your level on the matching city-improvement track), while the sum
  // still drives normal production. Roll order is therefore semantic, not
  // just visual: keep dice[0] = red, dice[1] = yellow everywhere.
  dice: [number, number];
}


export interface DiscardAction extends ActionBase {
  type: 'discard';
  resources: Partial<ResourceBank>;
}

export interface MoveRobberAction extends ActionBase {
  type: 'moveRobber';
  hex: HexId;
  stealFrom: PlayerId | null;
}

export interface BuildSettlementAction extends ActionBase {
  type: 'buildSettlement';
  vertex: VertexId;
}

export interface BuildCityAction extends ActionBase {
  type: 'buildCity';
  vertex: VertexId;
}

export interface BuildRoadAction extends ActionBase {
  type: 'buildRoad';
  edge: EdgeId;
}

export interface BuyDevCardAction extends ActionBase {
  type: 'buyDevCard';
}

export interface PlayKnightAction extends ActionBase {
  type: 'playKnight';
}

export interface PlayRoadBuildingAction extends ActionBase {
  type: 'playRoadBuilding';
  // Free roads, placed in order.
  edges: EdgeId[];
  // Seafarers: free ships, placed after the roads. Roads + ships <= 2.
  ships?: EdgeId[];
}

export interface PlayYearOfPlentyAction extends ActionBase {
  type: 'playYearOfPlenty';
  resources: [Resource, Resource];
}

export interface PlayMonopolyAction extends ActionBase {
  type: 'playMonopoly';
  resource: Resource;
}

export interface BankTradeAction extends ActionBase {
  type: 'bankTrade';
  give: Resource;
  receive: Resource;
  // How many `receive` cards to trade for. Player gives `rate * count` of
  // `give`. Defaults to 1 when omitted (back-compat with single-trade flow).
  count?: number;
}

export interface ProposeTradeAction extends ActionBase {
  type: 'proposeTrade';
  give: Partial<ResourceBank>;
  receive: Partial<ResourceBank>;
  // T&B coins: gold offered / asked (see PendingTrade).
  giveGold?: number;
  receiveGold?: number;
  // Cities & Knights: commodities in the offer.
  giveCommodities?: Partial<CommodityBank>;
  receiveCommodities?: Partial<CommodityBank>;
}

export interface AcceptTradeAction extends ActionBase {
  type: 'acceptTrade';
}

export interface CancelTradeAction extends ActionBase {
  type: 'cancelTrade';
}

export interface RejectTradeAction extends ActionBase {
  type: 'rejectTrade';
}

export interface CounterTradeAction extends ActionBase {
  type: 'counterTrade';
  give: Partial<ResourceBank>;
  receive: Partial<ResourceBank>;
  // T&B coins: gold offered / asked (see PendingTrade).
  giveGold?: number;
  receiveGold?: number;
  // Cities & Knights: commodities in the counter-offer.
  giveCommodities?: Partial<CommodityBank>;
  receiveCommodities?: Partial<CommodityBank>;
}

export interface EndTurnAction extends ActionBase {
  type: 'endTurn';
}

// ----------------------------------------------------------------------------
// Seafarers expansion actions
// ----------------------------------------------------------------------------

export interface BuildShipAction extends ActionBase {
  type: 'buildShip';
  edge: EdgeId;
}

export interface MoveShipAction extends ActionBase {
  type: 'moveShip';
  from: EdgeId;
  to: EdgeId;
}

export interface ChooseRobberAction extends ActionBase {
  type: 'chooseRobber';
}

export interface ChoosePirateAction extends ActionBase {
  type: 'choosePirate';
}

export interface MovePirateAction extends ActionBase {
  type: 'movePirate';
  hex: HexId;
  stealFrom: PlayerId | null;
  // Cloth for Catan: steal a cloth token instead of a resource card.
  stealCloth?: boolean;
}

export interface ChooseGoldResourceAction extends ActionBase {
  type: 'chooseGoldResource';
  resources: Resource[];
}

// Wonders of Catan: claim a wonder tile (requirements must be met).
export interface ClaimWonderAction extends ActionBase {
  type: 'claimWonder';
  wonderId: WonderId;
}

// Wonders of Catan: build the next level of the player's claimed wonder.
export interface BuildWonderAction extends ActionBase {
  type: 'buildWonder';
  wonderId: WonderId;
}

// Seafarers setup: a coastal starting settlement may take a ship instead
// of a road.
export interface PlaceInitialShipAction extends ActionBase {
  type: 'placeInitialShip';
  edge: EdgeId;
}

// Forgotten Tribe: place a port picked up from the tribe.
export interface PlaceTribePortAction extends ActionBase {
  type: 'placeTribePort';
  edge: EdgeId;
}

// Pirate Islands: steal one random resource card from any player on a 7.
export interface StealResourceAction extends ActionBase {
  type: 'stealResource';
  stealFrom: PlayerId | null;
}

// ----------------------------------------------------------------------------
// Traders & Barbarians expansion actions
// ----------------------------------------------------------------------------

export interface BuildBridgeAction extends ActionBase {
  type: 'buildBridge';
  edge: EdgeId;
}

// Spend fish tokens for one of five effects. `tokens` lists which fish
// tokens are discarded — their summed face value must be ≥ the effect's
// cost (2/3/4/5/7). Excess fish is lost to the discard pile (rulebook:
// "you lose the excess fish"). `effect.kind` discriminates the action.
export type FishSpendEffect =
  | { kind: 'removeRobber' }
  // The stolen card is picked from the victim's hand with the seeded RNG
  // (same as a robber steal) so every peer reduces the same card.
  | { kind: 'steal'; target: PlayerId }
  | { kind: 'takeFromBank'; resource: Resource }
  | { kind: 'buildRoad'; edge: EdgeId }
  // Takes the top card of the development deck, free.
  | { kind: 'buyDevCard' };

export interface SpendFishAction extends ActionBase {
  type: 'spendFish';
  // Subset of fish-token TYPES (not full hand) being discarded. The values
  // must sum to ≥ the effect's cost; excess is forfeit. Only 'one' / 'two'
  // / 'three' tokens may be spent — the old boot is never spent.
  tokens: Array<'one' | 'two' | 'three'>;
  effect: FishSpendEffect;
}

// Fishing on Catan, 'fishSwap' phase: the player at the head of the queue
// discards one fish token and draws a replacement (`token`), or declines
// (`token: null`).
export interface SwapFishAction extends ActionBase {
  type: 'swapFish';
  token: 'one' | 'two' | 'three' | null;
}

// Coins (Rivers of Catan / Barbarian Attack): pay 2 gold for 1 resource
// card of your choice from the supply. At most twice per turn.
export interface SpendGoldAction extends ActionBase {
  type: 'spendGold';
  resource: Resource;
}

// Coins: trade resource cards to the supply for 1 gold, at your bank rate
// for that resource (4:1, 3:1 with a generic port, 2:1 with its port).
export interface BuyGoldAction extends ActionBase {
  type: 'buyGold';
  give: Resource;
}

// Hand the old boot to another player. Legal target: any other player whose
// total VP ≥ yours. The recipient now needs +1 VP to win.
export interface PassOldBootAction extends ActionBase {
  type: 'passOldBoot';
  to: PlayerId;
}

// Merchant Trains voting round, bid stage: the player whose turn it is lays
// any number of wool / wheat cards face up (none = pass). Only `sheep` and
// `wheat` may be set.
export interface SubmitWagonVoteAction extends ActionBase {
  type: 'submitWagonVote';
  cards: Partial<ResourceBank>;
}

// Merchant Trains voting round, assign stage (no absolute majority): a
// bidder gives all of their votes to one wagon location.
export interface AssignWagonVotesAction extends ActionBase {
  type: 'assignWagonVotes';
  location: WagonPlacement;
}

// Merchant Trains: the chosen player places the wagon. `train` names the
// train extended (null = start a new train); omitted, the engine picks the
// only placement on `edge` (the first, if two trains' fronts share it).
export interface PlaceWagonAction extends ActionBase {
  type: 'placeWagon';
  edge: EdgeId;
  train?: number | null;
}

// Catan Event Cards: answer the oldest open choice of this player in the
// current event. `resource` for take / give; `target` for give (Helpful
// Neighbor) and steal (null = don't steal); `edge` for Earthquake.
export interface ResolveEventAction extends ActionBase {
  type: 'resolveEvent';
  resource?: Resource | null;
  target?: PlayerId | null;
  edge?: EdgeId | null;
}

// Catan Event Cards / Earthquake: repair one of your damaged roads.
export interface RepairRoadAction extends ActionBase {
  type: 'repairRoad';
  edge: EdgeId;
}

// Barbarian Attack: the choice for the development card just bought
// (phase 'barbarianCard'). Capture names a coastal hex with a barbarian;
// Knighthood a free castle edge; Swift Knight any edge without a knight;
// Treason the two barbarian moves.
export interface ResolveBarbarianCardAction extends ActionBase {
  type: 'resolveBarbarianCard';
  hex?: HexId;
  edge?: EdgeId;
  moves?: BarbarianTreasonMove[];
}

// Barbarian Attack, end of turn (phase 'barbarianKnightMoves'): move one of
// your knights up to 3 edges, or up to 5 when `boost` pays 1 wheat. Each
// knight moves at most once a turn. `endTurn` finishes the step and expels
// the barbarians.
export interface MoveBarbarianKnightAction extends ActionBase {
  type: 'moveBarbarianKnight';
  from: EdgeId;
  to: EdgeId;
  boost?: boolean;
}

// ----------------------------------------------------------------------------
// Cities & Knights expansion actions
// ----------------------------------------------------------------------------

export interface BuildCityWallAction extends ActionBase {
  type: 'buildCityWall';
  vertex: VertexId;
}

// Discard action that may include both resources and commodities.
// Note: the existing `DiscardAction` only handles resources; Cities & Knights
// discards are routed through the C&K discard handler which accepts this
// extended payload. We don't merge them onto the same action shape because
// the base discard validation logic is simpler when it only sees resources.
export interface DiscardCKAction extends ActionBase {
  type: 'discardCK';
  resources: Partial<ResourceBank>;
  commodities: Partial<CommodityBank>;
}

// ----- Knights -----

export interface RecruitKnightAction extends ActionBase {
  type: 'recruitKnight';
  vertex: VertexId;
}

export interface ActivateKnightAction extends ActionBase {
  type: 'activateKnight';
  vertex: VertexId;
}

export interface PromoteKnightAction extends ActionBase {
  type: 'promoteKnight';
  vertex: VertexId;
}

export interface MoveKnightAction extends ActionBase {
  type: 'moveKnight';
  from: VertexId;
  to: VertexId;
}

export interface DisplaceKnightAction extends ActionBase {
  type: 'displaceKnight';
  from: VertexId;
  to: VertexId;
}

// Forced follow-up move dispatched by the displaced knight's owner.
export interface DisplacedKnightMoveAction extends ActionBase {
  type: 'displacedKnightMove';
  to: VertexId;
}

// "Chase the Robber" — own active knight adjacent to the robber initiates
// a robber move (followed by a standard moveRobber action).
export interface ChaseRobberAction extends ActionBase {
  type: 'chaseRobber';
  vertex: VertexId;
}

// ----- Improvements + metropolis -----

export interface BuildCityImprovementAction extends ActionBase {
  type: 'buildCityImprovement';
  track: ImprovementTrack;
}

export interface PlaceMetropolisAction extends ActionBase {
  type: 'placeMetropolis';
  track: ImprovementTrack;
  vertex: VertexId;
}

// Aqueduct (Science L3) free-resource pick — same shape as the Seafarers
// gold-resource pick.
export interface AqueductPickAction extends ActionBase {
  type: 'aqueductPick';
  resource: Resource;
}

// ----- Progress cards -----

export interface PlayProgressCardAction extends ActionBase {
  type: 'playProgressCard';
  card: ProgressCardKind;
  // Per-card payload — flat to keep the union simple. Handlers read only
  // the fields they care about.
  dice?: [number, number]; // alchemy
  fromHex?: HexId; // invention
  toHex?: HexId; // invention
  vertex?: VertexId; // medicine / engineering target, intrigue victim
  toVertex?: VertexId; // intrigue dest
  edges?: EdgeId[]; // progressRoadBuilding (0-2 roads)
  resource?: Resource; // resourceMonopoly, merchantFleet (if resource), guildDues target
  commodity?: Commodity; // tradeMonopoly, merchantFleet (if commodity)
  targetId?: PlayerId; // espionage, guildDues, treason, intrigue, taxation
  knightVertices?: VertexId[]; // smithing — which knights to promote
}

// Generic "pick a card from this hand" follow-up used by Espionage + Guild Dues.
// Espionage: omit `card` to take nothing ("you MAY choose to take 1 card").
export interface ChooseProgressCardPickAction extends ActionBase {
  type: 'chooseProgressCardPick';
  // For Espionage: which deck the picked card came from.
  deck?: ImprovementTrack;
  // The actual card kind taken (Espionage) or a resource/commodity (Guild Dues).
  card?: ProgressCardKind;
  resources?: Partial<ResourceBank>;
  commodities?: Partial<CommodityBank>;
}

// Open-road removal (Diplomacy).
export interface RemoveRoadAction extends ActionBase {
  type: 'removeRoad';
  edge: EdgeId;
}

// 4-card-limit follow-up: discard a progress card.
export interface DiscardProgressCardAction extends ActionBase {
  type: 'discardProgressCard';
  card: ProgressCardKind;
  deck: ImprovementTrack;
}

// Place the merchant on a land hex (Merchant progress card).
export interface PlaceMerchantAction extends ActionBase {
  type: 'placeMerchant';
  hex: HexId;
}

// Treason multi-step.
export interface TreasonRemoveKnightAction extends ActionBase {
  type: 'treasonRemoveKnight';
  vertex: VertexId;
}

// Omit vertex + strength to decline the placement ("you MAY then place").
export interface TreasonPlaceKnightAction extends ActionBase {
  type: 'treasonPlaceKnight';
  vertex?: VertexId;
  strength?: KnightStrength;
}

// Commercial Harbor (C&K card): the active player offers one opponent one
// of their resources (once per opponent per card).
export interface CommercialHarborProposeAction extends ActionBase {
  type: 'commercialHarborPropose';
  targetId: PlayerId;
  resource: Resource;
}

// Commercial Harbor reply: the offered player hands over a commodity of
// their choice and takes the resource. `null` is only accepted when they
// hold no commodity at all (the resource then goes back).
export interface CommercialHarborOfferAction extends ActionBase {
  type: 'commercialHarborOffer';
  commodity: Commodity | null;
}

// Cities & Knights bank trade with a commodity on either side (p.7):
// 4:1, 3:1 at a generic harbor, 2:1 with the Merchant Guild (trade level 3)
// or a Merchant Fleet naming the given good; resource 2:1 harbors only
// apply to their resource. Resource-for-resource trades stay `bankTrade`.
export interface BankTradeCKAction extends ActionBase {
  type: 'bankTradeCK';
  give: TradeGood;
  receive: TradeGood;
  count?: number;
}

// Barbarians won: pick which of your (non-metropolis) cities is pillaged.
export interface ChoosePillagedCityAction extends ActionBase {
  type: 'choosePillagedCity';
  vertex: VertexId;
}

// Wedding opponent give-back.
export interface WeddingGiveAction extends ActionBase {
  type: 'weddingGive';
  resources: Partial<ResourceBank>;
  commodities: Partial<CommodityBank>;
}

// Defender-of-Catan tie draw: pick which deck to take a card from.
export interface DefenderTieDrawAction extends ActionBase {
  type: 'defenderTieDraw';
  deck: ImprovementTrack;
}

export type Action =
  | PlaceInitialSettlementAction
  | PlaceInitialRoadAction
  | RollDiceAction
  | DiscardAction
  | MoveRobberAction
  | BuildSettlementAction
  | BuildCityAction
  | BuildRoadAction
  | BuyDevCardAction
  | PlayKnightAction
  | PlayRoadBuildingAction
  | PlayYearOfPlentyAction
  | PlayMonopolyAction
  | BankTradeAction
  | ProposeTradeAction
  | AcceptTradeAction
  | CancelTradeAction
  | RejectTradeAction
  | CounterTradeAction
  | EndTurnAction
  | BuildShipAction
  | MoveShipAction
  | ChooseRobberAction
  | ChoosePirateAction
  | MovePirateAction
  | ChooseGoldResourceAction
  | BuildWonderAction
  | ClaimWonderAction
  | PlaceInitialShipAction
  | PlaceTribePortAction
  | StealResourceAction
  | BuildBridgeAction
  | SpendFishAction
  | PassOldBootAction
  | SwapFishAction
  | SpendGoldAction
  | BuyGoldAction
  | SubmitWagonVoteAction
  | AssignWagonVotesAction
  | PlaceWagonAction
  | ResolveBarbarianCardAction
  | MoveBarbarianKnightAction
  | ResolveEventAction
  | RepairRoadAction
  | BuildCityWallAction
  | DiscardCKAction
  | RecruitKnightAction
  | ActivateKnightAction
  | PromoteKnightAction
  | MoveKnightAction
  | DisplaceKnightAction
  | DisplacedKnightMoveAction
  | ChaseRobberAction
  | BuildCityImprovementAction
  | PlaceMetropolisAction
  | AqueductPickAction
  | PlayProgressCardAction
  | ChooseProgressCardPickAction
  | RemoveRoadAction
  | DiscardProgressCardAction
  | PlaceMerchantAction
  | TreasonRemoveKnightAction
  | TreasonPlaceKnightAction
  | CommercialHarborProposeAction
  | CommercialHarborOfferAction
  | BankTradeCKAction
  | ChoosePillagedCityAction
  | WeddingGiveAction
  | DefenderTieDrawAction;

export type ActionType = Action['type'];

// ============================================================================
// Costs (base game)
// ============================================================================

export const COSTS: Record<
  | 'road'
  | 'settlement'
  | 'city'
  | 'devCard'
  | 'cityWall'
  | 'bridge'
  | 'knight'
  | 'activateKnight'
  | 'promoteKnight'
  | 'cityMedicine',
  Partial<ResourceBank>
> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  devCard: { sheep: 1, wheat: 1, ore: 1 },
  // Cities & Knights: city wall costs 2 brick.
  cityWall: { brick: 2 },
  // Cities & Knights: knight recruit / promote = 1 sheep + 1 ore.
  knight: { sheep: 1, ore: 1 },
  promoteKnight: { sheep: 1, ore: 1 },
  // Cities & Knights: activate = 1 wheat.
  activateKnight: { wheat: 1 },
  // Cities & Knights / Medicine progress card: city upgrade cost while the
  // card's effect is live.
  cityMedicine: { wheat: 1, ore: 2 },
  // Traders & Barbarians / Rivers of Catan: 2 brick + 1 lumber (rulebook
  // building-cost box). Pays +3 gold on build.
  bridge: { brick: 2, wood: 1 },
};
