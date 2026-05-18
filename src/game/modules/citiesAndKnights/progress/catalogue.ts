import type { ImprovementTrack, ProgressCardKind } from '../../../types';
import { shuffle } from '../../../rng';

// Card counts per deck (rulebook p.13-15). Sum = 18 per deck × 3 = 54 total.
export const PROGRESS_DECK_DEFINITIONS: Record<ImprovementTrack, Array<{ kind: ProgressCardKind; n: number }>> = {
  science: [
    { kind: 'alchemy', n: 2 },
    { kind: 'crane', n: 2 },
    { kind: 'engineering', n: 1 },
    { kind: 'invention', n: 2 },
    { kind: 'irrigation', n: 2 },
    { kind: 'medicine', n: 2 },
    { kind: 'mining', n: 2 },
    { kind: 'progressRoadBuilding', n: 2 },
    { kind: 'smithing', n: 2 },
    { kind: 'printing', n: 1 },
  ],
  trade: [
    { kind: 'commercialHarborCard', n: 2 },
    { kind: 'guildDues', n: 2 },
    { kind: 'merchantCard', n: 6 },
    { kind: 'merchantFleet', n: 2 },
    { kind: 'resourceMonopoly', n: 4 },
    { kind: 'tradeMonopoly', n: 2 },
  ],
  politics: [
    { kind: 'diplomacy', n: 2 },
    { kind: 'encouragement', n: 2 },
    { kind: 'espionage', n: 3 },
    { kind: 'intrigue', n: 2 },
    { kind: 'sabotage', n: 2 },
    { kind: 'taxation', n: 2 },
    { kind: 'treason', n: 2 },
    { kind: 'constitution', n: 1 },
    { kind: 'wedding', n: 2 },
  ],
};

// Cards that are revealed immediately on draw (rulebook p.10 "place VP cards
// face-up in your player area, even if it is not your turn"). They do not
// count toward the 4-card hand limit and cannot be stolen with Espionage.
export const VP_PROGRESS_CARDS: Set<ProgressCardKind> = new Set([
  'printing',
  'constitution',
]);

// Build the three decks, expanding the counts, then shuffle each.
// Threads an RNG state through so callers can keep the seeded RNG
// deterministic.
export function shuffleProgressDecks(
  rng: number,
): { decks: Record<ImprovementTrack, ProgressCardKind[]>; rng: number } {
  let s = rng;
  const out: Record<ImprovementTrack, ProgressCardKind[]> = {
    science: [],
    trade: [],
    politics: [],
  };
  for (const track of ['science', 'trade', 'politics'] as ImprovementTrack[]) {
    const flat: ProgressCardKind[] = [];
    for (const { kind, n } of PROGRESS_DECK_DEFINITIONS[track]) {
      for (let i = 0; i < n; i++) flat.push(kind);
    }
    const [shuffled, newRng] = shuffle(s, flat);
    out[track] = shuffled;
    s = newRng;
  }
  return { decks: out, rng: s };
}

// Pretty display info — used by the UI and rulebook. Keep titles short so
// they fit in the progress-card chip without truncation.
export const PROGRESS_CARD_LABEL: Record<ProgressCardKind, string> = {
  // Science
  alchemy: 'Alchemy',
  crane: 'Crane',
  engineering: 'Engineering',
  invention: 'Invention',
  irrigation: 'Irrigation',
  medicine: 'Medicine',
  mining: 'Mining',
  progressRoadBuilding: 'Road Building',
  smithing: 'Smithing',
  printing: 'Printing (VP)',
  // Trade
  commercialHarborCard: 'Commercial Harbor',
  guildDues: 'Guild Dues',
  merchantCard: 'Merchant',
  merchantFleet: 'Merchant Fleet',
  resourceMonopoly: 'Resource Monopoly',
  tradeMonopoly: 'Trade Monopoly',
  // Politics
  diplomacy: 'Diplomacy',
  encouragement: 'Encouragement',
  espionage: 'Espionage',
  intrigue: 'Intrigue',
  sabotage: 'Sabotage',
  taxation: 'Taxation',
  treason: 'Treason',
  constitution: 'Constitution (VP)',
  wedding: 'Wedding',
};

// Card descriptions for tooltips and the rulebook reference page.
export const PROGRESS_CARD_DESCRIPTION: Record<ProgressCardKind, string> = {
  alchemy: 'Before rolling, set the two production dice to any values you want.',
  crane: "Build your next city improvement for 1 fewer commodity.",
  engineering: 'Build 1 city wall at no cost.',
  invention: 'Swap two number tokens (not 2, 6, 8, or 12). Robber stays put.',
  irrigation: 'Take 2 wheat for each wheat hex adjacent to one of your buildings.',
  medicine: 'Upgrade one settlement to a city for 1 wheat + 2 ore.',
  mining: 'Take 2 ore for each ore hex adjacent to one of your buildings.',
  progressRoadBuilding: 'Build 2 roads at no cost.',
  smithing: 'Promote up to 2 of your knights at no cost.',
  printing: 'Worth 1 victory point. Play immediately into your player area.',
  commercialHarborCard: "Offer each opponent one resource for 1 commodity of their choice.",
  guildDues: 'Take 2 cards from the hand of a player with more VPs than you.',
  merchantCard: "Place the merchant adjacent to one of your buildings. 1 VP and 2:1 on that hex's resource.",
  merchantFleet: 'Pick a resource or commodity. 2:1 bank trades for the rest of this turn.',
  resourceMonopoly: 'Name a resource. Each player gives you 2 of it (or 1 if that\'s all they have).',
  tradeMonopoly: 'Name a commodity. Each player gives you 1 of it.',
  diplomacy: "Remove an opponent's open road, or one of your own (then build a free road).",
  encouragement: 'Activate all your knights at no cost.',
  espionage: "Look at another player's progress cards and take one (not VP).",
  intrigue: 'Displace an opposing knight without using one of yours.',
  sabotage: 'Every player with as many or more VPs as you discards half their hand.',
  taxation: 'Move the robber and steal one card from EVERY player with a building on that hex.',
  treason: "Force an opponent to remove a knight; place one of yours of equal or lower strength.",
  constitution: 'Worth 1 victory point. Play immediately into your player area.',
  wedding: 'Each player with more VPs than you gives you 2 cards of their choice.',
};
