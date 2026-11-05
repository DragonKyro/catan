import type { Action, EpEvent, EpSpiceAbility, GameState, PlayerId, ResourceBank, Terrain } from '@/game/types';
import { EP_LAIR_CREWS, EP_MISSION_NAMES } from '@/game/modules/explorersPirates/constants';

// Explorers & Pirates log lines. Most come from the events the engine
// records on the action that produced them (`explorersPirates.lastEvents`,
// new when its `seq` changes): exploration, production gold, tributes,
// chase rolls, the pirate ship and its robbery (never naming the card),
// fish rolls, loading, deliveries, settlements founded, lair captures and
// track moves. Builds and the other ship actions are logged from the
// action itself.

export interface ExplorersPiratesLogLine {
  player: PlayerId | null;
  text: string;
  gained?: Partial<ResourceBank>;
}

const TERRAIN_NAME: Partial<Record<Terrain, string>> = {
  wood: 'forest',
  brick: 'hills',
  sheep: 'pasture',
  wheat: 'fields',
  ore: 'mountains',
  gold: 'a gold field held by pirates',
  spice: 'a spice farm',
  sea: 'open sea',
};

const ABILITY_NAME: Record<EpSpiceAbility, string> = {
  swiftVoyage: 'Swift Voyage',
  fastGold: 'Fast Gold',
  pirateBonus: 'Pirate Bonus',
};

const CARGO_NAME: Record<string, string> = {
  settler: 'settler',
  crew: 'crew',
  fish: 'fish haul',
  spice: 'spice sack',
};

function name(game: GameState, pid: PlayerId): string {
  return game.players.find((p) => p.id === pid)?.name ?? pid;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function pieces(list: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const p of list) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts].map(([p, n]) => plural(n, CARGO_NAME[p] ?? p)).join(' and ');
}

export function epEventLine(game: GameState, e: EpEvent): ExplorersPiratesLogLine | null {
  const ep = game.explorersPirates;
  switch (e.kind) {
    case 'explore': {
      const region = ep?.regionOf[e.hex];
      let what = TERRAIN_NAME[e.terrain] ?? e.terrain;
      if (e.terrain === 'sea') {
        const shoal = ep?.shoals.find((s) => s.hex === e.hex);
        what = shoal ? `a fish shoal (${shoal.number})` : 'open sea';
      } else if (e.terrain === 'spice') {
        const farm = ep?.farms.find((f) => f.hex === e.hex);
        what = farm ? `a spice farm (${ABILITY_NAME[farm.ability]})` : 'a spice farm';
      } else if (e.number !== undefined) {
        what = `${what} (${e.number})`;
      }
      const reward =
        e.reward === 'gold' ? ' — +2 gold' : e.reward === null ? ' — the supply had no card for it' : ' — took 1';
      const gained = e.reward && e.reward !== 'gold' ? { [e.reward]: 1 } : undefined;
      return {
        player: e.playerId,
        text: `🧭 explored a ${region ?? ''} hex: ${what}${reward}`.replace('a  hex', 'a hex'),
        ...(gained ? { gained } : {}),
      };
    }
    case 'production': {
      const parts = Object.entries(e.gold)
        .filter(([, n]) => n > 0)
        .map(([pid, n]) => `${name(game, pid)} +${n}`);
      return parts.length > 0 ? { player: null, text: `🪙 gold: ${parts.join(', ')}` } : null;
    }
    case 'tribute':
      return { player: e.playerId, text: `🪙 paid ${name(game, e.to)} 1 gold tribute at the pirate ship` };
    case 'chase':
      return {
        player: e.playerId,
        text: `⚔ attacked the pirate ship: rolled ${e.die} — ${e.success ? 'chased it away!' : 'it stays'}`,
      };
    case 'pirate': {
      const rob = e.stoleFrom
        ? ` and robbed ${name(game, e.stoleFrom)} of ${e.stoleGold ? '1 gold' : '1 card'}`
        : '';
      return {
        player: e.playerId,
        text: `☠️ placed their pirate ship${rob}${e.haulLost ? ' (the fish haul there went back)' : ''}`,
      };
    }
    case 'fishRoll':
      return {
        player: e.playerId,
        text: `🎲 rolled ${e.die} for fish: ${e.hex ? 'a fish haul appears on the shoal' : 'no fish this time'}`,
      };
    case 'loadFish':
      return { player: e.playerId, text: '🐟 loaded a fish haul' };
    case 'loadSpice':
      return { player: e.playerId, text: '🌶 loaded a spice sack' };
    case 'crewToFarm':
      return { player: e.playerId, text: `👥 landed a crew on a spice farm (${ABILITY_NAME[e.ability]})` };
    case 'crewToLair':
      return {
        player: e.playerId,
        text: `👥 landed a crew on a pirate lair (${e.crews}/${EP_LAIR_CREWS})${e.crews >= EP_LAIR_CREWS ? ' — captured!' : ''}`,
      };
    case 'deliver': {
      const what = [e.fish ? plural(e.fish, 'fish haul') : '', e.spice ? plural(e.spice, 'spice sack') : '']
        .filter(Boolean)
        .join(' and ');
      return { player: e.playerId, text: `🏛 delivered ${what} to the Council of Catan` };
    }
    case 'found':
      return { player: e.playerId, text: '🏠 founded a settlement from their ship' };
    case 'lairCaptured': {
      const hero = [...e.rolls].reverse().find((r) => r.playerId === e.hero);
      const who = e.involved.map((p) => name(game, p)).join(', ');
      return {
        player: null,
        text: `☠️ The pirate lair falls (gold field ${e.number}): ${who} +2 gold each. Hero: ${name(game, e.hero)}${hero ? ` (${hero.die} + ${plural(hero.crews, 'crew')})` : ''}`,
      };
    }
    case 'track':
      return { player: e.playerId, text: `📈 ${EP_MISSION_NAMES[e.mission]}: space ${e.from} → ${e.to}` };
    case 'fastGold':
      return { player: e.playerId, text: `⚡ Fast Gold: 1 ${e.give} → 1 gold` };
  }
}

export function explorersPiratesLogLines(before: GameState, action: Action, after: GameState): ExplorersPiratesLogLine[] {
  const ep = after.explorersPirates;
  const was = before.explorersPirates;
  if (!ep || !was) return [];
  const out: ExplorersPiratesLogLine[] = [];
  const pid = action.playerId;
  // From the action itself.
  switch (action.type) {
    case 'epBuildHarbor':
      out.push({ player: pid, text: '⚓ built a harbor settlement' });
      break;
    case 'epBuildShip':
      out.push({ player: pid, text: `⛵ built a ship${action.recycle ? ' (bringing another home first)' : ''}` });
      break;
    case 'epBuildSettler':
    case 'epBuildCrew': {
      const piece = action.type === 'epBuildSettler' ? 'settler' : 'crew';
      const where = 'harbor' in action.at ? 'a harbor settlement' : 'a ship';
      const evicted = action.evict?.length ? `, returning ${pieces(action.evict)}` : '';
      out.push({ player: pid, text: `${piece === 'settler' ? '🧑' : '👥'} built a ${piece} on ${where}${evicted}` });
      break;
    }
    case 'epBoostShip':
      out.push({ player: pid, text: '🐑 paid 1 wool: +2 MP for a ship' });
      break;
    case 'epTransfer': {
      const parts = [
        action.load.length ? `loaded ${pieces(action.load)}` : '',
        action.unload.length ? `unloaded ${pieces(action.unload)}` : '',
      ].filter(Boolean);
      out.push({ player: pid, text: `⇄ ${parts.join(', ')} at their harbor settlement` });
      break;
    }
    case 'epCrewFromLair':
      out.push({ player: pid, text: '👥 took a crew back aboard from a gold field' });
      break;
    case 'endTurn': {
      const moved = before.phase === 'epMovement' ? (was.movement?.moved.length ?? 0) : 0;
      if (moved > 0) out.push({ player: pid, text: `⛵ sailed ${plural(moved, 'ship')}` });
      break;
    }
    default:
      break;
  }
  // From the engine's events.
  if (ep.lastEvents && ep.lastEvents.seq !== was.lastEvents?.seq) {
    for (const e of ep.lastEvents.events) {
      const line = epEventLine(after, e);
      if (line) out.push(line);
    }
  }
  return out;
}
