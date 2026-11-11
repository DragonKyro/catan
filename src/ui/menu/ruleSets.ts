// One colour per rule set, shared by the home screen's rule-set chips and the
// New Game expansion rows.
export const RULE_SET_COLORS = {
  base: '#f5c84a',
  seafarers: '#4fb3e8',
  citiesKnights: '#e5463d',
  traders: '#e08a45',
  explorersPirates: '#2fc4a4',
} as const;

export const RULE_SETS: { name: string; color: string }[] = [
  { name: 'Base game', color: RULE_SET_COLORS.base },
  { name: 'Seafarers', color: RULE_SET_COLORS.seafarers },
  { name: 'Cities & Knights', color: RULE_SET_COLORS.citiesKnights },
  { name: 'Traders & Barbarians', color: RULE_SET_COLORS.traders },
  { name: 'Explorers & Pirates', color: RULE_SET_COLORS.explorersPirates },
];
