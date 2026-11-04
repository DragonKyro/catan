import type { Action, GameState, PlayerId, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { getWonder } from '@/game/modules/seafarers/wonders/catalogue';

// Seafarers log lines, derived from the action plus a before/after diff so
// effects that happen inside other actions (fog discovered by a road, a
// tribe pickup by a moved ship, a cloth trade opened by a new settlement,
// the pirate fleet's attack on a roll) are logged on every path.
export interface SeafarersLogLine {
  player: PlayerId | null;
  text: string;
  gained?: Partial<ResourceBank>;
}

function name(state: GameState, pid: PlayerId): string {
  return state.players.find((p) => p.id === pid)?.name ?? pid;
}

function gainedBy(before: GameState, after: GameState, pid: PlayerId): Partial<ResourceBank> {
  const b = before.players.find((p) => p.id === pid)!;
  const a = after.players.find((p) => p.id === pid)!;
  const out: Partial<ResourceBank> = {};
  for (const r of RESOURCES) {
    const d = a.resources[r] - b.resources[r];
    if (d > 0) out[r] = d;
  }
  return out;
}

export function seafarersLogLines(
  before: GameState,
  action: Action,
  after: GameState,
): SeafarersLogLine[] {
  if (!after.settings.expansions.includes('seafarers')) return [];
  const out: SeafarersLogLine[] = [];
  const me = action.playerId;

  switch (action.type) {
    case 'buildShip':
      out.push({ player: me, text: 'built a ship' });
      break;
    case 'placeInitialShip':
      out.push({ player: me, text: 'placed a ship instead of a road' });
      break;
    case 'moveShip':
      out.push({ player: me, text: 'moved a ship' });
      break;
    case 'playRoadBuilding':
      if ((action.ships ?? []).length > 0) {
        out.push({
          player: me,
          text: `placed ${action.edges.length} road(s) and ${action.ships!.length} ship(s) for free`,
        });
      }
      break;
    case 'movePirate':
      out.push({
        player: me,
        text: action.stealFrom
          ? `moved the pirate and stole ${action.stealCloth ? 'a cloth token' : 'a card'} from ${name(after, action.stealFrom)}`
          : 'moved the pirate',
      });
      break;
    case 'stealResource':
      out.push({
        player: me,
        text: action.stealFrom ? `stole a card from ${name(after, action.stealFrom)}` : 'stole nothing',
      });
      break;
    case 'chooseGoldResource':
      out.push({ player: me, text: 'took', gained: gainedBy(before, after, me) });
      break;
    case 'claimWonder':
      out.push({ player: me, text: `claimed the ${getWonder(action.wonderId).name}` });
      break;
    case 'buildWonder': {
      const w = after.wonders?.find((x) => x.id === action.wonderId);
      out.push({
        player: me,
        text: `built level ${w?.level ?? '?'} of the ${getWonder(action.wonderId).name}`,
      });
      break;
    }
    case 'placeTribePort': {
      const t = before.pendingTribePort?.portType;
      out.push({ player: me, text: `placed a ${t === 'generic' ? '3:1' : `2:1 ${t}`} port` });
      break;
    }
    case 'playKnight': {
      const b = before.players.find((p) => p.id === me)?.warships?.length ?? 0;
      const a = after.players.find((p) => p.id === me)?.warships?.length ?? 0;
      if (after.pirateIslands) {
        out.push({ player: me, text: a > b ? 'turned a ship into a warship' : 'played a Knight (no ship to convert)' });
      }
      break;
    }
    default:
      break;
  }

  // Fog discovered.
  const fogBefore = new Set(before.unrevealedFogHexes ?? []);
  const fogAfter = new Set(after.unrevealedFogHexes ?? []);
  const lifted = [...fogBefore].filter((h) => !fogAfter.has(h));
  if (lifted.length > 0) {
    const kinds = lifted.map((h) => {
      const t = after.board.hexes[h]!.terrain;
      return t === 'sea' ? 'open sea' : t === 'gold' ? 'a gold field' : `${t}`;
    });
    out.push({ player: me, text: `discovered ${kinds.join(', ')}` });
  }

  // Tribe pickups.
  for (const t of after.tribeTokens ?? []) {
    const was = before.tribeTokens?.find((x) => x.edge === t.edge && x.type === t.type);
    if (!t.claimedBy || was?.claimedBy) continue;
    out.push({
      player: t.claimedBy,
      text:
        t.type === 'victoryPoint'
          ? "picked up one of the tribe's VP tokens (+1 VP)"
          : t.type === 'devCard'
            ? "picked up one of the tribe's development cards"
            : `picked up the tribe's ${t.portType === 'generic' ? '3:1' : `2:1 ${t.portType}`} port`,
    });
  }

  // Island bonuses earned.
  for (const chip of after.islandChips ?? []) {
    const was = before.islandChips?.find((c) => c.islandId === chip.islandId);
    for (const pid of chip.claimedBy) {
      if (was?.claimedBy.includes(pid)) continue;
      out.push({ player: pid, text: `settled a new island (+${chip.vp} VP)` });
    }
  }

  // Cloth trade routes opened.
  for (const v of after.clothVillages ?? []) {
    const was = before.clothVillages?.find((x) => x.vertex === v.vertex);
    for (const pid of v.partners) {
      if (was?.partners.includes(pid)) continue;
      out.push({ player: pid, text: `opened trade with village ${v.number}` });
    }
  }

  // Pirate Islands: the fleet's attack on this roll, and fortress assaults.
  const pi = after.pirateIslands;
  if (pi && action.type === 'rollDice' && pi.lastFleetAttack) {
    const f = pi.lastFleetAttack;
    const parts = f.results.map((r) =>
      r.outcome === 'lost'
        ? `${name(after, r.playerId)} loses ${r.discarded} card${r.discarded === 1 ? '' : 's'}`
        : r.outcome === 'won'
          ? `${name(after, r.playerId)} repels it`
          : `${name(after, r.playerId)} holds (tie)`,
    );
    if (parts.length > 0) {
      out.push({ player: null, text: `☠ Pirate fleet (strength ${f.strength}) attacks: ${parts.join('; ')}` });
    }
  }
  if (pi && pi.lastFortressAttack && pi.lastFortressAttack !== before.pirateIslands?.lastFortressAttack) {
    const a = pi.lastFortressAttack;
    out.push({
      player: a.playerId,
      text:
        `attacked their pirate fortress (die ${a.die} vs ${a.warships} warship${a.warships === 1 ? '' : 's'}): ` +
        (a.outcome === 'won'
          ? a.captured
            ? 'fortress recaptured!'
            : 'a lair token falls'
          : `lost ${a.shipsLost} ship${a.shipsLost === 1 ? '' : 's'}`),
    });
  }
  return out;
}
