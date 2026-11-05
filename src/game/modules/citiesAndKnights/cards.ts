import type { CommodityBank, GameState, PlayerId, ResourceBank } from '../../types';
import { COMMODITIES, RESOURCES } from '../../types';
import { updatePlayer } from '../../helpers';
import { addResources, subtractResources } from '../../resources';
import { addCommodities, subtractCommodities } from '../../commodities';

const NO_COMMODITIES: CommodityBank = { paper: 0, cloth: 0, coin: 0 };

// Count of cards in a resource + commodity selection; throws on negative or
// fractional amounts.
export function selectionSize(
  resources: Partial<ResourceBank> | undefined,
  commodities: Partial<CommodityBank> | undefined,
): number {
  let n = 0;
  for (const r of RESOURCES) {
    const v = resources?.[r] ?? 0;
    if (!Number.isInteger(v) || v < 0) throw new Error('Invalid card count');
    n += v;
  }
  for (const c of COMMODITIES) {
    const v = commodities?.[c] ?? 0;
    if (!Number.isInteger(v) || v < 0) throw new Error('Invalid card count');
    n += v;
  }
  return n;
}

// Does `playerId` hold every card in the selection?
export function holdsSelection(
  state: GameState,
  playerId: PlayerId,
  resources: Partial<ResourceBank> | undefined,
  commodities: Partial<CommodityBank> | undefined,
): boolean {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return false;
  for (const r of RESOURCES) if ((resources?.[r] ?? 0) > p.resources[r]) return false;
  const pc = p.commodities ?? NO_COMMODITIES;
  for (const c of COMMODITIES) if ((commodities?.[c] ?? 0) > pc[c]) return false;
  return true;
}

// Move resource + commodity cards from one player to another.
export function transferCards(
  state: GameState,
  from: PlayerId,
  to: PlayerId,
  resources: Partial<ResourceBank> | undefined,
  commodities: Partial<CommodityBank> | undefined,
): GameState {
  const r = resources ?? {};
  const c = commodities ?? {};
  let next = updatePlayer(state, from, (p) => ({
    ...p,
    resources: subtractResources(p.resources, r),
    commodities: subtractCommodities(p.commodities ?? NO_COMMODITIES, c),
  }));
  next = updatePlayer(next, to, (p) => ({
    ...p,
    resources: addResources(p.resources, r),
    commodities: addCommodities(p.commodities ?? NO_COMMODITIES, c),
  }));
  return next;
}
