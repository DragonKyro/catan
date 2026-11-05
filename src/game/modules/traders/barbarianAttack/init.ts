import type { BarbarianAttackState, HexId, PlayerId } from '../../../types';
import { shuffle } from '../../../rng';
import { BARBARIAN_TOTAL, BARBARIAN_TOTAL_5_6 } from '../constants';
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
  // T&B 5-6 adds 12 barbarians (48 in all).
  const total = playerIds.length >= 5 ? BARBARIAN_TOTAL_5_6 : BARBARIAN_TOTAL;
  return [
    {
      barbarians,
      supply: total - setup.startBarbarians.length,
      coastalHexes: setup.coastalHexes,
      castleHex: setup.castleHex,
      ...(setup.castleHexes ? { castleHexes: setup.castleHexes } : {}),
      knights: {},
      prisoners: Object.fromEntries(playerIds.map((id) => [id, 0])),
      deck,
      discard: [],
    },
    rng,
  ];
}
