import type { GameState, PlayerId } from '@/game/types';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { BARBARIAN_TRACK_LENGTH } from '@/game/modules/citiesAndKnights/constants';
import {
  barbarianStrength,
  defenderStrengthByPlayer,
} from '@/game/modules/citiesAndKnights/barbarian';
import { vertexHasMetropolis } from '@/game/modules/citiesAndKnights/improvements/state';
import { playerById } from './common';

// How the next barbarian attack looks from one seat's point of view. Every
// number here is public: ship position, cities on the board, knights.
export interface BarbarianOutlook {
  // Barbarian (ship) faces still needed before the attack (1..7).
  stepsLeft: number;
  // Chance the attack resolves before this seat's next Action phase: the
  // other seats' rolls plus our own next roll (each roll moves the ship
  // with probability 1/2).
  pAttackSoon: number;
  // Same over the next two rounds.
  pAttackTwoRounds: number;
  // True when that chance is high enough to stand knights up now
  // (activation is cheap; a pillaged city is not).
  near: boolean;
  // True when the attack is likely within two rounds: recruit and keep
  // wheat for the activation.
  prepare: boolean;
  barbarianStrength: number;
  // Sum of every seat's ACTIVE knight strength (the defence).
  totalDefense: number;
  myActive: number;
  // Active + inactive strength on the board.
  myTotal: number;
  // Strength we could add by standing up our inactive knights.
  myInactive: number;
  // Our cities without a metropolis (the ones the barbarians can pillage).
  pillageable: number;
  // Lowest active strength among the OTHER seats that could lose a city.
  // Infinity when no other seat has a pillageable city.
  minOtherAtRisk: number;
  // Highest active strength among the other seats.
  maxOther: number;
}

// P(X >= k) for X ~ Binomial(n, 1/2).
function binomialTail(n: number, k: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let total = 0;
  let c = 1; // C(n, i)
  for (let i = 0; i <= n; i++) {
    if (i >= k) total += c;
    c = (c * (n - i)) / (i + 1);
  }
  return total / 2 ** n;
}

export function pillageableCities(state: GameState, playerId: PlayerId): number {
  const p = playerById(state, playerId);
  return p.cities.filter((v) => !vertexHasMetropolis(state, v)).length;
}

// `extraCities` = cities we're about to build (counted as ours and as
// barbarian strength) — so the defence check runs BEFORE the city that would
// need defending.
export function barbarianOutlook(
  state: GameState,
  playerId: PlayerId,
  extraCities = 0,
): BarbarianOutlook {
  const position = state.barbarian?.position ?? 0;
  const stepsLeft = Math.max(1, BARBARIAN_TRACK_LENGTH - position);
  const rolls = Math.max(2, state.players.length);
  const pAttackSoon = binomialTail(rolls, stepsLeft);
  const pAttackTwoRounds = binomialTail(2 * rolls, stepsLeft);
  const active = defenderStrengthByPlayer(state);
  let myTotal = 0;
  for (const k of Object.values(state.knights ?? {})) {
    if (k.playerId === playerId) myTotal += k.strength;
  }
  const myActive = active[playerId] ?? 0;
  let minOtherAtRisk = Infinity;
  let maxOther = 0;
  let totalDefense = 0;
  for (const p of state.players) {
    const s = active[p.id] ?? 0;
    totalDefense += s;
    if (p.id === playerId) continue;
    maxOther = Math.max(maxOther, s);
    if (pillageableCities(state, p.id) > 0) minOtherAtRisk = Math.min(minOtherAtRisk, s);
  }
  return {
    stepsLeft,
    pAttackSoon,
    pAttackTwoRounds,
    near: pAttackSoon >= 0.12,
    prepare: pAttackTwoRounds >= 0.3,
    barbarianStrength: barbarianStrength(state) + extraCities,
    totalDefense,
    myActive,
    myTotal,
    myInactive: myTotal - myActive,
    pillageable: pillageableCities(state, playerId) + extraCities,
    minOtherAtRisk,
    maxOther,
  };
}

// The active strength that keeps our cities safe if the attack came now:
// whichever is cheaper of (a) strictly above the weakest other seat that
// could be pillaged, so we're not the one losing a city, or (b) enough for
// the island to hold, so nobody is pillaged. 0 when we have nothing to lose.
export function safeActiveStrength(o: BarbarianOutlook): number {
  if (o.pillageable === 0) return 0;
  const notLowest = Number.isFinite(o.minOtherAtRisk) ? o.minOtherAtRisk + 1 : Infinity;
  const islandHolds = Math.max(0, o.barbarianStrength - (o.totalDefense - o.myActive));
  return Math.min(notLowest, islandHolds);
}

// Strength that would make us the single top defender (the Defender of
// Catan VP) — only meaningful when the island holds.
export function defenderVpStrength(o: BarbarianOutlook): number {
  return o.maxOther + 1;
}

// A city we can afford right now (the tree builds it next): the defence
// check counts it, so knights come before a city the barbarians would take.
export function cityPending(state: GameState, playerId: PlayerId): boolean {
  const p = playerById(state, playerId);
  if (p.settlements.length === 0 || p.cities.length >= 4) return false;
  return canAfford(p.resources, state.medicineActive ? COSTS.cityMedicine : COSTS.city);
}

// Active strength we want before the attack: safe from pillage (above the
// weakest other city-holder, or enough for the island to hold), and at least
// one point per city we hold so the island tends to hold.
export function defenseTarget(o: BarbarianOutlook, cities: number): number {
  if (o.pillageable === 0) return 0;
  return Math.max(safeActiveStrength(o), Math.min(cities, 4));
}
