import type {
  EdgeId,
  EpCargo,
  EpEvent,
  EpLocation,
  EpMission,
  EpShip,
  ExplorersPiratesState,
  GameState,
  HexId,
  PlayerId,
  VertexId,
} from '../../types';
import {
  EP_BOOST_MP,
  EP_BONUS_TILE_VP,
  EP_CAPACITY,
  EP_CARGO_SIZE,
  EP_CHASE_ROLL,
  EP_MISSIONS,
  EP_PIECES,
  EP_SHIP_MP,
  EP_SHIPS_PER_EDGE,
  EP_TRACK_VP,
  EP_TRIBUTE_GOLD,
} from './constants';

// Read helpers for Explorers & Pirates, shared by the engine, the AI and
// the UI. Nothing here mutates state (the `patch` / `push` helpers return
// new objects).

export type EpGame = GameState & { explorersPirates: ExplorersPiratesState };

export function isExplorersPirates(state: GameState): state is EpGame {
  return state.explorersPirates !== undefined;
}

export function patchEp(state: EpGame, fn: (ep: ExplorersPiratesState) => ExplorersPiratesState): EpGame {
  return { ...state, explorersPirates: fn(state.explorersPirates) };
}

export function pushEpEvents(state: EpGame, events: EpEvent[]): EpGame {
  if (events.length === 0) return state;
  const prev = state.explorersPirates.lastEvents;
  return patchEp(state, (ep) => ({
    ...ep,
    lastEvents: { seq: (prev?.seq ?? 0) + 1, events },
  }));
}

// ----- Exploration -----

export function isUnexplored(state: GameState, hexId: HexId): boolean {
  return state.explorersPirates?.hidden[hexId] !== undefined;
}

// An explored sea hex (the Council of Catan and fish shoals included).
export function isExploredSea(state: GameState, hexId: HexId): boolean {
  return state.board.hexes[hexId]?.terrain === 'sea' && !isUnexplored(state, hexId);
}

// Hexes at either end of an edge that are still face down.
export function hiddenHexesAtEdge(state: GameState, edgeId: EdgeId): HexId[] {
  const edge = state.board.edges[edgeId];
  if (!edge || !state.explorersPirates) return [];
  const out: HexId[] = [];
  for (const v of edge.vertices) {
    for (const h of state.board.vertices[v]!.hexes) {
      if (isUnexplored(state, h) && !out.includes(h)) out.push(h);
    }
  }
  return out;
}

// ----- Building rules on land (Rulebook p. 9) -----

// Can `playerId` build on the land around these hexes? Every hex must be
// explored; gold fields only once their lair is captured; spice farms only
// for players with a crew there. `playerId` null = nobody's crew counts.
function landHexesOpen(state: EpGame, playerId: PlayerId | null, hexes: HexId[]): boolean {
  const ep = state.explorersPirates;
  for (const h of hexes) {
    if (ep.hidden[h]) return false;
    const terrain = state.board.hexes[h]!.terrain;
    if (terrain === 'gold') {
      const lair = ep.lairs.find((l) => l.hex === h);
      if (!lair || !lair.captured || ep.pendingLairs.includes(h)) return false;
    }
    if (terrain === 'spice') {
      const farm = ep.farms.find((f) => f.hex === h);
      if (!farm || playerId === null || !farm.crews.includes(playerId)) return false;
    }
  }
  return true;
}

// Settlement rule for an intersection (placement.ts runs it for every
// settlement check). True outside Explorers & Pirates.
export function epVertexBuildable(state: GameState, playerId: PlayerId | null, vertexId: VertexId): boolean {
  if (!isExplorersPirates(state)) return true;
  const v = state.board.vertices[vertexId];
  if (!v) return false;
  return landHexesOpen(state, playerId, v.hexes);
}

// Road rule for an edge. True outside Explorers & Pirates.
export function epEdgeBuildable(state: GameState, playerId: PlayerId | null, edgeId: EdgeId): boolean {
  if (!isExplorersPirates(state)) return true;
  const e = state.board.edges[edgeId];
  if (!e) return false;
  return landHexesOpen(state, playerId, e.hexes);
}

// Setup: the first piece is a harbor settlement on a marked intersection,
// the second a settlement on the starting island. True outside E&P.
export function epSetupVertexAllowed(state: GameState, vertexId: VertexId): boolean {
  if (!isExplorersPirates(state)) return true;
  const ep = state.explorersPirates;
  if (state.phase === 'setupRound1') return ep.harborSites.includes(vertexId);
  if (state.phase === 'setupRound2') {
    const v = state.board.vertices[vertexId];
    return !!v && v.hexes.some((h) => ep.startIsland.includes(h));
  }
  return false;
}

// ----- Harbor settlements -----

export function isHarbor(state: GameState, vertexId: VertexId): boolean {
  return state.explorersPirates?.harbors[vertexId] !== undefined;
}

export function buildingOwner(state: GameState, vertexId: VertexId): PlayerId | null {
  for (const p of state.players) {
    if (p.settlements.includes(vertexId) || p.cities.includes(vertexId)) return p.id;
  }
  return null;
}

export function harborsOf(state: GameState, playerId: PlayerId): VertexId[] {
  const ep = state.explorersPirates;
  if (!ep) return [];
  const p = state.players.find((x) => x.id === playerId);
  return p ? p.settlements.filter((v) => ep.harbors[v] !== undefined) : [];
}

// Regular (non-harbor) settlements on the board.
export function plainSettlementsOf(state: GameState, playerId: PlayerId): VertexId[] {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return [];
  return p.settlements.filter((v) => !isHarbor(state, v));
}

// A coastal intersection touches an explored sea hex.
export function isCoastalVertex(state: GameState, vertexId: VertexId): boolean {
  const v = state.board.vertices[vertexId];
  return !!v && v.hexes.some((h) => isExploredSea(state, h));
}

// Settlements that can become harbor settlements now (pieces permitting).
export function harborUpgradeSpots(state: GameState, playerId: PlayerId): VertexId[] {
  if (!isExplorersPirates(state)) return [];
  if (harborsOf(state, playerId).length >= EP_PIECES.harbors) return [];
  return plainSettlementsOf(state, playerId).filter((v) => isCoastalVertex(state, v));
}

// ----- Cargo -----

export function cargoUnits(cargo: readonly EpCargo[]): number {
  return cargo.reduce((n, c) => n + EP_CARGO_SIZE[c], 0);
}

export function hasRoomFor(cargo: readonly EpCargo[], pieces: readonly EpCargo[]): boolean {
  return cargoUnits(cargo) + cargoUnits(pieces) <= EP_CAPACITY;
}

// Remove `pieces` (one occurrence each) from `cargo`; null if any is missing.
export function removeCargo(cargo: readonly EpCargo[], pieces: readonly EpCargo[]): EpCargo[] | null {
  const out = [...cargo];
  for (const p of pieces) {
    const i = out.indexOf(p);
    if (i < 0) return null;
    out.splice(i, 1);
  }
  return out;
}

export function cargoAt(state: EpGame, at: EpLocation): EpCargo[] | null {
  if ('harbor' in at) return state.explorersPirates.harbors[at.harbor] ?? null;
  return state.explorersPirates.ships.find((s) => s.id === at.ship)?.cargo ?? null;
}

// ----- Ships -----

export function shipById(state: GameState, shipId: string): EpShip | undefined {
  return state.explorersPirates?.ships.find((s) => s.id === shipId);
}

export function shipsOf(state: GameState, playerId: PlayerId): EpShip[] {
  return state.explorersPirates?.ships.filter((s) => s.owner === playerId) ?? [];
}

export function shipsOnEdge(state: GameState, edgeId: EdgeId): EpShip[] {
  return state.explorersPirates?.ships.filter((s) => s.edge === edgeId) ?? [];
}

// Ships sail on edges of explored sea hexes (frame edges of sea hexes
// included) and never on an edge of a face-down hex.
export function isShipEdge(state: GameState, edgeId: EdgeId): boolean {
  const e = state.board.edges[edgeId];
  if (!e) return false;
  if (e.hexes.some((h) => isUnexplored(state, h))) return false;
  return e.hexes.some((h) => isExploredSea(state, h));
}

export function shipEnds(state: GameState, ship: EpShip): readonly [VertexId, VertexId] {
  return state.board.edges[ship.edge]!.vertices;
}

// "One end of the ship is adjacent to the hex": an end is one of its corners.
export function shipNextToHex(state: GameState, ship: EpShip, hexId: HexId): boolean {
  const corners = state.board.hexes[hexId]?.corners ?? [];
  return shipEnds(state, ship).some((v) => corners.includes(v));
}

export function edgeOfHex(state: GameState, edgeId: EdgeId, hexId: HexId): boolean {
  return state.board.edges[edgeId]?.hexes.includes(hexId) ?? false;
}

// Your harbor settlements at either end of the ship.
export function harborsAtShip(state: GameState, ship: EpShip): VertexId[] {
  return shipEnds(state, ship).filter(
    (v) => isHarbor(state, v) && buildingOwner(state, v) === ship.owner,
  );
}

// Empty sea edges next to one of your harbor settlements.
export function buildableShipEdges(state: GameState, playerId: PlayerId): EdgeId[] {
  if (!isExplorersPirates(state)) return [];
  const out: EdgeId[] = [];
  for (const h of harborsOf(state, playerId)) {
    for (const e of state.board.vertices[h]!.edges) {
      if (out.includes(e)) continue;
      if (!isShipEdge(state, e)) continue;
      if (shipsOnEdge(state, e).length > 0) continue;
      out.push(e);
    }
  }
  return out;
}

// Where a new settler / crew may go: your harbor settlements and your ships
// next to one. `withRoom` keeps only spots with space for `piece`.
export function pieceSpots(state: GameState, playerId: PlayerId, piece: EpCargo, withRoom: boolean): EpLocation[] {
  if (!isExplorersPirates(state)) return [];
  const out: EpLocation[] = [];
  for (const h of harborsOf(state, playerId)) {
    const cargo = state.explorersPirates.harbors[h]!;
    if (!withRoom || hasRoomFor(cargo, [piece])) out.push({ harbor: h });
  }
  for (const s of shipsOf(state, playerId)) {
    if (harborsAtShip(state, s).length === 0) continue;
    if (!withRoom || hasRoomFor(s.cargo, [piece])) out.push({ ship: s.id });
  }
  return out;
}

// ----- Pieces on the board -----

export function crewsOnBoard(state: GameState, playerId: PlayerId): number {
  const ep = state.explorersPirates;
  if (!ep) return 0;
  let n = 0;
  for (const s of ep.ships) if (s.owner === playerId) n += s.cargo.filter((c) => c === 'crew').length;
  for (const [v, cargo] of Object.entries(ep.harbors)) {
    if (buildingOwner(state, v) === playerId) n += cargo.filter((c) => c === 'crew').length;
  }
  for (const l of ep.lairs) n += l.crews.filter((c) => c === playerId).length;
  for (const f of ep.farms) if (f.crews.includes(playerId)) n++;
  return n;
}

export function settlersOnBoard(state: GameState, playerId: PlayerId): number {
  const ep = state.explorersPirates;
  if (!ep) return 0;
  let n = 0;
  for (const s of ep.ships) if (s.owner === playerId) n += s.cargo.filter((c) => c === 'settler').length;
  for (const [v, cargo] of Object.entries(ep.harbors)) {
    if (buildingOwner(state, v) === playerId) n += cargo.filter((c) => c === 'settler').length;
  }
  return n;
}

export function epSupply(state: GameState, playerId: PlayerId) {
  const p = state.players.find((x) => x.id === playerId)!;
  return {
    roads: EP_PIECES.roads - p.roads.length,
    settlements: EP_PIECES.settlements - plainSettlementsOf(state, playerId).length,
    harbors: EP_PIECES.harbors - harborsOf(state, playerId).length,
    ships: EP_PIECES.ships - shipsOf(state, playerId).length,
    settlers: EP_PIECES.settlers - settlersOnBoard(state, playerId),
    crews: EP_PIECES.crews - crewsOnBoard(state, playerId),
  };
}

// ----- Spice farm advantages -----

export function farmCount(state: GameState, playerId: PlayerId, ability: 'swiftVoyage' | 'fastGold' | 'pirateBonus'): number {
  return state.explorersPirates?.farms.filter((f) => f.ability === ability && f.crews.includes(playerId)).length ?? 0;
}

export function shipBaseMp(state: GameState, playerId: PlayerId): number {
  return EP_SHIP_MP + farmCount(state, playerId, 'swiftVoyage');
}

// Die results that chase the pirate away: a 6, plus each Pirate Bonus
// farm's number; with both farms 4, 5 and 6.
export function chaseNumbers(state: GameState, playerId: PlayerId): number[] {
  const ep = state.explorersPirates;
  const out = new Set<number>([EP_CHASE_ROLL]);
  if (ep) {
    const farms = ep.farms.filter((f) => f.ability === 'pirateBonus' && f.crews.includes(playerId));
    for (const f of farms) if (f.pirateNumber) out.add(f.pirateNumber);
    if (farms.length >= 2) [4, 5, 6].forEach((n) => out.add(n));
  }
  return [...out].sort((a, b) => a - b);
}

// ----- Movement phase -----

// MP left for a ship this Movement phase if it moved next (or now).
export function shipMpLeft(state: GameState, shipId: string): number {
  const ep = state.explorersPirates;
  const m = ep?.movement;
  const ship = shipById(state, shipId);
  if (!ep || !m || !ship) return 0;
  if (m.moving === shipId) return m.mp;
  if (m.moved.includes(shipId)) return 0;
  return shipBaseMp(state, ship.owner) + (m.boosted.includes(shipId) ? EP_BOOST_MP : 0);
}

// Would a step from `from` to `to` cost this ship the pirate's tribute?
export function stepOwesTribute(state: GameState, ship: EpShip, from: EdgeId, to: EdgeId): boolean {
  const ep = state.explorersPirates;
  if (!ep?.pirate || ep.pirate.owner === ship.owner) return false;
  if (ep.movement?.paidTribute.includes(ship.id)) return false;
  return edgeOfHex(state, from, ep.pirate.hex) || edgeOfHex(state, to, ep.pirate.hex);
}

// Edges this ship can step to right now (one edge).
export function legalShipSteps(state: GameState, shipId: string): EdgeId[] {
  const ship = shipById(state, shipId);
  if (!ship || state.phase !== 'epMovement') return [];
  const mp = shipMpLeft(state, shipId);
  if (mp <= 0) return [];
  const gold = state.players.find((p) => p.id === ship.owner)?.gold ?? 0;
  const out: EdgeId[] = [];
  for (const to of state.board.edges[ship.edge]!.neighborEdges) {
    if (!isShipEdge(state, to)) continue;
    const others = shipsOnEdge(state, to).filter((s) => s.id !== ship.id).length;
    if (others >= EP_SHIPS_PER_EDGE) {
      // May pass a full edge but not stop there: needs MP to go on, and a
      // step that explores ends the move.
      if (mp - 1 <= 0 || hiddenHexesAtEdge(state, to).length > 0) continue;
    }
    if (stepOwesTribute(state, ship, ship.edge, to) && gold < EP_TRIBUTE_GOLD) continue;
    out.push(to);
  }
  return out;
}

// Ships the player can still move (or keep moving) this phase.
export function movableShips(state: GameState, playerId: PlayerId): EpShip[] {
  return shipsOf(state, playerId).filter((s) => legalShipSteps(state, s.id).length > 0);
}

// May the moving ship stop where it is (not on an edge with 2 other ships)?
export function moveCanEnd(state: GameState): boolean {
  const m = state.explorersPirates?.movement;
  if (!m?.moving) return true;
  const ship = shipById(state, m.moving);
  if (!ship) return true;
  return shipsOnEdge(state, ship.edge).length <= EP_SHIPS_PER_EDGE;
}

// Battle-ready ships: not moved this turn, an end on a corner of the pirate's
// hex, no chase attempt yet this turn, the pirate an opponent's.
export function battleReadyShips(state: GameState, playerId: PlayerId): EpShip[] {
  const ep = state.explorersPirates;
  const m = ep?.movement;
  if (!ep?.pirate || !m || ep.pirate.owner === playerId) return [];
  const hex = ep.pirate.hex;
  return shipsOf(state, playerId).filter(
    (s) =>
      !m.moved.includes(s.id) &&
      m.moving !== s.id &&
      !m.chased.includes(s.id) &&
      shipNextToHex(state, s, hex),
  );
}

// Intersections where a ship with a settler could found a settlement.
export function foundableVertices(state: GameState, shipId: string): VertexId[] {
  const ship = shipById(state, shipId);
  if (!ship || !ship.cargo.includes('settler')) return [];
  if (epSupply(state, ship.owner).settlements <= 0) return [];
  return shipEnds(state, ship).filter((v) => canFoundAt(state, ship.owner, v));
}

// A settlement founded from a ship: land at the intersection, the distance
// rule, and the E&P land rules. No road needed.
export function canFoundAt(state: GameState, playerId: PlayerId, vertexId: VertexId): boolean {
  const v = state.board.vertices[vertexId];
  if (!v) return false;
  if (!v.hexes.some((h) => state.board.hexes[h]!.terrain !== 'sea' && !isUnexplored(state, h))) return false;
  if (!epVertexBuildable(state, playerId, vertexId)) return false;
  if (buildingOwner(state, vertexId)) return false;
  for (const n of v.neighborVertices) if (buildingOwner(state, n)) return false;
  return true;
}

// ----- The pirate ship -----

// Sea hexes the pirate may go to: explored sea, not next to the starting
// island, not printed on the frame, not where the pirate is now.
export function canPlacePirateOn(state: GameState, hexId: HexId): boolean {
  const ep = state.explorersPirates;
  if (!ep || !isExploredSea(state, hexId)) return false;
  if (ep.frameHexes.includes(hexId)) return false;
  if (ep.pirate?.hex === hexId) return false;
  for (const h of hexNeighbors(state, hexId)) if (ep.startIsland.includes(h)) return false;
  return true;
}

export function pirateHexOptions(state: GameState): HexId[] {
  return state.board.hexIds.filter((h) => canPlacePirateOn(state, h));
}

export function hexNeighbors(state: GameState, hexId: HexId): HexId[] {
  const c = state.board.hexes[hexId]?.coord;
  if (!c) return [];
  const dirs = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];
  return dirs.map(([dq, dr]) => `${c.q + dq!},${c.r + dr!}`).filter((id) => state.board.hexes[id] !== undefined);
}

// Opponents with a ship on the hex who have something to steal.
export function pirateVictims(state: GameState, playerId: PlayerId, hexId: HexId): PlayerId[] {
  const ep = state.explorersPirates;
  if (!ep) return [];
  const owners = new Set(
    ep.ships.filter((s) => s.owner !== playerId && edgeOfHex(state, s.edge, hexId)).map((s) => s.owner),
  );
  return state.playerOrder.filter((pid) => {
    if (!owners.has(pid)) return false;
    const p = state.players.find((x) => x.id === pid)!;
    const cards = Object.values(p.resources).reduce((a, b) => a + b, 0);
    return cards > 0 || (p.gold ?? 0) > 0;
  });
}

// ----- Missions -----

export function trackPosition(state: GameState, mission: EpMission, playerId: PlayerId): number {
  return state.explorersPirates?.tracks[mission][playerId] ?? 0;
}

export function trackLength(mission: EpMission): number {
  return EP_TRACK_VP[mission].length;
}

export function trackVp(mission: EpMission, position: number): number {
  if (position <= 0) return 0;
  const vps = EP_TRACK_VP[mission];
  return vps[Math.min(position, vps.length) - 1]!;
}

// Holder of the mission's bonus tile: furthest along the track; on a tie
// the marker that got there first (bottom of the stack) keeps it.
export function bonusTileHolder(state: GameState, mission: EpMission): PlayerId | null {
  const ep = state.explorersPirates;
  if (!ep) return null;
  let best: PlayerId | null = null;
  let bestPos = 0;
  let bestArrival = Infinity;
  for (const pid of state.playerOrder) {
    const pos = ep.tracks[mission][pid] ?? 0;
    const arrival = ep.arrivals[mission][pid] ?? Infinity;
    if (pos <= 0) continue;
    if (pos > bestPos || (pos === bestPos && arrival < bestArrival)) {
      best = pid;
      bestPos = pos;
      bestArrival = arrival;
    }
  }
  return best;
}

export function missionVp(state: GameState, playerId: PlayerId): number {
  let vp = 0;
  for (const m of EP_MISSIONS) {
    vp += trackVp(m, trackPosition(state, m, playerId));
    if (bonusTileHolder(state, m) === playerId) vp += EP_BONUS_TILE_VP;
  }
  return vp;
}

// Explorers & Pirates VP on top of the base count: each harbor settlement
// is worth 2 (it's already counted once as a settlement), plus the mission
// tracks and bonus tiles.
export function calculateExplorersPiratesVp(state: GameState, playerId: PlayerId): number {
  if (!isExplorersPirates(state)) return 0;
  return harborsOf(state, playerId).length + missionVp(state, playerId);
}
