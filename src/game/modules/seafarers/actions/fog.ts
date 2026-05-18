import type { GameState, HexId, PlayerId, Resource, ResourceBank } from '../../../types';
import { RESOURCES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { addResources, subtractResources } from '../../../resources';

// Reveal any fog hexes touched by the set of hex ids (the hexes adjacent
// to a piece that was just built or moved). For each newly-revealed hex:
//   - resource terrain (wood/brick/sheep/wheat/ore): grant 1 from the bank
//     to the player (if the bank has any).
//   - gold: stack a "gold pick" onto the chooseGoldResource phase. The
//     phase is set up with returnTo equal to the current state's phase
//     (so the post-action flow drops back where it started — `main` for
//     normal builds, `setupRound2` for setup-round-2 placements).
//   - desert: revealed but no reward.
//   - sea: revealed but no reward (uncommon — fog hexes are usually land).
//
// Always returns a state where the touched fog hexes are removed from
// `unrevealedFogHexes`. The caller doesn't need to know whether a reveal
// happened; just pass in the adjacent hex ids and use the result.
export function revealAdjacentFog(
  state: GameState,
  adjacentHexIds: Iterable<HexId>,
  playerId: PlayerId,
): GameState {
  const unrevealed = state.unrevealedFogHexes;
  if (!unrevealed || unrevealed.length === 0) return state;

  const adjacent = new Set(adjacentHexIds);
  const toReveal: HexId[] = [];
  for (const hid of unrevealed) {
    if (adjacent.has(hid)) toReveal.push(hid);
  }
  if (toReveal.length === 0) return state;

  // Strip the revealed hexes from state.unrevealedFogHexes first; everything
  // below operates on the post-reveal state.
  const stillFog = unrevealed.filter((id) => !toReveal.includes(id));
  let next: GameState = {
    ...state,
    unrevealedFogHexes: stillFog.length > 0 ? stillFog : undefined,
  };

  let resourceGains: Partial<ResourceBank> = {};
  let goldPicksDelta = 0;

  for (const hid of toReveal) {
    const hex = next.board.hexes[hid];
    if (!hex) continue;
    const t = hex.terrain;
    if (t === 'desert' || t === 'sea') continue;
    if (t === 'gold') {
      goldPicksDelta += 1;
      continue;
    }
    // Resource hex: grant 1 if the bank can supply.
    const r = t as Resource;
    if (next.bank[r] > 0) {
      resourceGains[r] = (resourceGains[r] ?? 0) + 1;
    }
  }

  // Apply collected resource gains.
  const hasGains = RESOURCES.some((r) => (resourceGains[r] ?? 0) > 0);
  if (hasGains) {
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      resources: addResources(p.resources, resourceGains),
    }));
    next = { ...next, bank: subtractResources(next.bank, resourceGains) };
  }

  // Gold reveals stack picks into the chooseGoldResource phase. Honor any
  // existing pending state (e.g. a setup-round-2 gold-adjacent settlement
  // that also revealed gold fog — both contribute to the same picker).
  if (goldPicksDelta > 0) {
    const existing = next.goldChoiceState?.pending[playerId] ?? 0;
    const existingReturnTo = next.goldChoiceState?.returnTo;
    // First-time entry into the phase records returnTo as wherever we
    // came from. Subsequent reveals during the same flow keep the
    // original returnTo so we don't accidentally lose the setup context.
    const returnTo =
      existingReturnTo ?? (state.phase === 'setupRound2' ? 'setupRound2' : 'main');
    next = {
      ...next,
      phase: 'chooseGoldResource',
      goldChoiceState: {
        pending: {
          ...(next.goldChoiceState?.pending ?? {}),
          [playerId]: existing + goldPicksDelta,
        },
        returnTo,
      },
    };
  }

  return next;
}
