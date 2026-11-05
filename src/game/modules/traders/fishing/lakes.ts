import type { GameState, HexId } from '../../../types';

// Every lake on the board: one at 3-4 players (`state.lakeHexId`), two at
// 5-6 (`state.lakeHexIds`, T&B 5-6 rulebook p. 5). Read lakes only through
// this so both board sizes work.
export function lakeHexes(state: Pick<GameState, 'lakeHexId' | 'lakeHexIds'>): HexId[] {
  if (state.lakeHexIds && state.lakeHexIds.length > 0) return state.lakeHexIds;
  return state.lakeHexId != null ? [state.lakeHexId] : [];
}
