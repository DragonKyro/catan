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
  // Seafarers / Forgotten Tribe: commercial harbor tokens awarded by tribe
  // hexes. Each token unconditionally lowers the player's bank trade rate
  // floor to 2:1 (better than generic 3:1 ports). Count, not boolean, so
  // future scenarios can stack effects if needed.
  commercialHarbors?: number;
  // Seafarers / Cloth for Catan: cloth tokens earned by settling adjacent
  // to a cloth-producing hex. Not a regular resource — can't be traded or
  // spent on builds. Worth 1 VP per 2 cloth at game end (Math.floor).
  cloth?: number;
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
  // Cities & Knights: progress card hand by track. VP cards stay here and
  // are visible (auto-flipped). Non-VP cards are secret and counted toward
  // the 4-card hand limit.
  progressCards?: ProgressCardHand;
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
  // Traders & Barbarians / Barbarian Attack: edges where this player has
  // hired a defender knight. T&B knights are simple stationary pieces
  // (no levels, no activation) — distinct from the C&K knight system
  // which uses `state.knights` keyed by vertex.
  defenderKnights?: EdgeId[];
}

// ----- Traders & Barbarians / Fishing on Catan -----

// Pool of fish tokens shipped with the scenario. 11 ones + 10 twos + 8
// threes = 29 fish tokens, plus a single 'oldBoot' acquired by whoever
// draws it (then visible to all). Discarded fish go to a face-up pile and
// the pile reshuffles into a fresh pool when the pool empties.
export type FishTokenType = 'one' | 'two' | 'three' | 'oldBoot';

// Fishing ground tile: placed on a frame edge at a coastal vertex. The tile
// has its own number token; on roll, the settlement/city at the anchor
// vertex (if any) draws fish tokens. Vertices uniquely identify a fishing
// ground (one per coastal "V" notch on the frame).
export interface FishingGround {
  // Anchor vertex on the main island. Settlements/cities on this vertex
  // earn fish when `token` is rolled.
  vertex: VertexId;
  token: number;
}

// ----- Traders & Barbarians / Merchant Trains -----

// A placed trade wagon. Neutral pieces — they're not owned by any player,
// but they extend the road of whichever player owns a road on the same
// edge. Wagons form merchant trains starting at the watering hole hex.
export interface TradeWagon {
  edge: EdgeId;
}

// A single bid in the end-of-turn voting round. `cards` is the wool/wheat
// stack the player has committed to the location at `target`. `target` is
// the edge they want the wagon placed on (`null` to abstain).
export interface WagonVoteBid {
  cards: Partial<ResourceBank>;
  target: EdgeId | null;
}

// State for the wagon-voting phase. Built when a player ends their action
// phase after having built ≥ 1 piece this turn (settlement / city / road
// / bridge). All players (including the active one) submit a bid; the
// engine auto-resolves once every player has spoken.
export interface WagonVoteState {
  // Player who acquired the wagon (the one who built and ended turn).
  // They receive the placement-fallback by default and break ties at the
  // edge level.
  acquirerId: PlayerId;
  // Submitted bids, keyed by player id. A player who hasn't submitted yet
  // is absent from the map.
  bids: Record<PlayerId, WagonVoteBid>;
}

// Mid-resolution: the voting closed and the placer has been chosen, but
// they still need to pick an edge (the bid-winner location was ambiguous).
// When the location is unambiguous after voting, we skip straight to
// placing the wagon and never enter this phase.
export interface PendingWagonPlacement {
  placerId: PlayerId;
}

// ----- Traders & Barbarians / Barbarian Attack -----

// One castle on the board. Three of these per Barbarian Attack scenario.
// `barbarianPath` walks from an outer sea hex inward to the castle; the
// barbarian piece advances along it one hex per endTurn. Combat resolves
// when `barbarianPosition === barbarianPath.length - 1`.
export interface CastleState {
  id: string;
  hexId: HexId;
  barbarianPath: HexId[];
  barbarianPosition: number;
  barbarianStrength: number;
  // VP accumulated by each player from successful defenses at this castle.
  // 1 VP per knight a player brought to a winning defense.
  defenderVp: Record<PlayerId, number>;
}

// ============================================================================
// Game phase & state
// ============================================================================

export type GamePhase =
  | 'setupRound1'
  | 'setupRound2'
  | 'rollOrPlayKnight'
  | 'discard'
  | 'moveRobber'
  | 'main'
  | 'gameOver'
  // Traders & Barbarians / Merchant Trains: end-of-turn voting + placement.
  | 'wagonVoting'
  | 'placeWagon'
  // Seafarers extension phases.
  | 'chooseRobberOrPirate'
  | 'movePirate'
  | 'chooseGoldResource'
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
  | 'aqueductPick';

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
  // Traders & Barbarians: scenario picker (currently only 'riversOfCatan').
  // Only consulted when expansions includes the T&B id. Mutually exclusive
  // with `scenarioId` (Seafarers) and `baseScenarioId` (Fun Maps).
  tradersScenarioId?: string;
  // Traders & Barbarians: opt-in variants layered on top of any game.
  // Variants are tiny rule modifiers shipped with the T&B box but composable
  // with base / Seafarers / Fun Map games.
  tradersVariants?: {
    // "Friendly Robber" — you may not place the robber on a hex whose only
    // adjacent buildings belong to players with ≤ 2 VPs. Falls back to the
    // desert when no valid hex exists.
    friendlyRobber?: boolean;
    // "Strongest Ports / Harbors of Catan" — the player with ≥ 3 VPs in
    // port-buildings holds a 2 VP bonus tile. Target VP bumps by 1 when on.
    strongestPorts?: boolean;
  };
}

export interface PendingTrade {
  proposerId: PlayerId;
  give: Partial<ResourceBank>;
  receive: Partial<ResourceBank>;
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
    returnTo?: 'main' | 'setupRound2';
  };
  islandChips?: IslandChip[];
  // Seafarers / Forgotten Tribe: friendly-tribe tokens placed on outer
  // islets. Claimed the first time any player settles on a vertex
  // adjacent to the token's hex. Each type has its own one-shot effect
  // (see TribeTokenType). Tokens stay on the board in `claimedBy` form so
  // the UI can render who got what.
  tribeTokens?: TribeToken[];
  // Seafarers / Fog Island: hexes that start hidden under fog. Removed
  // from this list as players build settlements / roads / ships adjacent
  // to them. Empty / undefined when no fog is active. The terrain on the
  // hex itself is still set; we just gate the UI on this list and grant
  // the reveal bonus at the moment of unveiling.
  unrevealedFogHexes?: HexId[];
  // Seafarers / Wonders of Catan: one entry per wonder defined for the
  // scenario. `builtBy` is null until a player builds the first level,
  // then locked to that player for the rest of the game (only one
  // builder per wonder). `level` increments to the wonder's max; on
  // reaching max the game ends with that player as winner.
  wonders?: WonderState[];
  // Seafarers / Pirate Islands: enemy fleet anchored at a sea hex.
  // Players attack it with ships; when strength hits 0 the fleet is
  // defeated and the player who landed the final blow gets a bonus VP.
  // The fleet is independent of the regular `board.pirateHex` (the
  // movable pirate token); both can coexist on the board.
  pirateFleet?: PirateFleet;
  // Per-turn flag: has the current player already attacked the fleet
  // this turn? Caps combat to one attack per turn so each player gets
  // a roughly proportional shot at the killing blow. Cleared on endTurn.
  attackedPirateThisTurn?: boolean;
  // Seafarers / Cloth for Catan: hexes that produce cloth tokens instead
  // of their regular resource on roll. Settled players get 1 cloth per
  // settlement, 2 per city — same multiplier as resources. Cloth lives
  // on player.cloth and converts to VP at 2:1 in scoring.
  clothHexes?: HexId[];
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
  promotedKnightThisTurn?: boolean;
  // Vertices of knights activated this turn — they can't take an action
  // this same turn (rulebook p.9 "you may not activate a knight and then
  // take an action with it on the same turn").
  activatedKnightsThisTurn?: VertexId[];
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
  };
  pendingWedding?: { collector: PlayerId; remaining: PlayerId[] };
  pendingCommercialHarbor?: { offererId: PlayerId; remaining: PlayerId[] };
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
  // ----- Traders & Barbarians extension -----
  // Edges flagged as "river edges" by the active T&B scenario. Roads are
  // forbidden on these edges; bridges are the only structure that can
  // occupy them. Empty / undefined when T&B is inactive.
  riverEdges?: EdgeId[];
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
  // Did the active player build at least one piece this turn? Determines
  // whether `endTurn` opens the voting phase. Cleared on turn advance.
  builtThisTurn?: boolean;
  // Voting state — present iff phase is 'wagonVoting'.
  wagonVote?: WagonVoteState;
  // Pending placement — present iff phase is 'placeWagon'. Resolved by a
  // `placeWagon` action.
  pendingWagonPlacement?: PendingWagonPlacement;
  // Barbarian Attack: three castles + their barbarian advance state. Empty /
  // undefined when the scenario isn't active.
  castles?: CastleState[];
  // Shared supply of defender knights left in the bag. Decrements on
  // hireKnight; refunded when knights die in combat. Distinct from
  // `state.knightSupply` (C&K, per-player by strength).
  barbarianKnightSupply?: number;
}

export interface IslandChip {
  islandId: string;
  vp: number;
  firstSettler: PlayerId | null;
}

export type TribeTokenType = 'devCard' | 'victoryPoint' | 'commercialHarbor';

export interface TribeToken {
  hexId: HexId;
  type: TribeTokenType;
  claimedBy: PlayerId | null;
}

export type WonderId =
  | 'greatWall'
  | 'greatBridge'
  | 'hangingGardens'
  | 'cathedral'
  | 'tradeOffice';

export interface WonderState {
  id: WonderId;
  // Player who first started this wonder. Only they can keep building it;
  // other players are locked out once it's claimed.
  builtBy: PlayerId | null;
  // 0 = not started, increments by 1 per built level up to the wonder's
  // max (defined in the wonder catalogue alongside cost and prereq).
  level: number;
}

export interface PirateFleet {
  hexId: HexId;
  // Remaining strength. Each attack drops this by 1; 0 means defeated.
  strength: number;
  maxStrength: number;
  // Player who landed the killing blow (strength → 0). Awarded a +2 VP
  // bonus on top of standard scoring.
  defeatedBy: PlayerId | null;
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
  edges: [EdgeId] | [EdgeId, EdgeId];
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
}

export interface ChooseGoldResourceAction extends ActionBase {
  type: 'chooseGoldResource';
  resources: Resource[];
}

export interface BuildWonderAction extends ActionBase {
  type: 'buildWonder';
  wonderId: WonderId;
}

export interface AttackPirateFleetAction extends ActionBase {
  type: 'attackPirateFleet';
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
  | { kind: 'steal'; target: PlayerId; resource: Resource }
  | { kind: 'takeFromBank'; resource: Resource }
  | { kind: 'buildRoad'; edge: EdgeId }
  | { kind: 'buyDevCard'; drawn: DevCardType };

export interface SpendFishAction extends ActionBase {
  type: 'spendFish';
  // Subset of fish-token TYPES (not full hand) being discarded. The values
  // must sum to ≥ the effect's cost; excess is forfeit. Only 'one' / 'two'
  // / 'three' tokens may be spent — the old boot is never spent.
  tokens: Array<'one' | 'two' | 'three'>;
  effect: FishSpendEffect;
}

// Hand the old boot to another player. Legal target: any other player whose
// total VP ≥ yours. The recipient now needs +1 VP to win.
export interface PassOldBootAction extends ActionBase {
  type: 'passOldBoot';
  to: PlayerId;
}

// Merchant Trains end-of-turn voting. Every player (including the active
// one) dispatches this exactly once per voting round. `cards` are
// wool/wheat resource cards spent on the bid; `target` is the edge to
// vote for (null = abstain). Engine auto-resolves once all players have
// submitted.
export interface SubmitWagonVoteAction extends ActionBase {
  type: 'submitWagonVote';
  cards: Partial<ResourceBank>;
  target: EdgeId | null;
}

// Merchant Trains placement after the vote resolves to a placer-with-no-
// majority-location. Only the placer (set on state.pendingWagonPlacement)
// may dispatch this. The edge must be a legal merchant-train extension.
export interface PlaceWagonAction extends ActionBase {
  type: 'placeWagon';
  edge: EdgeId;
}

// Barbarian Attack: hire a defender knight on an edge adjacent to a
// castle. Cost: 1 wheat + 1 ore. Knight is consumed from the shared
// `state.barbarianKnightSupply`; the edge must be unoccupied and the
// player must have a connecting road/settlement/city/defender-knight.
export interface HireKnightAction extends ActionBase {
  type: 'hireKnight';
  edge: EdgeId;
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
  vertex?: VertexId; // medicine, intrigue source, treason placement
  toVertex?: VertexId; // intrigue dest
  edges?: [EdgeId] | [EdgeId, EdgeId]; // progressRoadBuilding
  resource?: Resource; // resourceMonopoly, merchantFleet (if resource), guildDues target
  commodity?: Commodity; // tradeMonopoly, merchantFleet (if commodity)
  targetId?: PlayerId; // espionage, guildDues, treason, intrigue, taxation
  knightVertices?: VertexId[]; // smithing — which knights to promote
}

// Generic "pick a card from this hand" follow-up used by Espionage + Guild Dues.
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

export interface TreasonPlaceKnightAction extends ActionBase {
  type: 'treasonPlaceKnight';
  vertex: VertexId;
  strength: KnightStrength;
}

// Commercial Harbor (C&K card) opponent reply: pick the commodity you'll
// give back in exchange for the resource offered.
export interface CommercialHarborOfferAction extends ActionBase {
  type: 'commercialHarborOffer';
  // null means "I have no commodity" — the resource bounces back.
  commodity: Commodity | null;
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
  | AttackPirateFleetAction
  | BuildBridgeAction
  | SpendFishAction
  | PassOldBootAction
  | SubmitWagonVoteAction
  | PlaceWagonAction
  | HireKnightAction
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
  | CommercialHarborOfferAction
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
  | 'cityMedicine'
  | 'hireKnight',
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
  // Traders & Barbarians / Rivers of Catan: same as a road. Sits in the road
  // column of the rulebook's player aid; the visible payoff is +3 gold on
  // build, so a road-equivalent cost keeps the math balanced.
  bridge: { wood: 1, brick: 1 },
  // Traders & Barbarians / Barbarian Attack: hire a defender knight.
  // Rulebook is 1 wool + 1 wheat + 1 ore; we drop wool so the wool
  // economy stays free for Merchant Trains-style bids in the combo
  // scenario down the line.
  hireKnight: { wheat: 1, ore: 1 },
};
