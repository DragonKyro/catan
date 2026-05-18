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
// Terrain & hexes
// ============================================================================

export type Terrain = Resource | 'desert' | 'sea' | 'gold';

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
  // and the dice handler dispatches `eruptVolcano` when the volcano's
  // number is rolled.
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
  | 'brown';

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
  // Seafarers extension phases.
  | 'chooseRobberOrPirate'
  | 'movePirate'
  | 'chooseGoldResource';

export interface SetupState {
  step: 'settlement' | 'road';
  lastPlacedSettlement: VertexId | null;
}

export interface DiscardState {
  required: Record<PlayerId, number>;
}

export interface RobberMoveContext {
  reason: 'sevenRoll' | 'knight';
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
// Base-game scenario actions
// ----------------------------------------------------------------------------

// Volcano scenario: emitted by the dice handler when the volcano's number
// is rolled. The acting (rolling) player decides which adjacent vertex is
// destroyed via Math.random and includes it in the payload so all peers
// reduce to the same state. `vertexId === null` when no buildings sit on
// the volcano's six corners (eruption no-ops with a log entry).
export interface EruptVolcanoAction extends ActionBase {
  type: 'eruptVolcano';
  volcanoHexId: HexId;
  vertexId: VertexId | null;
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
  | EruptVolcanoAction;

export type ActionType = Action['type'];

// ============================================================================
// Costs (base game)
// ============================================================================

export const COSTS: Record<'road' | 'settlement' | 'city' | 'devCard', Partial<ResourceBank>> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  devCard: { sheep: 1, wheat: 1, ore: 1 },
};
