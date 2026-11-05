import type { Action } from '@/game/types';

// Explorers & Pirates actions for the end-game replay (Replay.tsx) and the
// replay screen (ReplayScreen.tsx): which ones are slider stops, and how
// each reads in the step label.

// Actions that change the board (pieces placed or moved, hexes explored,
// hauls appearing, the pirate ship).
export const EP_BOARD_CHANGING_ACTIONS: ReadonlyArray<Action['type']> = [
  'epBuildHarbor',
  'epBuildShip',
  'epBuildSettler',
  'epBuildCrew',
  'epMoveShip',
  'epTransfer',
  'epFoundSettlement',
  'epCrewToLair',
  'epCrewFromLair',
  'epCrewToFarm',
  'epLoadSpice',
  'epLoadFish',
  'epDeliver',
  'epChasePirate',
  'epFishRoll',
  'epPlacePirate',
];

// Every E&P action worth a stop on the replay screen.
export const EP_MEANINGFUL_ACTIONS: ReadonlyArray<Action['type']> = [
  ...EP_BOARD_CHANGING_ACTIONS,
  'epBoostShip',
  'epFastGold',
];

export function epActionDescription(action: Action, who: string, name: (id: string) => string): string | null {
  switch (action.type) {
    case 'epBuildHarbor':
      return `${who} builds a harbor settlement`;
    case 'epBuildShip':
      return `${who} builds a ship`;
    case 'epBuildSettler':
      return `${who} builds a settler`;
    case 'epBuildCrew':
      return `${who} builds a crew`;
    case 'epFastGold':
      return `${who} trades ${action.give} for gold (Fast Gold)`;
    case 'epMoveShip':
      return `${who} sails a ship`;
    case 'epBoostShip':
      return `${who} pays wool for +2 MP`;
    case 'epTransfer':
      return `${who} loads / unloads a ship`;
    case 'epFoundSettlement':
      return `${who} founds a settlement from a ship`;
    case 'epCrewToLair':
      return `${who} lands a crew on a pirate lair`;
    case 'epCrewFromLair':
      return `${who} takes a crew back aboard`;
    case 'epCrewToFarm':
      return `${who} lands a crew on a spice farm`;
    case 'epLoadSpice':
      return `${who} loads a spice sack`;
    case 'epLoadFish':
      return `${who} loads a fish haul`;
    case 'epDeliver':
      return `${who} delivers to the Council of Catan`;
    case 'epChasePirate':
      return `${who} attacks the pirate ship`;
    case 'epFishRoll':
      return `${who} rolls for fish`;
    case 'epPlacePirate':
      return `${who} places their pirate ship${action.stealFrom ? ` and robs ${name(action.stealFrom)}` : ''}`;
    default:
      return null;
  }
}
