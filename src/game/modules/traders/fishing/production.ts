import type { GameState, PlayerId } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { hexRollsOn } from '../../../board/hexNumbers';
import { FISH_TOKEN_CAP } from '../constants';
import { drawFish } from './pool';

// Fishing on Catan production (rulebook p. 10). Called from the base
// `handleRollDice` after resource production. The lake (printed 2 / 3 / 11
// / 12, blocked by the robber) and each fishing ground whose number was
// rolled pay every settlement on one of their corners 1 fish token and
// every city 2. Players draw one token at a time, starting with the active
// player and going clockwise; the old boot is revealed (to
// `state.oldBootHolder`) the moment it is drawn.
//
// The 7-token cap (boot excluded): a draw that would go past it stops that
// player's drawing. Once per turn such a player may discard 1 token and
// draw a replacement — production is the only time fish arrive, so the
// offer is the 'fishSwap' phase that follows this roll (players decide in
// turn order, after everyone's normal draws).
export function maybeDistributeFish(state: GameState, rolled: number): GameState {
  if (!state.fishingGrounds && state.lakeHexId == null) return state;
  const counts = new Map<PlayerId, number>();
  const bump = (pid: PlayerId, by: number) =>
    counts.set(pid, (counts.get(pid) ?? 0) + by);
  const payCorner = (vid: string) => {
    for (const p of state.players) {
      if (p.settlements.includes(vid)) bump(p.id, 1);
      else if (p.cities.includes(vid)) bump(p.id, 2);
    }
  };

  if (state.lakeHexId != null) {
    const lake = state.board.hexes[state.lakeHexId];
    const robbed =
      state.board.robberHex === state.lakeHexId && (state.robberActive ?? true);
    if (lake && !robbed && hexRollsOn(lake, rolled)) {
      for (const vid of lake.corners) payCorner(vid);
    }
  }
  // Fishing grounds are frame pieces: the robber can't reach them.
  for (const fg of state.fishingGrounds ?? []) {
    if (fg.token !== rolled) continue;
    for (const vid of fg.vertices) payCorner(vid);
  }

  if (counts.size === 0) return state;
  let next = state;
  const capped: PlayerId[] = [];
  for (const pid of turnOrderFromActive(state)) {
    const n = counts.get(pid);
    if (!n) continue;
    const res = grantFish(next, pid, n);
    next = res.state;
    if (res.capped && hasFish(next, pid)) capped.push(pid);
  }
  if (capped.length > 0) {
    return { ...next, phase: 'fishSwap', fishSwap: { queue: capped, returnTo: next.phase } };
  }
  return next;
}

// Draw up to `count` fish tokens for a player, one at a time. Stops at the
// 7-token cap (`capped` = a draw was cut off) or when the supply and the
// discard pile are both empty. The old boot goes to `state.oldBootHolder`
// and doesn't take a fish slot.
export function grantFish(
  state: GameState,
  playerId: PlayerId,
  count: number,
): { state: GameState; capped: boolean } {
  let next = state;
  for (let i = 0; i < count; i++) {
    const player = next.players.find((p) => p.id === playerId);
    if (!player) break;
    if ((player.fishTokens?.length ?? 0) >= FISH_TOKEN_CAP) {
      return { state: next, capped: true };
    }
    const draw = drawFish(next);
    next = draw.state;
    if (draw.token === null) break;
    next = takeToken(next, playerId, draw.token);
  }
  return { state: next, capped: false };
}

// Give a drawn token to a player: a fish into their hand, the boot face up.
export function takeToken(
  state: GameState,
  playerId: PlayerId,
  token: 'one' | 'two' | 'three' | 'oldBoot',
): GameState {
  if (token === 'oldBoot') return { ...state, oldBootHolder: playerId };
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    fishTokens: [...(p.fishTokens ?? []), token],
  }));
}

function hasFish(state: GameState, pid: PlayerId): boolean {
  return (state.players.find((p) => p.id === pid)?.fishTokens?.length ?? 0) > 0;
}

// Active player first, then clockwise.
function turnOrderFromActive(state: GameState): PlayerId[] {
  const order = state.playerOrder.length > 0
    ? state.playerOrder
    : state.players.map((p) => p.id);
  const start = state.currentPlayerIndex % order.length;
  return [...order.slice(start), ...order.slice(0, start)];
}
