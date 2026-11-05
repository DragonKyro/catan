import type {
  BarbarianExpelResult,
  GameState,
  HexId,
  PlayerId,
} from '../../../types';
import { updatePlayer } from '../../../helpers';
import { rollDice, rollDie } from '../../../rng';
import { BARBARIAN_CONSOLATION_GOLD, BARBARIAN_KNIGHT_LOSS_GOLD } from '../constants';
import {
  hexEdgeIds,
  isBarbarianAttack,
  patchBarbarianAttack,
  pushBarbarianEvents,
  refreshBarbarianPorts,
  type BarbarianAttackGame,
} from './state';
import { dieToEdgeColor, edgeColor, knightsOnHex } from './knights';

// "Expel barbarians" (rulebook p.18), the last step of every turn. Starting
// with the coastal 4 next to the castle and going clockwise, each coastal hex
// with at least 1 barbarian and more knights on its edges than barbarians is
// a victory:
//   1. The barbarians are taken prisoner by the involved players (those with
//      knights on the hex's edges) — see `distributePrisoners`.
//   2. A conquered hex is liberated (all its barbarians are gone).
//   3. Knight losses: roll a die; every involved knight on an edge of the
//      rolled colour's orientation goes back to its owner, who takes 3 gold.
// Hexes are checked one after another, so a knight lost on one hex no longer
// counts on the next. All dice come from the seeded `state.rngState`.
export function expelBarbarians(state: GameState, activePlayerId: PlayerId): GameState {
  if (!isBarbarianAttack(state)) return state;
  let next: BarbarianAttackGame = state;
  const results: BarbarianExpelResult[] = [];
  for (const hex of state.barbarianAttack.coastalHexes) {
    const barbarians = next.barbarianAttack.barbarians[hex] ?? 0;
    if (barbarians < 1) continue;
    const knights = knightsOnHex(next, hex);
    let total = 0;
    for (const n of Object.values(knights)) total += n;
    if (total <= barbarians) continue;
    let result: BarbarianExpelResult;
    [next, result] = resolveVictory(next, hex, barbarians, knights, activePlayerId);
    results.push(result);
  }
  if (results.length === 0) return next;
  next = pushBarbarianEvents(next, [{ kind: 'expel', playerId: activePlayerId, results }]);
  return refreshBarbarianPorts(next);
}

function resolveVictory(
  state: BarbarianAttackGame,
  hex: HexId,
  barbarians: number,
  knights: Record<PlayerId, number>,
  activePlayerId: PlayerId,
): [BarbarianAttackGame, BarbarianExpelResult] {
  // Involved players in turn order from the active player (a stable order
  // for the tie-break dice).
  const order = state.playerOrder;
  const start = Math.max(0, order.indexOf(activePlayerId));
  const involved = [...order.slice(start), ...order.slice(0, start)].filter(
    (pid) => (knights[pid] ?? 0) > 0,
  );
  let rng = state.rngState;
  const rolls: Record<PlayerId, number[]> = {};
  let prisoners: Record<PlayerId, number>;
  let consolation: PlayerId[];
  [prisoners, consolation, rng] = distributePrisoners(involved, knights, barbarians, rng, rolls);

  let next: BarbarianAttackGame = patchBarbarianAttack(state, (ba) => {
    const total = { ...ba.prisoners };
    for (const [pid, n] of Object.entries(prisoners)) total[pid] = (total[pid] ?? 0) + n;
    const onHex = { ...ba.barbarians };
    delete onHex[hex];
    return { ...ba, barbarians: onHex, prisoners: total };
  });
  for (const pid of consolation) next = addGold(next, pid, BARBARIAN_CONSOLATION_GOLD);

  // Knight losses.
  let lossDie: number;
  [lossDie, rng] = rollDie(rng);
  const lossColor = dieToEdgeColor(lossDie);
  const knightsLost: Record<PlayerId, number> = {};
  const remaining = { ...next.barbarianAttack.knights };
  for (const e of hexEdgeIds(next, hex)) {
    const owner = remaining[e];
    if (!owner || edgeColor(next, e) !== lossColor) continue;
    delete remaining[e];
    knightsLost[owner] = (knightsLost[owner] ?? 0) + 1;
  }
  next = patchBarbarianAttack(next, (ba) => ({ ...ba, knights: remaining }));
  for (const [pid, n] of Object.entries(knightsLost)) {
    next = addGold(next, pid, n * BARBARIAN_KNIGHT_LOSS_GOLD);
  }
  next = { ...next, rngState: rng };

  return [
    next,
    {
      hex,
      barbarians,
      knights: Object.fromEntries(involved.map((pid) => [pid, knights[pid]!])),
      prisoners,
      consolation,
      ...(Object.keys(rolls).length > 0 ? { rolls } : {}),
      liberated: barbarians >= 3,
      lossDie,
      lossColor,
      knightsLost,
    },
  ];
}

// Prisoner distribution (rulebook p.18):
//   - one involved player: they take every prisoner;
//   - otherwise each involved player takes 1. A prisoner left over goes to
//     the player with the most knights there; on a tie the tied players roll
//     and the loser takes 3 gold instead;
//   - too few prisoners for everyone: everybody rolls, prisoners go out from
//     the highest roll down (ties re-rolled), and each involved player left
//     without one takes 3 gold.
export function distributePrisoners(
  involved: PlayerId[],
  knights: Record<PlayerId, number>,
  barbarians: number,
  rng: number,
  rolls: Record<PlayerId, number[]>,
): [Record<PlayerId, number>, PlayerId[], number] {
  const prisoners: Record<PlayerId, number> = {};
  const consolation: PlayerId[] = [];
  if (involved.length === 1) {
    prisoners[involved[0]!] = barbarians;
    return [prisoners, consolation, rng];
  }
  if (barbarians >= involved.length) {
    for (const pid of involved) prisoners[pid] = 1;
    let left = barbarians - involved.length;
    while (left > 0) {
      const most = Math.max(...involved.map((pid) => knights[pid] ?? 0));
      const top = involved.filter((pid) => (knights[pid] ?? 0) === most);
      let winner = top[0]!;
      if (top.length > 1) {
        let ranked: PlayerId[];
        [ranked, rng] = rollOff(top, rng, rolls);
        winner = ranked[0]!;
        for (const pid of ranked.slice(1)) consolation.push(pid);
      }
      prisoners[winner] = (prisoners[winner] ?? 0) + 1;
      left--;
    }
    return [prisoners, consolation, rng];
  }
  let ranked: PlayerId[];
  [ranked, rng] = rollOff(involved, rng, rolls);
  ranked.forEach((pid, i) => {
    if (i < barbarians) prisoners[pid] = 1;
    else consolation.push(pid);
  });
  return [prisoners, consolation, rng];
}

// Everyone in `ids` rolls 2 dice; highest first, tied groups re-roll among
// themselves. Every roll is recorded in `rolls`.
function rollOff(
  ids: PlayerId[],
  rng: number,
  rolls: Record<PlayerId, number[]>,
): [PlayerId[], number] {
  const score = new Map<PlayerId, number>();
  for (const pid of ids) {
    let dice: [number, number];
    [dice, rng] = rollDice(rng);
    const s = dice[0] + dice[1];
    score.set(pid, s);
    (rolls[pid] ??= []).push(s);
  }
  const values = [...new Set(score.values())].sort((a, b) => b - a);
  const out: PlayerId[] = [];
  for (const v of values) {
    const group = ids.filter((pid) => score.get(pid) === v);
    if (group.length === 1) {
      out.push(group[0]!);
    } else {
      let sub: PlayerId[];
      [sub, rng] = rollOff(group, rng, rolls);
      out.push(...sub);
    }
  }
  return [out, rng];
}

function addGold(state: BarbarianAttackGame, pid: PlayerId, n: number): BarbarianAttackGame {
  return updatePlayer(state, pid, (p) => ({ ...p, gold: (p.gold ?? 0) + n })) as BarbarianAttackGame;
}
