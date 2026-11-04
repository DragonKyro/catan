import type { BoardState, HexId } from '../../../types';
import type { BarbarianAttackDef } from '../board/scenarios/types';

// Board facts resolved by the T&B generator for Barbarian Attack.
export interface BarbarianBoardSetup {
  castleHex: HexId;
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
  return {
    castleHex: known(id(def.castle)),
    coastalHexes: def.expelOrder.map((c) => known(id(c))),
    startBarbarians: def.startBarbarians.map((c) => known(id(c))),
  };
}
