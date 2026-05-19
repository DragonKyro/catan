import type {
  GameState,
  CastleState,
  PlayerId,
  EdgeId,
  VertexId,
} from '../../../types';
import { updatePlayer } from '../../../helpers';
import { rngInt } from '../../../rng';
import { defendersAtCastle } from './placement';

// Resolve combat for every castle whose barbarian has arrived at the
// castle hex. Idempotent and order-independent across castles (each
// castle is its own combat). Mutates nothing — returns a fresh state.
//
// Combat outcomes:
//   - Win (defenderStrength >= barbarianStrength):
//       * Each defender's `castle.defenderVp[playerId] += knightCount`
//         (1 VP per knight contributed — visible VP, awarded immediately).
//       * Half the defending knights die (round up) — for each defender,
//         remove `ceil(knightCount / 2)` knights at random.
//       * Surviving knights stay on their edges.
//       * Returned knights go back to `barbarianKnightSupply`.
//   - Loss (defenderStrength < barbarianStrength):
//       * All defending knights die (removed, refunded to supply).
//       * Pick a defender to lose a building. If there are no defenders,
//         pick any player with a settlement / city adjacent to the castle.
//         Tie-break with seeded RNG.
//       * Remove one of their adjacent buildings (city downgrades to
//         settlement; settlement vanishes — same as Volcano).
//   - Always: reset `barbarianPosition = 0` so the next cycle starts.
export function resolveCombat(state: GameState): GameState {
  if (!state.castles?.length) return state;
  let next = state;
  for (let i = 0; i < next.castles!.length; i++) {
    const castle = next.castles![i]!;
    if (castle.barbarianPosition < castle.barbarianPath.length - 1) continue;
    next = resolveCastleCombat(next, i);
  }
  return next;
}

function resolveCastleCombat(state: GameState, castleIndex: number): GameState {
  const castle = state.castles![castleIndex]!;
  const defenders = defendersAtCastle(state, castle.hexId);
  const defenderStrength = Object.values(defenders).reduce(
    (s, edges) => s + edges.length,
    0,
  );
  const win = defenderStrength >= castle.barbarianStrength;

  let next = state;
  if (win) {
    next = applyWin(next, castleIndex, defenders);
  } else {
    next = applyLoss(next, castleIndex, defenders);
  }
  // Reset barbarian position regardless of outcome.
  next = patchCastle(next, castleIndex, (c) => ({ ...c, barbarianPosition: 0 }));
  return next;
}

function applyWin(
  state: GameState,
  castleIndex: number,
  defenders: Record<PlayerId, EdgeId[]>,
): GameState {
  let next = state;
  // Award VP first (one VP per knight present, visible immediately).
  next = patchCastle(next, castleIndex, (c) => {
    const updatedVp: Record<PlayerId, number> = { ...c.defenderVp };
    for (const [pid, edges] of Object.entries(defenders)) {
      updatedVp[pid] = (updatedVp[pid] ?? 0) + edges.length;
    }
    return { ...c, defenderVp: updatedVp };
  });
  // Half the defenders die per player (round up). Pick survivors via
  // seeded RNG so peers reduce identically.
  for (const [pid, edges] of Object.entries(defenders)) {
    const deaths = Math.ceil(edges.length / 2);
    let pool = edges.slice();
    const dying: EdgeId[] = [];
    let rng = next.rngState;
    for (let i = 0; i < deaths; i++) {
      const [idx, nextRng] = rngInt(rng, pool.length);
      rng = nextRng;
      dying.push(pool[idx]!);
      pool = pool.filter((_, j) => j !== idx);
    }
    next = { ...next, rngState: rng };
    next = removeDefenderKnights(next, pid, dying);
  }
  return next;
}

function applyLoss(
  state: GameState,
  castleIndex: number,
  defenders: Record<PlayerId, EdgeId[]>,
): GameState {
  let next = state;
  // All defenders die.
  for (const [pid, edges] of Object.entries(defenders)) {
    next = removeDefenderKnights(next, pid, edges);
  }
  // Pick a victim to lose a building. Preferred victim order:
  //   1. The defender with the fewest knights at this castle (rulebook:
  //      the weakest defender takes the hit). Ties broken by seeded RNG.
  //   2. If no defenders at all, any player with a building on the
  //      castle's corners (the castle's reach). Ties broken by RNG.
  const castle = next.castles![castleIndex]!;
  const victimCandidates = chooseVictims(next, castle, defenders);
  if (victimCandidates.length === 0) return next;
  const [vIdx, rng1] = rngInt(next.rngState, victimCandidates.length);
  next = { ...next, rngState: rng1 };
  const victim = victimCandidates[vIdx]!;
  // Pick a random building of theirs adjacent to the castle.
  const buildings = victimBuildingsAtCastle(next, victim, castle);
  if (buildings.length === 0) return next;
  const [bIdx, rng2] = rngInt(next.rngState, buildings.length);
  next = { ...next, rngState: rng2 };
  const target = buildings[bIdx]!;
  next = destroyBuilding(next, victim, target);
  return next;
}

function chooseVictims(
  state: GameState,
  castle: CastleState,
  defenders: Record<PlayerId, EdgeId[]>,
): PlayerId[] {
  const defenderIds = Object.keys(defenders);
  if (defenderIds.length > 0) {
    let minCount = Infinity;
    for (const pid of defenderIds) {
      const c = defenders[pid]!.length;
      if (c < minCount) minCount = c;
    }
    return defenderIds.filter((pid) => defenders[pid]!.length === minCount);
  }
  // No defenders — any player with a building adjacent to the castle.
  const hex = state.board.hexes[castle.hexId];
  if (!hex) return [];
  const corners = new Set(hex.corners);
  const out: PlayerId[] = [];
  for (const p of state.players) {
    const hasAdjacent =
      p.settlements.some((v) => corners.has(v)) ||
      p.cities.some((v) => corners.has(v));
    if (hasAdjacent) out.push(p.id);
  }
  return out;
}

function victimBuildingsAtCastle(
  state: GameState,
  playerId: PlayerId,
  castle: CastleState,
): Array<{ kind: 'settlement' | 'city'; vertex: VertexId }> {
  const hex = state.board.hexes[castle.hexId];
  if (!hex) return [];
  const corners = new Set(hex.corners);
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const out: Array<{ kind: 'settlement' | 'city'; vertex: VertexId }> = [];
  for (const v of player.settlements) {
    if (corners.has(v)) out.push({ kind: 'settlement', vertex: v });
  }
  for (const v of player.cities) {
    if (corners.has(v)) out.push({ kind: 'city', vertex: v });
  }
  return out;
}

function destroyBuilding(
  state: GameState,
  playerId: PlayerId,
  target: { kind: 'settlement' | 'city'; vertex: VertexId },
): GameState {
  if (target.kind === 'settlement') {
    return updatePlayer(state, playerId, (p) => ({
      ...p,
      settlements: p.settlements.filter((v) => v !== target.vertex),
    }));
  }
  // City downgrades to settlement (mirrors Volcano).
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    cities: p.cities.filter((v) => v !== target.vertex),
    settlements: [...p.settlements, target.vertex],
  }));
}

function removeDefenderKnights(
  state: GameState,
  playerId: PlayerId,
  edges: EdgeId[],
): GameState {
  const deadSet = new Set(edges);
  const next = updatePlayer(state, playerId, (p) => ({
    ...p,
    defenderKnights: (p.defenderKnights ?? []).filter((e) => !deadSet.has(e)),
  }));
  return {
    ...next,
    barbarianKnightSupply: (next.barbarianKnightSupply ?? 0) + edges.length,
  };
}

function patchCastle(
  state: GameState,
  index: number,
  fn: (c: CastleState) => CastleState,
): GameState {
  const castles = state.castles ?? [];
  return {
    ...state,
    castles: castles.map((c, i) => (i === index ? fn(c) : c)),
  };
}
