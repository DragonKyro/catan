import type {
  BoardState,
  ClothVillage,
  EdgeId,
  HexId,
  IslandChip,
  PortType,
  TribeTokenType,
  VertexId,
  WonderId,
} from '../../../types';
import {
  assembleBoardFromDefs,
  assembleBoardFromLayout,
} from '../../../board/scenarioAssembly';
import { injectFogPools } from '../../../board/fogPoolInjection';
import { shuffle } from '../../../rng';
import { getScenario } from './scenarios';
import { identifyIslands } from './islands';
import type {
  EdgeRef,
  HexRef,
  Scenario,
  ScenarioExtras,
  ScenarioLayout,
  VertexRef,
} from './types';
import { CLOTH_PER_VILLAGE } from '../cloth';

export interface PirateSlot {
  settlement: VertexId;
  ship: EdgeId;
  fortress: VertexId;
  beachhead: VertexId;
}

export interface SeafarersBoardResult {
  board: BoardState;
  rngState: number;
  islandChips: IslandChip[];
  unrevealedFogHexes: HexId[];
  startingIslands?: string[];
  settlementBlockedHexes?: HexId[];
  robberBlockedHexes?: HexId[];
  setupBlockedVertices?: VertexId[];
  // Forgotten Tribe tokens (dev cards are drawn by createGame).
  tribeTokens?: Array<{ edge: EdgeId; type: TribeTokenType; portType?: PortType }>;
  wonderSites?: Partial<Record<WonderId, VertexId[]>>;
  clothVillages?: ClothVillage[];
  pirateIslands?: {
    mainIsland: string;
    path: HexId[];
    fleetIndex: number;
    noAttackHex?: HexId;
    // Slots for this player count, in seat order.
    slots: PirateSlot[];
  };
}

export function resolveHexRef(board: BoardState, ref: HexRef): HexId {
  const id = `${ref.q},${ref.r}`;
  if (!board.hexes[id]) throw new Error(`Scenario references missing hex ${id}`);
  return id;
}

export function resolveVertexRef(board: BoardState, ref: VertexRef): VertexId {
  const hex = board.hexes[resolveHexRef(board, ref)]!;
  return hex.corners[ref.corner]!;
}

export function resolveEdgeRef(board: BoardState, ref: EdgeRef): EdgeId {
  const hex = board.hexes[resolveHexRef(board, ref)]!;
  const a = hex.corners[ref.direction]!;
  const b = hex.corners[(ref.direction + 1) % 6]!;
  const edge = board.vertices[a]!.edges.find((e) => board.edges[e]!.vertices.includes(b));
  if (!edge) throw new Error(`Scenario references missing edge ${ref.q},${ref.r}/${ref.direction}`);
  return edge;
}

// Build a Seafarers BoardState from a scenario id, using the 5-6 player
// layout at 5+ players.
export function generateSeafarersBoard(
  scenarioId: string | undefined,
  rngState: number,
  numPlayers = 3,
): SeafarersBoardResult {
  const scenario = getScenario(scenarioId);
  const useLarge = numPlayers >= 5;

  let layout = pickLayout(scenario, numPlayers);
  // Fog cells draw their terrain + token from a SEPARATE face-down pool.
  const fogHexCoords = useLarge && scenario.fogHexes5_6
    ? scenario.fogHexes5_6
    : scenario.fogHexes ?? [];
  const fogPoolDef = useLarge ? scenario.fogPools5_6 : scenario.fogPools;
  if (layout && fogPoolDef && fogHexCoords.length > 0) {
    const injected = injectFogPools(layout, fogHexCoords, fogPoolDef, rngState);
    layout = injected.layout;
    rngState = injected.rngState;
  }
  const assembled = layout
    ? assembleBoardFromLayout(layout, rngState)
    : assembleBoardFromDefs(
        useLarge && scenario.hexes5_6 ? scenario.hexes5_6 : scenario.hexes,
        useLarge && scenario.ports5_6 ? scenario.ports5_6 : scenario.ports,
        {},
        rngState,
      );
  const board = assembled.board;
  rngState = assembled.rngState;

  if (scenario.noPirate) {
    delete board.pirateHex;
  } else if (!board.pirateHex) {
    board.pirateHex =
      board.hexIds.find((id) => board.hexes[id]!.terrain === 'sea') ?? board.hexIds[0]!;
  }

  const islands = identifyIslands(board, {
    desertIsBoundary: scenario.desertIsBoundary === true,
  });
  board.islandOfHex = islands.hexToIsland;

  const bonus = scenario.defaultIslandBonusVp;
  const chipIslands = scenario.bonusOnEveryIsland
    ? [islands.mainIslandId, ...islands.outerIslandIds]
    : islands.outerIslandIds;
  const islandChips: IslandChip[] =
    bonus > 0
      ? chipIslands.map((id) => ({
          islandId: id,
          vp: scenario.islandBonusVp?.[id] ?? bonus,
          claimedBy: [],
          homeOf: [],
        }))
      : [];

  const extras: ScenarioExtras = (useLarge ? scenario.extras5_6 : scenario.extras3_4) ?? {};
  const result: SeafarersBoardResult = {
    board,
    rngState,
    islandChips,
    unrevealedFogHexes: [],
  };

  // Starting settlements.
  if (scenario.startingPlacementZone === 'mainIslandOnly') {
    result.startingIslands = [islands.mainIslandId];
  } else if (scenario.startingPlacementZone === 'listedIslands') {
    result.startingIslands = [
      ...new Set(
        (extras.startingIslandHexes ?? []).map(
          (h) => islands.hexToIsland[resolveHexRef(board, h)]!,
        ),
      ),
    ];
  }

  // Fog Islands: the starting fog set.
  for (const def of fogHexCoords) {
    const hexId = `${def.q},${def.r}`;
    if (board.hexes[hexId]) result.unrevealedFogHexes.push(hexId);
  }

  // Forgotten Tribe: settlements and the robber only on numbered hexes.
  if (scenario.numberedHexesOnly) {
    const unnumbered = board.hexIds.filter((id) => {
      const h = board.hexes[id]!;
      return h.terrain !== 'sea' && h.numberToken === null;
    });
    result.settlementBlockedHexes = unnumbered;
    result.robberBlockedHexes = unnumbered;
  }

  if (extras.tribe) {
    const tribe = extras.tribe;
    let portTypes: PortType[] = tribe.portTypes;
    if (!tribe.fixedPortTypes) [portTypes, rngState] = shuffle(rngState, tribe.portTypes);
    result.tribeTokens = [
      ...tribe.victoryPoints.map((e) => ({
        edge: resolveEdgeRef(board, e),
        type: 'victoryPoint' as const,
      })),
      ...tribe.devCards.map((e) => ({ edge: resolveEdgeRef(board, e), type: 'devCard' as const })),
      ...tribe.ports.map((e, i) => ({
        edge: resolveEdgeRef(board, e),
        type: 'port' as const,
        portType: portTypes[i]!,
      })),
    ];
  }

  if (extras.wonderSites) {
    const w = extras.wonderSites;
    result.wonderSites = {
      greatWall: w.greatWall.map((v) => resolveVertexRef(board, v)),
      greatBridge: w.greatBridge.map((v) => resolveVertexRef(board, v)),
      ...(w.lighthouse ? { lighthouse: w.lighthouse.map((v) => resolveVertexRef(board, v)) } : {}),
    };
    // "They may not be placed on an intersection with a Great Bridge or
    // Great Wall marker or on intersections with 'X' markers next to the
    // Great Bridge markers."
    result.setupBlockedVertices = [
      ...result.wonderSites.greatWall!,
      ...result.wonderSites.greatBridge!,
      ...w.xMarkers.map((v) => resolveVertexRef(board, v)),
    ];
  }

  if (extras.villages) {
    result.clothVillages = extras.villages.map((v) => ({
      vertex: resolveVertexRef(board, v),
      number: v.number,
      supply: CLOTH_PER_VILLAGE,
      partners: [],
    }));
    // "You may not build settlements on the small islands" / "You may not
    // move the robber to any of the small islands."
    const villageIslands = new Set<string>();
    for (const v of result.clothVillages) {
      for (const h of board.vertices[v.vertex]!.hexes) {
        const island = islands.hexToIsland[h];
        if (island) villageIslands.add(island);
      }
    }
    const smallIslandHexes = board.hexIds.filter((id) =>
      villageIslands.has(islands.hexToIsland[id] ?? ''),
    );
    result.settlementBlockedHexes = smallIslandHexes;
    result.robberBlockedHexes = smallIslandHexes;
  }

  if (extras.pirateIslands) {
    const pi = extras.pirateIslands;
    const path = pi.path.map((h) => resolveHexRef(board, h));
    const slotIdx = pi.slotsByPlayers[numPlayers] ?? pi.slots.map((_, i) => i);
    result.pirateIslands = {
      mainIsland: islands.mainIslandId,
      path,
      fleetIndex: pi.start,
      ...(pi.noAttackHex ? { noAttackHex: resolveHexRef(board, pi.noAttackHex) } : {}),
      slots: slotIdx.map((i) => {
        const s = pi.slots[i]!;
        return {
          settlement: resolveVertexRef(board, s.settlement),
          ship: resolveEdgeRef(board, s.ship),
          fortress: resolveVertexRef(board, s.fortress),
          beachhead: resolveVertexRef(board, s.beachhead),
        };
      }),
    };
    board.pirateHex = path[pi.start];
  }

  result.rngState = rngState;
  return result;
}

// Pick the modular layout for the current player count. 4p falls back to the
// 3p layout when the scenario doesn't ship a separate 4p frame.
function pickLayout(scenario: Scenario, numPlayers: number): ScenarioLayout | null {
  if (numPlayers >= 5) return scenario.layout5_6p ?? null;
  if (numPlayers === 4) return scenario.layout4p ?? scenario.layout3p ?? null;
  return scenario.layout3p ?? null;
}
