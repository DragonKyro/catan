import type {
  Action,
  BarbarianCardType,
  BarbarianExpelResult,
  GameState,
  HexId,
  PlayerId,
} from '@/game/types';
import { conqueredBuildingVertices } from '@/game/modules/traders/barbarianAttack/state';

// Barbarian Attack text: hex names and expel summaries shared by the game
// log and the Scenario tab, and the log lines themselves.

const TERRAIN_NAME: Record<string, string> = {
  wood: 'forest',
  brick: 'hills',
  sheep: 'pasture',
  wheat: 'fields',
  ore: 'mountains',
  desert: 'desert',
  castle: 'castle',
};

// "the 8 (hills)", "desert", "castle".
export function describeHex(game: GameState, hexId: HexId): string {
  const hex = game.board.hexes[hexId];
  if (!hex) return hexId;
  const t = TERRAIN_NAME[hex.terrain] ?? hex.terrain;
  return hex.numberToken !== null ? `${hex.numberToken} (${t})` : t;
}

function name(game: GameState, pid: PlayerId): string {
  return game.players.find((p) => p.id === pid)?.name ?? pid;
}

const COLOR_NAME: Record<BarbarianExpelResult['lossColor'], string> = {
  purple: 'purple "/" edges',
  green: 'green "\\" edges',
  brown: 'brown "|" edges',
};

export function expelLine(game: GameState, r: BarbarianExpelResult): string {
  const parts: string[] = [];
  const knights = Object.entries(r.knights)
    .map(([pid, n]) => `${name(game, pid)} ${n}`)
    .join(', ');
  parts.push(
    `${describeHex(game, r.hex)}: ${r.barbarians} barbarian${r.barbarians === 1 ? '' : 's'} beaten (knights: ${knights})`,
  );
  const won = Object.entries(r.prisoners)
    .filter(([, n]) => n > 0)
    .map(([pid, n]) => `${name(game, pid)} +${n} prisoner${n === 1 ? '' : 's'}`);
  if (won.length) parts.push(won.join(', '));
  if (r.rolls) {
    parts.push(
      'tie-break 🎲 ' +
        Object.entries(r.rolls)
          .map(([pid, rolls]) => `${name(game, pid)} ${rolls.join('/')}`)
          .join(', '),
    );
  }
  if (r.consolation.length) {
    parts.push(`${r.consolation.map((p) => name(game, p)).join(', ')} +3 gold`);
  }
  if (r.liberated) parts.push('hex liberated');
  const lost = Object.entries(r.knightsLost).filter(([, n]) => n > 0);
  parts.push(
    `loss die ${r.lossDie} → ${COLOR_NAME[r.lossColor]}` +
      (lost.length
        ? `: ${lost
            .map(([pid, n]) => `${name(game, pid)} loses ${n} knight${n === 1 ? '' : 's'} (+${3 * n} gold)`)
            .join(', ')}`
        : ', no knight lost'),
  );
  return parts.join('; ');
}

// ---------------------------------------------------------------- log ---

export interface BarbarianAttackLogLine {
  player: PlayerId | null;
  text: string;
}

const CARD_NAME: Record<BarbarianCardType, string> = {
  capture: 'Capture',
  knighthood: 'Knighthood',
  swiftKnight: 'Swift Knight',
  treason: 'Treason',
};

// Barbarian Attack log lines, from the action plus a before/after diff:
// cards bought (they're played face up), card choices, landing dice,
// knight moves, the 7 steal, expel results, and buildings conquered or
// liberated as a side effect of any of those.
export function barbarianAttackLogLines(
  before: GameState,
  action: Action,
  after: GameState,
): BarbarianAttackLogLine[] {
  const ba = after.barbarianAttack;
  if (!ba || !before.barbarianAttack) return [];
  const out: BarbarianAttackLogLine[] = [];
  const me = action.playerId;
  const events =
    ba.lastEvents && ba.lastEvents.seq !== before.barbarianAttack.lastEvents?.seq
      ? ba.lastEvents.events
      : [];

  switch (action.type) {
    case 'resolveBarbarianCard': {
      const card = before.barbarianAttack.pendingCard?.card;
      if (card === 'capture' && action.hex) {
        out.push({ player: me, text: `⛓ took a barbarian prisoner from the ${describeHex(after, action.hex)}` });
      } else if ((card === 'knighthood' || card === 'swiftKnight') && action.edge) {
        out.push({
          player: me,
          text: card === 'knighthood' ? '⚔ placed a knight on a castle edge' : '⚔ placed a knight (Swift Knight)',
        });
      } else if (card === 'treason') {
        const moves = (action.moves ?? [])
          .map((m) => `${m.from ? describeHex(after, m.from) : 'supply'} → ${describeHex(after, m.to)}`)
          .join(', ');
        out.push({ player: me, text: `🗡 Treason: +2 gold${moves ? `, moved barbarians ${moves}` : ''}` });
      }
      break;
    }
    case 'moveBarbarianKnight':
      out.push({ player: me, text: action.boost ? '⚔ moved a knight 4-5 edges (1 wheat)' : '⚔ moved a knight' });
      break;
    case 'stealResource':
      out.push({
        player: me,
        text: action.stealFrom ? `stole a card from ${name(after, action.stealFrom)}` : 'stole nothing',
      });
      break;
    default:
      break;
  }

  for (const ev of events) {
    if (ev.kind === 'cardDrawn') {
      const skipped = ev.skippedCaptures
        ? ` (${ev.skippedCaptures} Capture discarded: no barbarians on the coast)`
        : '';
      const wasted = ev.wasted ? ' — no knight or free edge for it, discarded' : '';
      out.push({ player: ev.playerId, text: `🃏 bought ${CARD_NAME[ev.card]}${skipped}${wasted}` });
      if (ev.card === 'treason' && after.phase !== 'barbarianCard') {
        out.push({ player: ev.playerId, text: '🗡 Treason: +2 gold, no barbarian could move' });
      }
    } else if (ev.kind === 'landing') {
      // At 5-6 players one roll can hit two coastal hexes (two 5s, two 9s):
      // consecutive entries with the same dice share one "🎲 n:".
      const parts: string[] = [];
      ev.rolls.forEach((r, i) => {
        const n = r.dice[0] + r.dice[1];
        const where = describeHex(after, r.hex);
        const what = !r.placed
          ? `${where} already conquered`
          : `+1 on the ${where}${r.conquered ? ' — conquered!' : ''}`;
        const prev = ev.rolls[i - 1];
        const sameRoll = prev && prev.dice[0] === r.dice[0] && prev.dice[1] === r.dice[1];
        if (sameRoll) parts[parts.length - 1] += ` and ${what}`;
        else parts.push(`🎲 ${n}: ${what}`);
      });
      const rolls = parts.join(' · ');
      out.push({
        player: ev.playerId,
        text: `🪓 barbarians land: ${rolls || 'none'}${ev.supplyEmpty ? ' (supply empty)' : ''}`,
      });
    } else if (ev.kind === 'expel') {
      for (const r of ev.results) out.push({ player: null, text: `⚔ Expel — ${expelLine(after, r)}` });
    }
  }

  // Buildings that fell or stood up again.
  const was = conqueredBuildingVertices(before);
  const now = conqueredBuildingVertices(after);
  for (const p of after.players) {
    for (const v of [...p.settlements, ...p.cities]) {
      const kind = p.cities.includes(v) ? 'city' : 'settlement';
      if (now.has(v) && !was.has(v)) {
        out.push({ player: p.id, text: `🏚 ${kind} conquered by the barbarians (no VP, no port)` });
      } else if (!now.has(v) && was.has(v)) {
        out.push({ player: p.id, text: `🏠 ${kind} liberated` });
      }
    }
  }
  return out;
}
