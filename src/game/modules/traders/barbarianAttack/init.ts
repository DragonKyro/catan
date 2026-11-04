import type { BarbarianAttackState, HexId, PlayerId } from '../../../types';
import { shuffle } from '../../../rng';
import { BARBARIAN_TOTAL } from '../constants';
import { buildBarbarianDeck } from './cards';
import type { BarbarianBoardSetup } from './board';

export function initialBarbarianAttackState(
  setup: BarbarianBoardSetup,
  playerIds: PlayerId[],
  rngState: number,
): [BarbarianAttackState, number] {
  const [deck, rng] = shuffle(rngState, buildBarbarianDeck());
  const barbarians: Record<HexId, number> = {};
  for (const h of setup.startBarbarians) barbarians[h] = (barbarians[h] ?? 0) + 1;
  return [
    {
      barbarians,
      supply: BARBARIAN_TOTAL - setup.startBarbarians.length,
      coastalHexes: setup.coastalHexes,
      castleHex: setup.castleHex,
      knights: {},
      prisoners: Object.fromEntries(playerIds.map((id) => [id, 0])),
      deck,
      discard: [],
    },
    rng,
  ];
}
