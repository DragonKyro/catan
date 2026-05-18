import type { GameState, PlayerId, VertexId } from '../../types';
import { updatePlayer } from '../../helpers';
import { rngInt } from '../../rng';
import { BARBARIAN_TRACK_LENGTH } from './constants';

// Advance the barbarian ship one space along the track. Returns the next
// state plus a flag telling the caller to resolve a barbarian attack.
//
// Phase 1 of Cities & Knights — no knights yet, so every attack is lost.
export function advanceBarbarianShip(
  state: GameState,
): { state: GameState; attacked: boolean } {
  if (!state.barbarian) return { state, attacked: false };
  const next: GameState = {
    ...state,
    barbarian: {
      ...state.barbarian,
      position: Math.min(state.barbarian.position + 1, BARBARIAN_TRACK_LENGTH),
    },
  };
  return { state: next, attacked: next.barbarian!.position >= BARBARIAN_TRACK_LENGTH };
}

// Resolve a barbarian attack. Phase 1: defenders always lose (no knights).
// Every player with at least one city is "tied at zero strength", so the
// rulebook says they each lose a city. Walls come off first, then the city
// reverts to a settlement.
//
// Returns the post-attack state with the ship reset, attacksResolved
// incremented, and (on the first attack) the robber activated.
export function resolveBarbarianAttack(state: GameState): GameState {
  if (!state.barbarian) return state;

  let next: GameState = state;

  // Each player with cities loses one to pillage (random pick among their
  // cities, seeded so all peers reduce identically).
  for (const p of state.players) {
    if (p.cities.length === 0) continue;
    const [idx, newRng] = rngInt(next.rngState, p.cities.length);
    next = { ...next, rngState: newRng };
    const victim: VertexId = p.cities[idx]!;
    next = pillageCity(next, p.id, victim);
  }

  // First barbarian attack also activates the robber.
  const firstAttack = (state.barbarian.attacksResolved ?? 0) === 0;
  if (firstAttack) {
    next = { ...next, robberActive: true };
  }

  next = {
    ...next,
    barbarian: {
      position: 0,
      attacksResolved: (state.barbarian.attacksResolved ?? 0) + 1,
    },
  };

  return next;
}

// Reduce a city back to a settlement. Removes the wall (if any) and refunds
// nothing — the wall and ore/wheat investments are lost.
function pillageCity(
  state: GameState,
  playerId: PlayerId,
  vertex: VertexId,
): GameState {
  let next = updatePlayer(state, playerId, (p) => {
    const hadWall = (state.cityWalls?.[vertex]) === playerId;
    return {
      ...p,
      cities: p.cities.filter((v) => v !== vertex),
      settlements: [...p.settlements, vertex],
      ...(hadWall ? { cityWalls: Math.max(0, (p.cityWalls ?? 0) - 1) } : {}),
    };
  });
  // Strip the wall record off the GameState map.
  if (next.cityWalls?.[vertex]) {
    const { [vertex]: _gone, ...rest } = next.cityWalls;
    next = { ...next, cityWalls: rest };
  }
  return next;
}
