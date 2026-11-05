import type { EventCard, EventCardKind } from '../../../../types';
import { shuffle } from '../../../../rng';

// Catan Event Cards (2025 T&B rulebook p. 4-6): 37 event cards — 36 with a
// number disc and an event, plus New Year.
//
// ASSUMPTION: the rulebook lists the 13 events but doesn't print which
// number each card carries or how many copies of each event there are (the
// card art on p. 5-6 shows no discs). This deck follows the 2-dice odds
// exactly — 1×2, 2×3, 3×4, 4×5, 5×6, 6×7, 5×8, 4×9, 3×10, 2×11, 1×12 — the
// "more consistent distribution of production values" the variant promises.
// The six 7s are Robber Attacks (the event IS "resolve a 7"); the other
// events are spread over the non-7 numbers, the harsher ones (Epidemic,
// Helpful Neighbor) on the 6/8s, with 16 A Beautiful Day cards filling in.
const NUMBERED: Array<[number, EventCardKind[]]> = [
  [2, ['beautifulDay']],
  [3, ['plentifulYear', 'beautifulDay']],
  [4, ['calmSeas', 'tradeAdvantage', 'beautifulDay']],
  [5, ['robberFlees', 'tournament', 'beautifulDay', 'beautifulDay']],
  [6, ['epidemic', 'helpfulNeighbor', 'beautifulDay', 'beautifulDay', 'beautifulDay']],
  [7, ['robberAttacks', 'robberAttacks', 'robberAttacks', 'robberAttacks', 'robberAttacks', 'robberAttacks']],
  [8, ['epidemic', 'helpfulNeighbor', 'beautifulDay', 'beautifulDay', 'beautifulDay']],
  [9, ['robberFlees', 'goodNeighbors', 'beautifulDay', 'beautifulDay']],
  [10, ['calmSeas', 'conflict', 'beautifulDay']],
  [11, ['earthquake', 'beautifulDay']],
  [12, ['beautifulDay']],
];

export const EVENT_CARDS: EventCard[] = NUMBERED.flatMap(([number, kinds]) =>
  kinds.map((kind) => ({ kind, number })),
).map((c, id) => ({ id, ...c }));

export const NEW_YEAR_CARD: EventCard = { id: EVENT_CARDS.length, kind: 'newYear', number: null };

// How many cards sit under New Year (rulebook: deal 5, New Year on top).
const UNDER_NEW_YEAR = 5;

// "Create the event deck": shuffle the 36 numbered cards, deal 5 face down,
// put New Year on them, then the other 31 on top. Index 0 is the top card,
// so New Year is the 6th card from the bottom. Shuffled with the seeded
// state RNG so every peer builds the same deck.
export function buildEventDeck(rng: number): [EventCard[], number] {
  const [shuffled, next] = shuffle(rng, EVENT_CARDS);
  const bottom = shuffled.slice(0, UNDER_NEW_YEAR);
  const top = shuffled.slice(UNDER_NEW_YEAR);
  return [[...top, NEW_YEAR_CARD, ...bottom], next];
}

export const EVENT_CARD_INFO: Record<EventCardKind, { name: string; text: string; icon: string }> = {
  beautifulDay: { name: 'A Beautiful Day', icon: '☀️', text: 'No event. Hexes produce as normal.' },
  calmSeas: {
    name: 'Calm Seas',
    icon: '⚓',
    text: 'The player(s) with the most buildings on harbors take 1 resource of their choice from the supply.',
  },
  conflict: {
    name: 'Conflict',
    icon: '⚔️',
    text: 'The Largest Army holder steals 1 random resource from any player; with no holder, the player with the most Knights played (if only one) may.',
  },
  earthquake: {
    name: 'Earthquake',
    icon: '💥',
    text: 'Everyone damages one of their roads. No new roads until you repair them (1 brick + 1 wood each); no settlements next to a damaged road. Damaged roads still count for the Longest Route.',
  },
  epidemic: {
    name: 'Epidemic',
    icon: '🤒',
    text: 'Cities produce only 1 resource this turn.',
  },
  goodNeighbors: {
    name: 'Good Neighbors',
    icon: '🤝',
    text: 'Everyone gives 1 resource of their choice to the player on their left.',
  },
  helpfulNeighbor: {
    name: 'Helpful Neighbor',
    icon: '🎁',
    text: 'The player(s) with the most VPs give 1 resource of their choice to a player with fewer VPs.',
  },
  newYear: {
    name: 'New Year',
    icon: '🎆',
    text: 'The event deck is rebuilt and the next card is revealed.',
  },
  plentifulYear: {
    name: 'Plentiful Year',
    icon: '🌾',
    text: 'Everyone takes 1 resource of their choice from the supply.',
  },
  robberAttacks: {
    name: 'Robber Attacks',
    icon: '🦹',
    text: 'Resolve a 7: discard half of 8+ cards, then move the robber and steal.',
  },
  robberFlees: {
    name: 'Robber Flees',
    icon: '🏃',
    text: 'The robber goes back to the desert (off the board if there is none). No steal.',
  },
  tournament: {
    name: 'Tournament',
    icon: '🏆',
    text: 'The player(s) with the most Knights played take 1 resource of their choice from the supply.',
  },
  tradeAdvantage: {
    name: 'Trade Advantage',
    icon: '💰',
    text: 'The Longest Route holder steals 1 random resource from any player.',
  },
};
