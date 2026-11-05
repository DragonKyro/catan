import type {
  CommodityGood,
  CommodityLocationId,
  ResourceBank,
  TbDevCard,
} from '../../../types';

// The "Traders & Barbarians" scenario (2025 rulebook pp. 20-24).

export const TB_SCENARIO_DEFAULT_VP = 13;

// "Each player takes 5 gold."
export const TB_START_GOLD = 5;

// The scenario's 25 development cards (the base deck stays in the box).
export const TB_DECK_COUNTS: Record<TbDevCard, number> = {
  knight: 16,
  roadBuilding: 3,
  swiftJourney: 3,
  victoryPoint: 3,
};

// What each location buys and the 12 tokens stacked next to it ("The
// castle needs marble and glass. It provides tools and sand." etc.).
export const TB_LOCATION_NEEDS: Record<CommodityLocationId, CommodityGood[]> = {
  quarry: ['tools'],
  castle: ['marble', 'glass'],
  glassworks: ['sand'],
};
export const TB_LOCATION_STACK: Record<CommodityLocationId, Partial<Record<CommodityGood, number>>> = {
  quarry: { sand: 6, marble: 6 },
  castle: { tools: 6, sand: 6 },
  glassworks: { glass: 6, tools: 6 },
};

// Where each good is delivered.
export const TB_GOOD_DESTINATION: Record<CommodityGood, CommodityLocationId> = {
  tools: 'quarry',
  marble: 'castle',
  glass: 'castle',
  sand: 'glassworks',
};

// The wagon board, one column per level (1..5): movement points, the
// lowest die face that drives a barbarian off (null = can't try), and the
// gold a delivery pays.
export interface TbWagonLevel {
  mp: number;
  driveOffMin: number | null;
  deliveryGold: number;
}
export const TB_WAGON_LEVELS: TbWagonLevel[] = [
  { mp: 4, driveOffMin: null, deliveryGold: 1 },
  { mp: 5, driveOffMin: 6, deliveryGold: 2 },
  { mp: 6, driveOffMin: 5, deliveryGold: 3 },
  { mp: 7, driveOffMin: 4, deliveryGold: 4 },
  { mp: 7, driveOffMin: 3, deliveryGold: 5 },
];
export const TB_MAX_WAGON_LEVEL = TB_WAGON_LEVELS.length;
// "If you upgrade your wagon four times, you receive 1 VP."
export const TB_FULL_UPGRADE_VP = 1;

// Upgrade costs, indexed by the CURRENT level (1→2 at index 1, …, 4→5 at 4).
export const TB_WAGON_UPGRADE_COSTS: Record<number, Partial<ResourceBank>> = {
  1: { wood: 1, sheep: 1, ore: 1 },
  2: { wood: 1, sheep: 1, ore: 1 },
  3: { wood: 2, sheep: 1, ore: 1 },
  4: { wood: 2, sheep: 1, ore: 1 },
};

// Movement point costs per edge.
export const TB_MP_NO_ROAD = 2;
export const TB_MP_ROAD = 1;
export const TB_MP_BARBARIAN = 2;
// Gold paid to the owner of a rival's road the wagon moves along.
export const TB_TOLL_GOLD = 1;

// "Spend 1 wheat to increase your MPs by two." Once per "Move your wagon"
// action (see wagon.ts for the once-per-turn / 2×-per-turn reading).
export const TB_BOOST_COST: Partial<ResourceBank> = { wheat: 1 };
export const TB_BOOST_MP = 2;
