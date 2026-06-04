import type { Action, GameState, PlayerId, EdgeId } from '@/game/types';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { canPlaceKnight } from '@/game/modules/traders/barbarianAttack/placement';

// Threat tier — barbarian "hexes to castle" remaining. Lower = more urgent.
// At threat 0 the barbarian is AT the castle (combat fires this endTurn) so
// any reinforcement would be wasted; we treat that as "no point" and skip.
// At threat 1 a hire RIGHT NOW joins the next defense — highest priority.
const IMMEDIATE_THREAT = 1;
const SOON_THREAT = 2;

// Hire a defender knight when a barbarian group is within `SOON_THREAT`
// of one of the castles AND the existing defending strength at that
// castle does NOT already meet the barbarian's strength.
//
// Pick the most urgent castle (lowest threat) that we have a legal slot
// to fill at. Pick any legal slot at that castle (placement is symmetric
// — no connectivity rule).
export function tryHireKnight(
  state: GameState,
  playerId: PlayerId,
): Action | null {
  if (!state.castles?.length) return null;
  if ((state.barbarianKnightSupply ?? 0) <= 0) return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if (!canAfford(player.resources, COSTS.hireKnight)) return null;

  // Survey castles sorted by threat (ascending — lowest = most urgent).
  const castles = state.castles
    .map((c) => ({
      castle: c,
      threat: c.barbarianPath.length - 1 - c.barbarianPosition,
    }))
    // Treat threat 0 (already at castle) as worthless — combat is this
    // turn and a new knight doesn't change that.
    .filter((x) => x.threat >= IMMEDIATE_THREAT)
    .sort((a, b) => a.threat - b.threat);

  for (const { castle, threat } of castles) {
    if (threat > SOON_THREAT) continue;
    // Skip if the castle is already adequately defended (the bank's
    // wheat+ore are better spent elsewhere when we've covered the
    // barbarian strength).
    const total = totalDefendersAt(state, castle.hexId);
    if (total >= castle.barbarianStrength) continue;
    const slot = pickKnightSlot(state, castle.hexId, playerId);
    if (slot) return { type: 'hireKnight', playerId, edge: slot };
  }
  return null;
}

function totalDefendersAt(state: GameState, castleHexId: string): number {
  let total = 0;
  for (const p of state.players) {
    for (const e of p.defenderKnights ?? []) {
      const edge = state.board.edges[e];
      if (edge?.hexes.includes(castleHexId)) total++;
    }
  }
  return total;
}

function pickKnightSlot(
  state: GameState,
  castleHexId: string,
  playerId: PlayerId,
): EdgeId | null {
  for (const e of Object.values(state.board.edges)) {
    if (!e.hexes.includes(castleHexId)) continue;
    if (canPlaceKnight(state, e.id, playerId)) return e.id;
  }
  return null;
}
