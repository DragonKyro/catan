import type { Resource } from '../../types';

export const SEAFARERS_EXPANSION_ID = 'seafarers';

// Building costs unique to Seafarers.
export const SHIP_COST: Partial<Record<Resource, number>> = { wood: 1, sheep: 1 };

// Token limits.
export const MAX_SHIPS = 15;

// Default bonus VP awarded for the first settlement on an outer island.
export const DEFAULT_ISLAND_BONUS_VP = 2;
