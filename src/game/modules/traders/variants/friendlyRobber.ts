import type {
  GameState,
  MoveRobberAction,
  PlayerId,
  HexId,
} from '../../../types';
import { calculateVictoryPoints } from '../../../scoring/points';
import { canMoveRobberTo } from '../../../placement';

// "The Friendly Robber" (2025 T&B rulebook p. 4): "You may not move the
// robber to a hex with the building of a player who only has 2 VPs. If
// there is no valid hex, move the robber to the desert. In this case, steal
// 1 random card from a player with an adjacent building as long as they
// have more than 2 VPs."
//
// Readings:
//   - "only has 2 VPs" = 2 or fewer (T&B's Poor Catanian tile can push a
//     player below 2), counted on public VPs — hidden VP cards don't show.
//   - ANY such building rules the hex out, whoever else is there.
//   - With no valid hex, the desert(s) are the only targets. A board with no
//     desert (Merchant Trains' watering hole, Rivers' swamps, Fishing's
//     lake) falls back to its non-producing land hexes, and failing those
//     to any hex — the rule can't be met, so the robber isn't stuck.
//   - The steal never targets a player with 2 VPs or fewer; on a valid hex
//     there's no such neighbour anyway, so this only bites at the desert.
// Works with any rule set: the variant module wires it in (validators).

const FRIENDLY_ROBBER_MAX_PROTECTED_VP = 2;

function publicVp(state: GameState, playerId: PlayerId): number {
  return calculateVictoryPoints(state, playerId, false);
}

function isProtected(state: GameState, playerId: PlayerId): boolean {
  return publicVp(state, playerId) <= FRIENDLY_ROBBER_MAX_PROTECTED_VP;
}

// Does a player with 2 VPs or fewer have a building on this hex?
function shelters(state: GameState, hexId: HexId): boolean {
  const corners = new Set(state.board.hexes[hexId]?.corners ?? []);
  return state.players.some(
    (p) =>
      isProtected(state, p.id) &&
      (p.settlements.some((v) => corners.has(v)) || p.cities.some((v) => corners.has(v))),
  );
}

const NON_PRODUCING = new Set(['swamp', 'wateringHole', 'castle', 'commodity']);

// Hexes the robber may go to under the variant (always non-empty while the
// board has a hex the base rules allow).
export function friendlyRobberTargets(state: GameState): HexId[] {
  const open = state.board.hexIds.filter((h) => canMoveRobberTo(state, h));
  const valid = open.filter((h) => !shelters(state, h));
  if (valid.length > 0) return valid;
  const deserts = open.filter((h) => state.board.hexes[h]!.terrain === 'desert');
  if (deserts.length > 0) return deserts;
  const barren = open.filter((h) => NON_PRODUCING.has(state.board.hexes[h]!.terrain));
  if (barren.length > 0) return barren;
  return open;
}

export function validateMoveRobberFriendlyRobber(
  state: GameState,
  action: MoveRobberAction,
): string | null {
  if (!friendlyRobberTargets(state).includes(action.hex)) {
    return 'Friendly Robber: the robber may not go to a hex with a building of a player who has only 2 VPs';
  }
  if (action.stealFrom && isProtected(state, action.stealFrom)) {
    return 'Friendly Robber: you may not steal from a player who has only 2 VPs';
  }
  return null;
}

export function validateRobberVictimFriendlyRobber(
  state: GameState,
  _hexId: HexId,
  victimId: PlayerId,
): string | null {
  return isProtected(state, victimId)
    ? 'Friendly Robber: you may not steal from a player who has only 2 VPs'
    : null;
}
