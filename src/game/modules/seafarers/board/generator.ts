import type { BoardState, HexId } from '../../../types';
import type { IslandChip, PirateFleet, TribeToken } from '../../../types';
import {
  assembleBoardFromDefs,
  assembleBoardFromLayout,
} from '../../../board/scenarioAssembly';
import { getScenario } from './scenarios';
import { identifyIslands } from './islands';
import type { Scenario, ScenarioLayout } from './types';

export interface SeafarersBoardResult {
  board: BoardState;
  rngState: number;
  islandChips: IslandChip[];
  tribeTokens: TribeToken[];
  unrevealedFogHexes: HexId[];
  pirateFleet?: PirateFleet;
  clothHexes: HexId[];
}

// Build a Seafarers BoardState from a scenario id. When `numPlayers >= 5`
// and the scenario declares a `hexes5_6` variant, the larger 5-6 player
// layout is used. Falls back to the 3-4 layout otherwise.
export function generateSeafarersBoard(
  scenarioId: string | undefined,
  rngState: number,
  numPlayers = 3,
): SeafarersBoardResult {
  const scenario = getScenario(scenarioId);
  // Track this for the legacy mechanic-data lookups below (tribeTokens5_6,
  // fogHexes5_6, etc.). The actual hex/port source switches based on whether
  // a modular layout exists.
  const useLarge = numPlayers >= 5;

  // Modular path: when the scenario provides a `layout3p` (and optional
  // layout4p / layout5_6p), materialize hexes + ports by drawing terrains,
  // tokens and port types from the pool. Otherwise fall back to the legacy
  // fixed-content `hexes` / `ports` arrays.
  const layout = pickLayout(scenario, numPlayers);
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

  // Seafarers always has a sea hex — guarantee `pirateHex` is set (the
  // engine assumes it when the expansion is active).
  if (!board.pirateHex) {
    board.pirateHex =
      board.hexIds.find((id) => board.hexes[id]!.terrain === 'sea') ??
      board.hexIds[0]!;
  }

  // Identify islands so the rendering layer can highlight them and so the
  // settlement-handler intercept (phase 6) can award the right chip.
  board.islandOfHex = {};
  const islands = identifyIslands(board, {
    desertIsBoundary: scenario.desertIsBoundary === true,
  });
  board.islandOfHex = islands.hexToIsland;

  const islandChips: IslandChip[] = islands.outerIslandIds.map((id) => ({
    islandId: id,
    vp: scenario.islandBonusVp?.[id] ?? scenario.defaultIslandBonusVp,
    firstSettler: null,
  }));

  // Forgotten Tribe: instantiate tribe-token defs onto the actual hex ids.
  // Quietly drop any token whose anchor hex isn't on the generated board
  // (e.g. a 3-4p-only token for a 5-6p generation).
  const tokenDefs = useLarge && scenario.tribeTokens5_6
    ? scenario.tribeTokens5_6
    : scenario.tribeTokens ?? [];
  const tribeTokens: TribeToken[] = [];
  for (const def of tokenDefs) {
    const hexId = `${def.q},${def.r}`;
    if (!board.hexes[hexId]) continue;
    tribeTokens.push({ hexId, type: def.type, claimedBy: null });
  }

  // Fog Island: collect the starting fog set. Coords that aren't actually
  // on the generated board are quietly dropped (matches tribeToken handling).
  const fogDefs = useLarge && scenario.fogHexes5_6
    ? scenario.fogHexes5_6
    : scenario.fogHexes ?? [];
  const unrevealedFogHexes: HexId[] = [];
  for (const def of fogDefs) {
    const hexId = `${def.q},${def.r}`;
    if (board.hexes[hexId]) unrevealedFogHexes.push(hexId);
  }

  // Pirate Islands: anchor the fleet on the scenario's designated sea hex.
  // If the coord doesn't resolve to a board hex (unusual — shouldn't happen
  // for shipped scenarios), pirateFleet stays undefined.
  const fleetDef = useLarge && scenario.pirateFleet5_6
    ? scenario.pirateFleet5_6
    : scenario.pirateFleet;
  let pirateFleet: PirateFleet | undefined;
  if (fleetDef) {
    const hexId = `${fleetDef.q},${fleetDef.r}`;
    if (board.hexes[hexId]) {
      pirateFleet = {
        hexId,
        strength: fleetDef.strength,
        maxStrength: fleetDef.strength,
        defeatedBy: null,
      };
    }
  }

  // Cloth for Catan: resolve cloth-hex coordinates to live hex ids. Quietly
  // drop coords that aren't on the generated board.
  const clothDefs = useLarge && scenario.clothHexes5_6
    ? scenario.clothHexes5_6
    : scenario.clothHexes ?? [];
  const clothHexes: HexId[] = [];
  for (const def of clothDefs) {
    const hexId = `${def.q},${def.r}`;
    if (board.hexes[hexId]) clothHexes.push(hexId);
  }

  return {
    board,
    rngState,
    islandChips,
    tribeTokens,
    unrevealedFogHexes,
    pirateFleet,
    clothHexes,
  };
}

// Pick the modular layout for the current player count. 4p falls back to the
// 3p layout when the scenario doesn't ship a separate 4p frame (most don't —
// Heading for New Shores and Through the Desert are the exceptions). Returns
// `null` when the scenario hasn't migrated to the modular format yet.
function pickLayout(scenario: Scenario, numPlayers: number): ScenarioLayout | null {
  if (numPlayers >= 5) return scenario.layout5_6p ?? null;
  if (numPlayers === 4) return scenario.layout4p ?? scenario.layout3p ?? null;
  return scenario.layout3p ?? null;
}
