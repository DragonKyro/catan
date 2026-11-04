import type {
  BarbarianAttackState,
  BarbarianCardType,
  BarbarianTreasonMove,
  BuyDevCardAction,
  EdgeId,
  GameState,
  HexId,
  PlayerId,
  ResolveBarbarianCardAction,
} from '../../../types';
import { COSTS } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addResources, canAfford, subtractResources } from '../../../resources';
import { shuffle } from '../../../rng';
import {
  BARBARIAN_DECK_COUNTS,
  BARBARIAN_TREASON_GOLD,
  BARBARIANS_TO_CONQUER,
} from '../constants';
import {
  isBarbarianAttack,
  patchBarbarianAttack,
  pushBarbarianEvents,
  refreshBarbarianPorts,
  withBarbarians,
  type BarbarianAttackGame,
} from './state';
import { freeCastleEdges, freeKnightEdges, knightsInSupply } from './knights';

// Barbarian Attack development cards (rulebook pp.15, 17). The scenario
// replaces the base deck with 26 cards of its own: 4 Capture, 14 Knighthood,
// 4 Swift Knight, 4 Treason. A card is bought at the normal cost and played
// at once; any choice it needs is made in the 'barbarianCard' phase with a
// `resolveBarbarianCard` action. Played cards go to a discard pile that is
// reshuffled (seeded RNG) when the deck runs out.

export function buildBarbarianDeck(): BarbarianCardType[] {
  const out: BarbarianCardType[] = [];
  for (const [card, n] of Object.entries(BARBARIAN_DECK_COUNTS)) {
    for (let i = 0; i < n; i++) out.push(card as BarbarianCardType);
  }
  return out;
}

export function barbarianCardLabel(card: BarbarianCardType): string {
  switch (card) {
    case 'capture':
      return 'Capture';
    case 'knighthood':
      return 'Knighthood';
    case 'swiftKnight':
      return 'Swift Knight';
    case 'treason':
      return 'Treason';
  }
}

// ---------------------------------------------------------------- buy ---

export function canBuyBarbarianCard(state: GameState, playerId: PlayerId): boolean {
  const ba = state.barbarianAttack;
  if (!ba || state.phase !== 'main') return false;
  if (ba.deck.length + ba.discard.length === 0) return false;
  return canAfford(getPlayer(state, playerId).resources, COSTS.devCard);
}

export function handleBuyBarbarianCard(state: GameState, action: BuyDevCardAction): GameState {
  if (!isBarbarianAttack(state)) throw new Error('Barbarian Attack is not active');
  if (state.phase !== 'main') throw new Error(`Cannot buy a card in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (!canAfford(player.resources, COSTS.devCard)) throw new Error('Cannot afford a development card');
  if (state.barbarianAttack.deck.length + state.barbarianAttack.discard.length === 0) {
    throw new Error('No development cards left');
  }

  let next: BarbarianAttackGame = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, COSTS.devCard),
  })) as BarbarianAttackGame;
  next = { ...next, bank: addResources(next.bank, COSTS.devCard) };

  // Draw. "If there are no barbarians on the coastal hexes, discard this
  // [Capture] card and draw a new one."
  let rng = next.rngState;
  let ba = next.barbarianAttack;
  let card: BarbarianCardType | null = null;
  let skippedCaptures = 0;
  const limit = ba.deck.length + ba.discard.length;
  for (let i = 0; i < limit; i++) {
    let drawn: BarbarianCardType | null;
    [drawn, ba, rng] = drawCard(ba, rng);
    if (!drawn) break;
    if (drawn === 'capture' && captureHexes({ ...next, barbarianAttack: ba }).length === 0) {
      ba = { ...ba, discard: [...ba.discard, drawn] };
      skippedCaptures++;
      continue;
    }
    card = drawn;
    break;
  }
  next = { ...next, rngState: rng, barbarianAttack: ba };
  if (!card) {
    // Only Capture cards left and nothing to capture.
    return next;
  }

  const usable = cardHasAChoice(next, action.playerId, card);
  next = pushBarbarianEvents(next, [
    { kind: 'cardDrawn', playerId: action.playerId, card, skippedCaptures, wasted: !usable && card !== 'treason' },
  ]);
  if (!usable) {
    // Treason with no legal barbarian move still pays its gold; a knight
    // card with no knight left (or no free castle edge) does nothing.
    if (card === 'treason') next = giveGold(next, action.playerId, BARBARIAN_TREASON_GOLD);
    return patchBarbarianAttack(next, (b) => ({ ...b, discard: [...b.discard, card] }));
  }
  return {
    ...patchBarbarianAttack(next, (b) => ({ ...b, pendingCard: { playerId: action.playerId, card } })),
    phase: 'barbarianCard',
  };
}

function drawCard(
  ba: BarbarianAttackState,
  rng: number,
): [BarbarianCardType | null, BarbarianAttackState, number] {
  let deck = ba.deck;
  let discard = ba.discard;
  if (deck.length === 0) {
    if (discard.length === 0) return [null, ba, rng];
    [deck, rng] = shuffle(rng, discard);
    discard = [];
  }
  const card = deck[deck.length - 1]!;
  return [card, { ...ba, deck: deck.slice(0, -1), discard }, rng];
}

function cardHasAChoice(state: GameState, playerId: PlayerId, card: BarbarianCardType): boolean {
  switch (card) {
    case 'capture':
      return captureHexes(state).length > 0;
    case 'knighthood':
      return knightsInSupply(state, playerId) > 0 && freeCastleEdges(state).length > 0;
    case 'swiftKnight':
      return knightsInSupply(state, playerId) > 0 && freeKnightEdges(state).length > 0;
    case 'treason':
      return treasonMovePossible(state, [], []);
  }
}

// ------------------------------------------------------------- choices ---

// Capture: a coastal hex with at least one barbarian.
export function captureHexes(state: GameState): HexId[] {
  const ba = state.barbarianAttack;
  if (!ba) return [];
  return ba.coastalHexes.filter((h) => (ba.barbarians[h] ?? 0) > 0);
}

// Knighthood: a free castle edge. Swift Knight: any edge without a knight.
export function cardKnightEdges(state: GameState, card: BarbarianCardType): EdgeId[] {
  if (card === 'knighthood') return freeCastleEdges(state);
  if (card === 'swiftKnight') return freeKnightEdges(state);
  return [];
}

// Treason sources right now: coastal hexes holding a barbarian that aren't
// already a source or a destination of this Treason. When there are none,
// the barbarian comes from the supply (`null`).
export function treasonSources(
  state: GameState,
  sources: HexId[],
  dests: HexId[],
): Array<HexId | null> {
  const ba = state.barbarianAttack;
  if (!ba) return [];
  const board = ba.coastalHexes.filter(
    (h) => (ba.barbarians[h] ?? 0) > 0 && !sources.includes(h) && !dests.includes(h),
  );
  if (board.length > 0) return board;
  return ba.supply > 0 ? [null] : [];
}

// Treason destinations: "two other unconquered coastal hexes" — not one of
// the sources, not already a destination, fewer than 3 barbarians.
export function treasonDestinations(
  state: GameState,
  sources: Array<HexId | null>,
  dests: HexId[],
): HexId[] {
  const ba = state.barbarianAttack;
  if (!ba) return [];
  return ba.coastalHexes.filter(
    (h) =>
      (ba.barbarians[h] ?? 0) < BARBARIANS_TO_CONQUER &&
      !sources.includes(h) &&
      !dests.includes(h),
  );
}

function treasonMovePossible(state: GameState, sources: HexId[], dests: HexId[]): boolean {
  for (const from of treasonSources(state, sources, dests)) {
    const s = from ? [...sources, from] : sources;
    if (treasonDestinations(state, s, dests).length > 0) return true;
  }
  return false;
}

// Validate a Treason's moves, applying them one after another. Returns the
// state after the moves (barbarians moved, conquest updated) or throws.
// Two moves are required unless no further legal move exists.
export function applyTreasonMoves(
  state: BarbarianAttackGame,
  moves: BarbarianTreasonMove[],
): BarbarianAttackGame {
  if (moves.length > 2) throw new Error('Treason moves exactly 2 barbarians');
  const allSources = moves.map((m) => m.from).filter((h): h is HexId => h !== null);
  if (new Set(allSources).size !== allSources.length) {
    throw new Error('Treason: the barbarians must come from two different hexes');
  }
  let next = state;
  const sources: HexId[] = [];
  const dests: HexId[] = [];
  for (const m of moves) {
    // The other move's source counts as taken already, so "from the
    // supply" is legal exactly when no other hex could give a barbarian.
    const legalFrom = treasonSources(
      next,
      allSources.filter((h) => h !== m.from),
      dests,
    );
    if (!legalFrom.includes(m.from)) {
      throw new Error(
        m.from === null
          ? 'Treason: take a barbarian from the board while one is there'
          : 'Treason: no barbarian to move from that hex',
      );
    }
    const legalTo = treasonDestinations(next, [...allSources, ...(m.from ? [m.from] : [])], dests);
    if (!legalTo.includes(m.to)) {
      throw new Error('Treason: barbarians must move to another unconquered coastal hex');
    }
    next = patchBarbarianAttack(next, (ba) => {
      let b = ba;
      if (m.from === null) b = { ...b, supply: b.supply - 1 };
      else b = withBarbarians(b, m.from, -1);
      return withBarbarians(b, m.to, 1);
    });
    if (m.from) sources.push(m.from);
    dests.push(m.to);
  }
  if (moves.length < 2 && treasonMovePossible(next, sources, dests)) {
    throw new Error('Treason moves 2 barbarians');
  }
  return next;
}

// ------------------------------------------------------------- resolve ---

export function handleResolveBarbarianCard(
  state: GameState,
  action: ResolveBarbarianCardAction,
): GameState {
  if (!isBarbarianAttack(state)) throw new Error('Barbarian Attack is not active');
  if (state.phase !== 'barbarianCard') throw new Error(`No card to play in phase ${state.phase}`);
  const pending = state.barbarianAttack.pendingCard;
  if (!pending) throw new Error('No card to play');
  if (action.playerId !== pending.playerId) throw new Error('Not your card');
  const pid = action.playerId;

  let next: BarbarianAttackGame = state;
  switch (pending.card) {
    case 'capture': {
      const hex = action.hex;
      if (!hex || !captureHexes(state).includes(hex)) {
        throw new Error('Capture: pick a coastal hex with a barbarian');
      }
      next = patchBarbarianAttack(next, (ba) => ({
        ...withBarbarians(ba, hex, -1),
        prisoners: { ...ba.prisoners, [pid]: (ba.prisoners[pid] ?? 0) + 1 },
      }));
      break;
    }
    case 'knighthood':
    case 'swiftKnight': {
      const edge = action.edge;
      if (!edge || !cardKnightEdges(state, pending.card).includes(edge)) {
        throw new Error(
          pending.card === 'knighthood'
            ? 'Knighthood: pick a castle edge without a knight'
            : 'Swift Knight: pick an edge without a knight',
        );
      }
      if (knightsInSupply(state, pid) <= 0) throw new Error('No knights left');
      next = patchBarbarianAttack(next, (ba) => ({
        ...ba,
        knights: { ...ba.knights, [edge]: pid },
      }));
      break;
    }
    case 'treason': {
      next = applyTreasonMoves(next, action.moves ?? []);
      next = giveGold(next, pid, BARBARIAN_TREASON_GOLD);
      break;
    }
  }
  next = patchBarbarianAttack(next, (ba) => ({
    ...ba,
    pendingCard: undefined,
    discard: [...ba.discard, pending.card],
  }));
  return refreshBarbarianPorts({ ...next, phase: 'main' });
}

function giveGold<S extends GameState>(state: S, playerId: PlayerId, n: number): S {
  return updatePlayer(state, playerId, (p) => ({ ...p, gold: (p.gold ?? 0) + n })) as S;
}
