import type { GameState, PlayerId, VertexId } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { FISH_TOKEN_CAP } from '../constants';
import { drawFish } from './pool';

// Maybe distribute fish tokens for this dice roll. Called from the base
// `handleRollDice` after resource production. Iterates the lake (if present)
// and each fishing ground; if their tokens match `rolled`, grants fish to
// the relevant settlements / cities (1 per settle, 2 per city).
//
// Distribution order: active player first, then clockwise — so when a
// boot draw collides with multiple eligible players, the active player has
// the chance to receive it first. Boot doesn't count against the 7-fish
// cap; once drawn it lives in `state.oldBootHolder`.
export function maybeDistributeFish(state: GameState, rolled: number): GameState {
  if (!state.fishingGrounds && state.lakeHexId == null) return state;
  // Build (playerId → fish count) for this roll.
  const counts = new Map<PlayerId, number>();
  const bump = (pid: PlayerId, by: number) =>
    counts.set(pid, (counts.get(pid) ?? 0) + by);

  // Lake hex production. Blocked when the robber sits on the lake (rulebook
  // explicitly allows that placement) — and also blocked when robber is
  // off-board on a lake-id, defensively.
  if (state.lakeHexId != null) {
    const lake = state.board.hexes[state.lakeHexId];
    if (lake && lake.numberToken === rolled) {
      const robberBlocked =
        state.board.robberHex === state.lakeHexId &&
        (state.robberActive ?? true);
      if (!robberBlocked) {
        for (const v of Object.values(state.board.vertices)) {
          if (!v.hexes.includes(state.lakeHexId)) continue;
          for (const p of state.players) {
            if (p.settlements.includes(v.id)) bump(p.id, 1);
            else if (p.cities.includes(v.id)) bump(p.id, 2);
          }
        }
      }
    }
  }

  // Fishing ground tiles. Each is anchored to one vertex; only the
  // occupant of that vertex (if any) collects fish. Robber doesn't apply
  // — fishing grounds are off-board frame pieces.
  for (const fg of state.fishingGrounds ?? []) {
    if (fg.token !== rolled) continue;
    awardFishingGround(state, fg.vertex, bump);
  }

  if (counts.size === 0) return state;
  // Iterate players in turn order so the active player gets first crack at
  // the boot.
  const order = orderedPlayerIds(state);
  let next = state;
  for (const pid of order) {
    const n = counts.get(pid);
    if (!n) continue;
    next = grantFish(next, pid, n);
  }
  return next;
}

function awardFishingGround(
  state: GameState,
  anchor: VertexId,
  bump: (pid: PlayerId, by: number) => void,
): void {
  for (const p of state.players) {
    if (p.settlements.includes(anchor)) bump(p.id, 1);
    else if (p.cities.includes(anchor)) bump(p.id, 2);
  }
}

// Grant up to `count` fish tokens to a player, drawing from the pool one
// at a time. Stops early when the player hits FISH_TOKEN_CAP or the pool
// is empty. The old boot lands on `state.oldBootHolder` without consuming
// a fish slot (the boot is not a fish token by the rulebook).
export function grantFish(
  state: GameState,
  playerId: PlayerId,
  count: number,
): GameState {
  let next = state;
  for (let i = 0; i < count; i++) {
    const player = next.players.find((p) => p.id === playerId);
    if (!player) break;
    const currentTokens = player.fishTokens?.length ?? 0;
    if (currentTokens >= FISH_TOKEN_CAP) break;
    const draw = drawFish(next);
    next = draw.state;
    if (draw.token === null) break;
    if (draw.token === 'oldBoot') {
      next = { ...next, oldBootHolder: playerId };
      continue;
    }
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      fishTokens: [...(p.fishTokens ?? []), draw.token as 'one' | 'two' | 'three'],
    }));
  }
  return next;
}

// Active player first, then clockwise. Falls back to seat order when the
// playerOrder isn't populated (very old snapshots).
function orderedPlayerIds(state: GameState): PlayerId[] {
  const order = state.playerOrder.length > 0
    ? state.playerOrder
    : state.players.map((p) => p.id);
  const start = state.currentPlayerIndex % order.length;
  return [
    ...order.slice(start),
    ...order.slice(0, start),
  ];
}
