import type {
  CommodityGood,
  PlayerId,
  TbDevCard,
  TradersBarbariansState,
} from '../../../types';
import { shuffle } from '../../../rng';
import type { TradersBarbariansBoardSetup } from './board';
import { TB_DECK_COUNTS, TB_LOCATION_NEEDS, TB_LOCATION_STACK } from './constants';

// Setup: shuffle each location's 12 tokens face down next to it and the
// scenario's 25 development cards. Wagons go on the board with each
// player's setup city (see hooks.ts).
export function initialTradersBarbariansState(
  setup: TradersBarbariansBoardSetup,
  playerIds: PlayerId[],
  rngState: number,
): [TradersBarbariansState, number] {
  let rng = rngState;
  const locations = setup.locations.map((loc) => {
    const tokens: CommodityGood[] = [];
    for (const [good, n] of Object.entries(TB_LOCATION_STACK[loc.id]) as Array<[CommodityGood, number]>) {
      for (let i = 0; i < n; i++) tokens.push(good);
    }
    let stack: CommodityGood[];
    [stack, rng] = shuffle(rng, tokens);
    return { ...loc, stack, needs: [...TB_LOCATION_NEEDS[loc.id]] };
  });
  const cards: TbDevCard[] = [];
  for (const [card, n] of Object.entries(TB_DECK_COUNTS) as Array<[TbDevCard, number]>) {
    for (let i = 0; i < n; i++) cards.push(card);
  }
  let deck: TbDevCard[];
  [deck, rng] = shuffle(rng, cards);
  return [
    {
      locations,
      barbarians: [...setup.barbarians],
      wagons: {},
      deck,
      swiftJourney: Object.fromEntries(playerIds.map((id) => [id, { unplayed: 0, boughtThisTurn: 0 }])),
    },
    rng,
  ];
}
