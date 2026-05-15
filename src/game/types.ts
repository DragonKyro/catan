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
}

// ============================================================================
// Game phase & state
// ============================================================================

export type GamePhase =
  | 'setupRound1'
  | 'setupRound2'
  | 'specialBuildPhase'
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
  // 11 ports, 28 number tokens, plus Special Build Phase between turns).
  // Optional for backwards-compat with snapshots from before the expansion.
  boardVariant?: '3-4' | '5-6';
  // Set during the Special Build Phase: players queued to take their SBP
  // mini-turn before the next real turn begins. Pinned in player-order
  // starting from the player after `turnHolderIndex`.
  sbpQueue?: PlayerId[];
  // Index into `playerOrder` of the player whose main turn this is.
  // During SBP this stays pinned while `currentPlayerIndex` rotates through
  // `sbpQueue`. Win-checks key off this so an SBP-builder can't win
  // mid-build (official rule: you can only win on your own turn).
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
  // Seafarers extension. All optional, only populated when expansion is active.
  pendingPirateMove?: RobberMoveContext;
  goldChoiceState?: { pending: Record<PlayerId, number> };
  islandChips?: IslandChip[];
}

export interface IslandChip {
  islandId: string;
  vp: number;
  firstSettler: PlayerId | null;
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
  | ChooseGoldResourceAction;

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
