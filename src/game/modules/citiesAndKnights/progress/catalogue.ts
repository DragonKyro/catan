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

const DECK_OF: Record<ProgressCardKind, ImprovementTrack> = Object.fromEntries(
  (Object.keys(PROGRESS_DECK_DEFINITIONS) as ImprovementTrack[]).flatMap((track) =>
    PROGRESS_DECK_DEFINITIONS[track].map(({ kind }) => [kind, track] as const),
  ),
) as Record<ProgressCardKind, ImprovementTrack>;

// Which deck (and so which card back colour) a card belongs to.
export function progressCardDeck(card: ProgressCardKind): ImprovementTrack {
  return DECK_OF[card];
}

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

// Card texts (2025 rulebook p.13-16), for tooltips, the card dialog and the
// rulebook reference page.
export const PROGRESS_CARD_DESCRIPTION: Record<ProgressCardKind, string> = {
  alchemy:
    'Play before you roll: set the two production dice to the result you want, then roll the event die as normal.',
  crane: 'Build 1 city improvement for 1 commodity less than normal (one Crane per improvement).',
  engineering: 'Build 1 city wall at no cost.',
  invention:
    'Swap 2 number discs of your choice (not 2, 6, 8 or 12). The robber does not move with a disc.',
  irrigation: 'Take 2 wheat for each fields hex next to at least one of your buildings.',
  medicine: 'Upgrade one of your settlements to a city for 1 wheat and 2 ore.',
  mining: 'Take 2 ore for each mountains hex next to at least one of your buildings.',
  progressRoadBuilding: 'Build 2 roads at no cost.',
  smithing: 'Promote up to 2 of your knights at no cost (each knight once per turn).',
  printing: 'Victory Point: 1 VP, placed face up as soon as it is drawn.',
  commercialHarborCard:
    'This turn, offer each other player one of your resources; each must give you a commodity of their choice for it.',
  guildDues:
    'Look at the hand of a player with more VPs than you and take any 2 resource/commodity cards from it.',
  merchantCard:
    "Take the merchant and put it on a land hex next to one of your buildings: 1 VP, and 2:1 trades in that hex's resource.",
  merchantFleet:
    'Name a resource or commodity: for the rest of this turn you may trade it 2:1 with the supply.',
  resourceMonopoly:
    'Name a resource: each player gives you 2 of it (or 1 if that is all they have).',
  tradeMonopoly: 'Name a commodity: each player gives you 1 of it if they have it.',
  diplomacy:
    "Remove an open road. Another player's goes back to their supply; if it was yours, build 1 road for free.",
  encouragement: 'Activate all your knights at no cost.',
  espionage: "Look at another player's progress cards and you may take 1 (not a VP card).",
  intrigue:
    'Displace an opposing knight that stands on one of your routes, without using a knight of your own.',
  sabotage:
    'Each player with as many or more VPs than you discards half their resource and commodity cards (rounded down).',
  taxation:
    'Move the robber and steal 1 random card from each player with a building on its new hex. Only after the first barbarian attack.',
  treason:
    'Another player removes one of their knights; you may place one of yours of the same strength or lower, with its status.',
  constitution: 'Victory Point: 1 VP, placed face up as soon as it is drawn.',
  wedding:
    'Each player with more VPs than you gives you 2 resource/commodity cards of their choice.',
};
