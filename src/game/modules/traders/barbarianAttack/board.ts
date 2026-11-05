import type { BoardState, HexId } from '../../../types';
import type { BarbarianAttackDef } from '../board/scenarios/types';

// Board facts resolved by the T&B generator for Barbarian Attack.
export interface BarbarianBoardSetup {
  castleHex: HexId;
  // 5-6 players: every castle (`castleHex` first). Absent with one castle.
  castleHexes?: HexId[];
  // Coastal hexes in expel order (clockwise from the 4 next to the castle).
  coastalHexes: HexId[];
  // Hexes that start with one barbarian (the 2 and the 12).
  startBarbarians: HexId[];
}

export function resolveBarbarianBoard(def: BarbarianAttackDef, board: BoardState): BarbarianBoardSetup {
  const id = (c: { q: number; r: number }) => `${c.q},${c.r}`;
  const known = (h: HexId) => {
    if (!board.hexes[h]) throw new Error(`Barbarian Attack: no hex at ${h}`);
    return h;
  };
  const extra = (def.extraCastles ?? []).map((c) => known(id(c)));
  return {
    castleHex: known(id(def.castle)),
    ...(extra.length > 0 ? { castleHexes: [known(id(def.castle)), ...extra] } : {}),
    coastalHexes: def.expelOrder.map((c) => known(id(c))),
    startBarbarians: def.startBarbarians.map((c) => known(id(c))),
  };
}
