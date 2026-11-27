// The AI levels' ids and names, apart from levels.ts (which pulls in the
// network runtime and its policy file) so the menus and lobby can show them
// without loading the network.

import type { AiLevel } from '@/game/types';

export const AI_LEVEL_IDS: readonly AiLevel[] = ['hard'];
export const DEFAULT_AI_LEVEL: AiLevel = 'hard';
export const AI_LEVEL_LABEL: Record<AiLevel, string> = { hard: 'Hard' };
