import type { GameState, KnightRecord, PlayerId, VertexId } from '../../types';
import { updatePlayer } from '../../helpers';
import { BARBARIAN_TRACK_LENGTH } from './constants';
import { vertexHasMetropolis } from './improvements/state';

// Advance the barbarian ship one space along the track. Returns the next
// state plus a flag telling the caller to resolve a barbarian attack. The
// track has a start space and 7 more; the ship attacks when it reaches the
// last one (BARBARIAN_TRACK_LENGTH advances).
export function advanceBarbarianShip(
  state: GameState,
): { state: GameState; attacked: boolean } {
  if (!state.barbarian) return { state, attacked: false };
  const position = Math.min(state.barbarian.position + 1, BARBARIAN_TRACK_LENGTH);
  return {
    state: { ...state, barbarian: { ...state.barbarian, position } },
    attacked: position >= BARBARIAN_TRACK_LENGTH,
  };
}

// Barbarian strength (p.11) = the number of cities on the board, cities with
// a metropolis included (a metropolis is still a city, so it counts once).
export function barbarianStrength(state: GameState): number {
  let cities = 0;
  for (const p of state.players) cities += p.cities.length;
  return cities;
}

// Per-player active-knight strength: what each player contributes to the
// defense. Used both for the attack outcome and for the tracker UI.
export function defenderStrengthByPlayer(state: GameState): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const p of state.players) out[p.id] = 0;
  for (const k of Object.values(state.knights ?? {})) {
    if (k.active) out[k.playerId] = (out[k.playerId] ?? 0) + k.strength;
  }
  return out;
}

export function totalDefenderStrength(state: GameState): number {
  return Object.values(defenderStrengthByPlayer(state)).reduce((a, b) => a + b, 0);
}

// A player's cities that the barbarians may pillage: every city without a
// metropolis.
export function pillageableCities(state: GameState, playerId: PlayerId): VertexId[] {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return [];
  return p.cities.filter((v) => !vertexHasMetropolis(state, v));
}

// Turn order starting with the active player.
function turnOrderFromCurrent(state: GameState): PlayerId[] {
  const n = state.playerOrder.length;
  const out: PlayerId[] = [];
  for (let i = 0; i < n; i++) {
    out.push(state.playerOrder[(state.currentPlayerIndex + i) % n]!);
  }
  return out;
}

// Barbarians attack (p.11), in rulebook order:
//   - Barbarian strength = cities on the board; defense = all active knights.
//   - Defense >= barbarians: the unique top contributor takes a VP token;
//     tied top contributors instead each draw a progress card of their
//     choice, starting with the active player (pendingDefenderTieDraw).
//   - Barbarians stronger: the lowest contributor(s) — players with no
//     active knight count as lowest — each lose a city. A player who can't
//     be pillaged (no city, or only metropolis cities) is skipped, and if
//     nobody in that group can be, the next-lowest group is pillaged, and so
//     on. A player with one pillageable city loses it at once; with several
//     they choose (pendingPillage).
//   - Then the ship goes back to the start and every knight is laid down.
//   - The first attack places the robber on the desert and activates it.
export function resolveBarbarianAttack(state: GameState): GameState {
  if (!state.barbarian) return state;

  const strengths = defenderStrengthByPlayer(state);
  const barb = barbarianStrength(state);
  const totalDef = Object.values(strengths).reduce((a, b) => a + b, 0);
  const order = turnOrderFromCurrent(state);
  let next: GameState = state;
  let lastAttack: NonNullable<GameState['lastBarbarianAttack']>;

  if (totalDef >= barb) {
    const max = Math.max(0, ...Object.values(strengths));
    const top = order.filter((pid) => max > 0 && strengths[pid] === max);
    lastAttack = { barbarianStrength: barb, defenderStrength: totalDef, outcome: 'defended' };
    if (top.length === 1) {
      next = updatePlayer(next, top[0]!, (p) => ({
        ...p,
        defenderTokens: (p.defenderTokens ?? 0) + 1,
      }));
      lastAttack.defender = top[0]!;
    } else if (top.length > 1) {
      next = { ...next, pendingDefenderTieDraw: top };
      lastAttack.tied = top;
    }
  } else {
    lastAttack = {
      barbarianStrength: barb,
      defenderStrength: totalDef,
      outcome: 'pillaged',
      losers: [],
    };
    const levels = [...new Set(order.map((pid) => strengths[pid] ?? 0))].sort((a, b) => a - b);
    const choosers: PlayerId[] = [];
    for (const level of levels) {
      const group = order.filter((pid) => (strengths[pid] ?? 0) === level);
      const victims = group.filter((pid) => pillageableCities(next, pid).length > 0);
      if (victims.length === 0) continue;
      for (const pid of victims) {
        const cities = pillageableCities(next, pid);
        lastAttack.losers!.push(pid);
        if (cities.length === 1) next = pillageCity(next, pid, cities[0]!);
        else choosers.push(pid);
      }
      break;
    }
    if (choosers.length > 0) next = { ...next, pendingPillage: choosers };
  }

  // The barbarians return home: every knight is laid down (p.11).
  const knightsAfter: Record<VertexId, KnightRecord> = {};
  for (const [vid, k] of Object.entries(next.knights ?? {})) {
    knightsAfter[vid] = { ...k, active: false };
  }
  next = { ...next, knights: knightsAfter, lastBarbarianAttack: lastAttack };

  // First attack: move the robber from beside the track to the desert (p.6).
  if ((state.barbarian.attacksResolved ?? 0) === 0) {
    const desert = state.board.hexIds.find((h) => state.board.hexes[h]!.terrain === 'desert');
    next = {
      ...next,
      robberActive: true,
      board: desert ? { ...next.board, robberHex: desert } : next.board,
    };
  }
  return {
    ...next,
    barbarian: {
      position: 0,
      attacksResolved: (state.barbarian.attacksResolved ?? 0) + 1,
    },
  };
}

// Reduce a city to a settlement (p.11). A city wall under it goes back to
// the owner's supply (they may build it again).
export function pillageCity(state: GameState, playerId: PlayerId, vertex: VertexId): GameState {
  const hadWall = state.cityWalls?.[vertex] === playerId;
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    cities: p.cities.filter((v) => v !== vertex),
    settlements: [...p.settlements, vertex],
    ...(hadWall ? { cityWalls: Math.max(0, (p.cityWalls ?? 0) - 1) } : {}),
  }));
  if (next.cityWalls?.[vertex]) {
    const { [vertex]: _gone, ...rest } = next.cityWalls;
    next = { ...next, cityWalls: rest };
  }
  return next;
}
