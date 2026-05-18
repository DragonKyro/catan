import type { GameState, PlayerId, VertexId } from '../../types';
import { updatePlayer } from '../../helpers';
import { rngInt } from '../../rng';
import { BARBARIAN_TRACK_LENGTH } from './constants';
import { metropolisCount, vertexHasMetropolis } from './improvements/state';

// Advance the barbarian ship one space along the track. Returns the next
// state plus a flag telling the caller to resolve a barbarian attack.
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

// Barbarian strength = total cities on the board + total metropolises
// (metropolises also count toward strength per rulebook p.8).
export function barbarianStrength(state: GameState): number {
  let cities = 0;
  for (const p of state.players) cities += p.cities.length;
  return cities + metropolisCount(state);
}

// Per-player active-knight strength. Used both for the attack outcome and
// for the Barbarians tracker UI.
export function defenderStrengthByPlayer(
  state: GameState,
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const p of state.players) out[p.id] = 0;
  for (const k of Object.values(state.knights ?? {})) {
    if (k.active) out[k.playerId] = (out[k.playerId] ?? 0) + k.strength;
  }
  return out;
}

// Resolve a barbarian attack. Either:
//   - Defenders win (sum knight strength >= cities + metropolises):
//       Top contributor gets a defender-of-Catan token (+1 VP). Ties: each
//       tied player draws a progress card of their choice (queued on
//       state.pendingDefenderTieDraw, resolved via defenderTieDraw action).
//   - Defenders lose:
//       Lowest contributors get one of their cities pillaged each (walls
//       drop first, city -> settlement). Metropolises are immune.
//
// After resolution: lay all knights down (rulebook p.11), reset the track,
// increment attacksResolved, and activate the robber on the first attack.
export function resolveBarbarianAttack(state: GameState): GameState {
  if (!state.barbarian) return state;

  let next: GameState = state;
  const strengths = defenderStrengthByPlayer(state);
  const barb = barbarianStrength(state);
  const totalDef = Object.values(strengths).reduce((a, b) => a + b, 0);

  if (totalDef >= barb) {
    // Defenders win.
    const max = Math.max(...Object.values(strengths));
    const topContributors = Object.entries(strengths)
      .filter(([, v]) => v === max && v > 0)
      .map(([pid]) => pid);
    if (topContributors.length === 1) {
      const winner = topContributors[0]!;
      next = updatePlayer(next, winner, (p) => ({
        ...p,
        defenderTokens: (p.defenderTokens ?? 0) + 1,
      }));
    } else if (topContributors.length > 1 && max > 0) {
      // Tie: each tied player draws a progress card of their choice.
      // Order by player order.
      const ordered: PlayerId[] = [];
      for (const id of state.playerOrder) {
        if (topContributors.includes(id)) ordered.push(id);
      }
      next = { ...next, pendingDefenderTieDraw: ordered };
    }
  } else {
    // Defenders lose. Lowest contributors lose a city each (walls drop,
    // city -> settlement). Metropolises can't be pillaged. If a player's
    // only remaining cities all host metropolises, they sit out.
    const min = Math.min(...Object.values(strengths));
    const losers = Object.entries(strengths)
      .filter(([, v]) => v === min)
      .map(([pid]) => pid);
    for (const pid of losers) {
      const player = next.players.find((p) => p.id === pid);
      if (!player) continue;
      const pillageable = player.cities.filter(
        (v) => !vertexHasMetropolis(next, v),
      );
      if (pillageable.length === 0) continue;
      const [idx, newRng] = rngInt(next.rngState, pillageable.length);
      next = { ...next, rngState: newRng };
      next = pillageCity(next, pid, pillageable[idx]!);
    }
  }

  // Lay all knights down (rulebook p.11).
  const knightsAfter: Record<VertexId, import('../../types').KnightRecord> = {};
  for (const [vid, k] of Object.entries(next.knights ?? {})) {
    knightsAfter[vid] = { ...k, active: false };
  }
  next = { ...next, knights: knightsAfter };

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
