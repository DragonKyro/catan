import type { EdgeId, EpEvent, HexId, PlayerId, Resource } from '../../types';
import { RESOURCES } from '../../types';
import { updatePlayer } from '../../helpers';
import { addGold } from '../traders/coins/gold';
import { EP_EXPLORE_GOLD } from './constants';
import { hiddenHexesAtEdge, type EpGame } from './state';

// "Explore hexes" (Rulebook p. 12). When a ship's end touches a corner of a
// face-down hex, the hex is turned over:
//   - standard land: a number disc from the stack matching its back;
//   - gold field: a face-down pirate lair token;
//   - spice farm: one spice sack per player;
//   - fish shoal / sea: nothing more.
// The explorer takes 1 matching resource card, or 2 gold if there's none.

export function exploreHex(state: EpGame, playerId: PlayerId, hexId: HexId): [EpGame, EpEvent] {
  const ep = state.explorersPirates;
  const tile = ep.hidden[hexId];
  if (!tile) throw new Error(`Hex ${hexId} is already explored`);
  const hex = state.board.hexes[hexId]!;
  const hidden = { ...ep.hidden };
  delete hidden[hexId];

  let numberToken: number | null = null;
  let discs = ep.discs;
  let lairTokens = ep.lairTokens;
  let lairs = ep.lairs;
  let farms = ep.farms;
  let shoals = ep.shoals;
  const isResource = (RESOURCES as readonly string[]).includes(tile.terrain);
  if (isResource) {
    const stack = ep.discs[tile.region];
    numberToken = stack[stack.length - 1] ?? null;
    discs = { ...ep.discs, [tile.region]: stack.slice(0, -1) };
  } else if (tile.terrain === 'gold') {
    const number = lairTokens[lairTokens.length - 1] ?? 0;
    lairTokens = lairTokens.slice(0, -1);
    lairs = [...lairs, { hex: hexId, number, crews: [], captured: false }];
  } else if (tile.terrain === 'spice') {
    farms = [
      ...farms,
      {
        hex: hexId,
        ability: tile.ability ?? 'swiftVoyage',
        ...(tile.pirateNumber !== undefined ? { pirateNumber: tile.pirateNumber } : {}),
        sacks: [...state.playerOrder],
        crews: [],
      },
    ];
  } else if (tile.shoal !== undefined) {
    shoals = [...shoals, { hex: hexId, number: tile.shoal, haul: false }];
  }

  let next: EpGame = {
    ...state,
    board: {
      ...state.board,
      hexes: { ...state.board.hexes, [hexId]: { ...hex, terrain: tile.terrain, numberToken } },
    },
    explorersPirates: { ...ep, hidden, discs, lairTokens, lairs, farms, shoals },
  };

  let reward: Resource | 'gold' | null = null;
  if (isResource) {
    const r = tile.terrain as Resource;
    if (next.bank[r] > 0) {
      reward = r;
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        resources: { ...p.resources, [r]: p.resources[r] + 1 },
      })) as EpGame;
      next = { ...next, bank: { ...next.bank, [r]: next.bank[r] - 1 } };
    }
  } else {
    reward = 'gold';
    next = addGold(next, playerId, EP_EXPLORE_GOLD) as EpGame;
  }
  const event: EpEvent = {
    kind: 'explore',
    playerId,
    hex: hexId,
    terrain: tile.terrain,
    ...(numberToken !== null ? { number: numberToken } : {}),
    reward,
  };
  return [next, event];
}

// Turn over every face-down hex touching either end of `edge`.
export function exploreAroundEdge(state: EpGame, playerId: PlayerId, edgeId: EdgeId): [EpGame, EpEvent[]] {
  let next = state;
  const events: EpEvent[] = [];
  for (const h of hiddenHexesAtEdge(state, edgeId)) {
    let ev: EpEvent;
    [next, ev] = exploreHex(next, playerId, h);
    events.push(ev);
  }
  return [next, events];
}
