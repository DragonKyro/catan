import type { EpEvent, EpMission, HexId, PlayerId } from '../../types';
import { rollDie } from '../../rng';
import { addGold } from '../traders/coins/gold';
import { EP_LAIR_GOLD } from './constants';
import { patchEp, trackLength, type EpGame } from './state';

// Mission tracks (Rulebook p. 13): each step of progress moves your marker
// one space; a marker landing on an occupied space goes on top of the stack
// (a later arrival). Markers stop at the track's last space.
export function advanceTrack(
  state: EpGame,
  playerId: PlayerId,
  mission: EpMission,
  steps: number,
): [EpGame, EpEvent | null] {
  const ep = state.explorersPirates;
  const from = ep.tracks[mission][playerId] ?? 0;
  const to = Math.min(trackLength(mission), from + steps);
  if (to === from) return [state, null];
  const seq = ep.trackSeq + 1;
  const next = patchEp(state, (e) => ({
    ...e,
    trackSeq: seq,
    tracks: { ...e.tracks, [mission]: { ...e.tracks[mission], [playerId]: to } },
    arrivals: { ...e.arrivals, [mission]: { ...e.arrivals[mission], [playerId]: seq } },
  }));
  return [next, { kind: 'track', playerId, mission, from, to }];
}

// Players in turn order starting with the active player.
export function fromActivePlayer(state: EpGame): PlayerId[] {
  const n = state.playerOrder.length;
  const start = state.currentPlayerIndex;
  return Array.from({ length: n }, (_, i) => state.playerOrder[(start + i) % n]!);
}

// "Once the active player has finished their Movement phase, the mission
// is resolved": every involved player (a crew on the hex) gets 2 gold and a
// track space, in turn order from the active player. Each then rolls a die
// plus their crews on the hex; the highest is the hero (ties: more crews,
// then the tied players roll again). The hero moves one more space and
// takes 1 crew back to the supply. The lair token flips to its number disc
// and the gold field produces from now on.
export function resolveLair(state: EpGame, hexId: HexId): [EpGame, EpEvent[]] {
  const lair = state.explorersPirates.lairs.find((l) => l.hex === hexId);
  if (!lair) return [state, []];
  const events: EpEvent[] = [];
  const involved = fromActivePlayer(state).filter((pid) => lair.crews.includes(pid));
  let next = state;
  for (const pid of involved) {
    next = addGold(next, pid, EP_LAIR_GOLD) as EpGame;
    let ev: EpEvent | null;
    [next, ev] = advanceTrack(next, pid, 'pirateLairs', 1);
    if (ev) events.push(ev);
  }

  const crewsOf = (pid: PlayerId) => lair.crews.filter((c) => c === pid).length;
  let rng = next.rngState;
  const rolls: Array<{ playerId: PlayerId; die: number; crews: number }> = [];
  let contenders = involved;
  let hero: PlayerId = involved[0]!;
  while (contenders.length > 0) {
    const round: Array<{ playerId: PlayerId; die: number; crews: number }> = [];
    for (const pid of contenders) {
      let die: number;
      [die, rng] = rollDie(rng);
      round.push({ playerId: pid, die, crews: crewsOf(pid) });
    }
    rolls.push(...round);
    const best = Math.max(...round.map((r) => r.die + r.crews));
    let top = round.filter((r) => r.die + r.crews === best);
    if (top.length > 1) {
      const most = Math.max(...top.map((r) => r.crews));
      top = top.filter((r) => r.crews === most);
    }
    if (top.length === 1) {
      hero = top[0]!.playerId;
      break;
    }
    contenders = top.map((r) => r.playerId);
  }
  next = { ...next, rngState: rng };
  let ev: EpEvent | null;
  [next, ev] = advanceTrack(next, hero, 'pirateLairs', 1);
  if (ev) events.push(ev);

  const heroIdx = lair.crews.indexOf(hero);
  const crews = lair.crews.filter((_, i) => i !== heroIdx);
  const hex = next.board.hexes[hexId]!;
  next = {
    ...next,
    board: { ...next.board, hexes: { ...next.board.hexes, [hexId]: { ...hex, numberToken: lair.number } } },
  };
  next = patchEp(next, (ep) => ({
    ...ep,
    lairs: ep.lairs.map((l) => (l.hex === hexId ? { ...l, crews, captured: true } : l)),
    pendingLairs: ep.pendingLairs.filter((h) => h !== hexId),
  }));
  events.unshift({ kind: 'lairCaptured', hex: hexId, number: lair.number, involved, rolls, hero });
  return [next, events];
}
