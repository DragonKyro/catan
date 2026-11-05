import type { BarbarianAttackEvent, GameState, HexId, PlayerId } from '../../../types';
import { rollDice } from '../../../rng';
import { BARBARIANS_TO_CONQUER, BARBARIAN_LANDING_ROLLS } from '../constants';
import {
  isBarbarianAttack,
  pushBarbarianEvents,
  refreshBarbarianPorts,
  withBarbarians,
  type BarbarianAttackGame,
} from './state';

// "Barbarians land on Catan" (rulebook p.16). Each time a player places a
// building (settlement or city) during play, they roll the dice until the
// result isn't 7; one barbarian from the supply lands on the coastal hex with
// that number, unless it already holds 3 (conquered). Then twice more, each
// roll also re-rolled until it differs from the earlier ones. Stops early when
// the supply is empty. The dice come from the seeded `state.rngState`, so
// every peer reduces the same landing.
//
// 5-6 players (T&B 5-6 p. 9): two coastal hexes carry a 5 and two a 9; "when
// a 5 or a 9 is rolled, place barbarians on both corresponding hexes", so a
// landing can bring 3 to 5 barbarians. Each hex gets its own entry in
// `rolls` (same dice), in expel order.
export function resolveBarbarianLanding(state: GameState, playerId: PlayerId): GameState {
  if (!isBarbarianAttack(state)) return state;
  let rng = state.rngState;
  let ba = state.barbarianAttack;
  const used: number[] = [];
  const rolls: Extract<BarbarianAttackEvent, { kind: 'landing' }>['rolls'] = [];
  let supplyEmpty = false;
  for (let i = 0; i < BARBARIAN_LANDING_ROLLS; i++) {
    if (ba.supply <= 0) {
      supplyEmpty = true;
      break;
    }
    let dice: [number, number];
    let total: number;
    do {
      [dice, rng] = rollDice(rng);
      total = dice[0] + dice[1];
    } while (total === 7 || used.includes(total));
    used.push(total);
    for (const hex of coastalHexesWithNumber(state, total)) {
      if (ba.supply <= 0) {
        supplyEmpty = true;
        break;
      }
      const before = ba.barbarians[hex] ?? 0;
      const placed = before < BARBARIANS_TO_CONQUER;
      if (placed) ba = { ...withBarbarians(ba, hex, 1), supply: ba.supply - 1 };
      rolls.push({
        dice,
        hex,
        placed,
        conquered: placed && before + 1 >= BARBARIANS_TO_CONQUER,
      });
    }
  }
  let next: BarbarianAttackGame = { ...state, rngState: rng, barbarianAttack: ba };
  next = pushBarbarianEvents(next, [{ kind: 'landing', playerId, rolls, supplyEmpty }]);
  return refreshBarbarianPorts(next);
}

// Every coastal hex with that number: exactly one at 3-4 players (the coast
// carries 2-6 and 8-12 once each); the 5-6 coast has two 5s and two 9s.
export function coastalHexesWithNumber(state: GameState, n: number): HexId[] {
  const ba = state.barbarianAttack;
  if (!ba) return [];
  return ba.coastalHexes.filter((h) => state.board.hexes[h]?.numberToken === n);
}
