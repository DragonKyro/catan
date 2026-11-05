import type { Action, GameState, HexId, PlayerId } from '@/game/types';
import { totalResources } from '@/game/resources';
import {
  edgeOfHex,
  hexNeighbors,
  pirateHexOptions,
  pirateVictims,
  shipsOf,
} from '@/game/modules/explorersPirates/state';
import { firstLegal, goldOf, playerOf, publicVp } from './common';

// Placing our pirate ship (after a 7 or a successful chase). The pirate
// robs one ship owner on its hex and then charges every opponent's ship a
// 1-gold tribute (paid to us) for sailing onto, off or along it. So:
//   - rob the strongest opponent we can reach (VP first, then cards);
//   - prefer hexes rivals sail through — near their ships, the Council of
//     Catan's anchors (every delivery) and the fish shoals — over quiet sea;
//   - don't send a haul we're about to load back to the supply.

export function choosePiratePlacement(state: GameState, pid: PlayerId): Action | null {
  const ep = state.explorersPirates;
  if (!ep || state.phase !== 'epPlacePirate' || ep.pendingPirate?.playerId !== pid) return null;
  const options = pirateHexOptions(state);
  const scored = options
    .map((hex) => ({ hex, ...scoreHex(state, pid, hex) }))
    .sort((a, b) => b.score - a.score);
  return firstLegal(
    state,
    scored.map((s) => ({ type: 'epPlacePirate' as const, playerId: pid, hex: s.hex, stealFrom: s.victim })),
  );
}

function scoreHex(state: GameState, pid: PlayerId, hex: HexId): { score: number; victim: PlayerId | null } {
  const ep = state.explorersPirates!;
  const victims = pirateVictims(state, pid, hex);
  let victim: PlayerId | null = null;
  let stealScore = 0;
  for (const v of victims) {
    const cards = totalResources(playerOf(state, v).resources);
    const s = (cards > 0 ? 1.2 + Math.min(cards, 8) * 0.08 : 0.5 + Math.min(goldOf(state, v), 2) * 0.1) + publicVp(state, v) * 0.15;
    if (s > stealScore) {
      stealScore = s;
      victim = v;
    }
  }

  // Traffic: opponents' ships on or next to this hex will likely pay us.
  const near = new Set<HexId>([hex, ...hexNeighbors(state, hex)]);
  let traffic = 0;
  for (const s of ep.ships) {
    if (s.owner === pid) continue;
    const hexes = state.board.edges[s.edge]!.hexes;
    if (hexes.includes(hex)) traffic += 0.5;
    else if (hexes.some((h) => near.has(h))) traffic += 0.25;
  }
  const anchors = ep.councilAnchors;
  const corners = state.board.hexes[hex]?.corners ?? [];
  if (anchors.some((a) => corners.includes(a))) traffic += 0.6;
  else if (near.has(ep.councilHex)) traffic += 0.3;

  // A haul on this shoal goes back to the supply: good unless our own
  // empty ship is next to it.
  let haul = 0;
  const shoal = ep.shoals.find((s) => s.hex === hex);
  if (shoal?.haul) {
    const ours = shipsOf(state, pid).some(
      (s) => s.cargo.length === 0 && state.board.edges[s.edge]!.vertices.some((v) => corners.includes(v)),
    );
    haul = ours ? -2 : 0.6;
  } else if (shoal) {
    // A pirate on a shoal also stops new hauls there (for everyone).
    haul = -0.2;
  }

  // Our own ships sail freely past our pirate; nothing to subtract. A tiny
  // tie-break toward hexes our ships are on keeps rivals off our lanes.
  let lanes = 0;
  for (const s of shipsOf(state, pid)) if (edgeOfHex(state, s.edge, hex)) lanes += 0.05;

  return { score: stealScore + traffic + haul + lanes, victim };
}
