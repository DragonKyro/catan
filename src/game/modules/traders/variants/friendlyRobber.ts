import type {
  GameState,
  MoveRobberAction,
  PlayerId,
  HexId,
} from '../../../types';
import { calculateVictoryPoints } from '../../../scoring/points';

const FRIENDLY_ROBBER_MIN_VP = 2;

// "Friendly Robber" variant: the robber may not be placed on a hex whose
// only adjacent buildings belong to players with ≤ 2 VPs.
// Rulebook: "If there is no valid hex, move the robber to the desert. In
// this case, steal 1 random card from a player with an adjacent building as
// long as they have more than 2 VPs."
//
// We implement the negative half here as a validator: reject illegal targets.
// The "fallback to desert" branch is handled by the engine naturally — if no
// non-desert hex is legal, the player must pick the desert (and may steal
// from a 3+ VP neighbour as usual).
//
// `includeHidden=false`: in real Catan, VP dev cards remain hidden, so the
// rule has to use a public count. (Otherwise a 3 VP player with one VP dev
// card would be invisible to the robber.) We use the public VP total here.
export function validateMoveRobberFriendlyRobber(
  state: GameState,
  action: MoveRobberAction,
): string | null {
  if (!state.settings.tradersVariants?.friendlyRobber) return null;
  // Only enforce in main-game phases. (Setup never moves the robber.)
  const targetIsDesert =
    state.board.hexes[action.hex]?.terrain === 'desert';
  if (targetIsDesert) return null; // desert is always allowed
  const owners = adjacentBuildingOwners(state, action.hex);
  if (owners.size === 0) return null; // empty hex — fine to block production
  let hasEligible = false;
  for (const ownerId of owners) {
    if (publicVp(state, ownerId) > FRIENDLY_ROBBER_MIN_VP) {
      hasEligible = true;
      break;
    }
  }
  if (hasEligible) return null;
  return 'Friendly Robber: cannot target a hex whose only neighbours have 2 or fewer VPs';
}

function adjacentBuildingOwners(
  state: GameState,
  hexId: HexId,
): Set<PlayerId> {
  const out = new Set<PlayerId>();
  for (const v of Object.values(state.board.vertices)) {
    if (!v.hexes.includes(hexId)) continue;
    for (const p of state.players) {
      if (p.settlements.includes(v.id) || p.cities.includes(v.id)) {
        out.add(p.id);
      }
    }
  }
  return out;
}

function publicVp(state: GameState, playerId: PlayerId): number {
  return calculateVictoryPoints(state, playerId, false);
}
