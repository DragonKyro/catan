import type { EpPlacePirateAction, GameState, Resource } from '../../types';
import { RESOURCES } from '../../types';
import { updatePlayer } from '../../helpers';
import { rngInt } from '../../rng';
import { addGold } from '../traders/coins/gold';
import { canPlacePirateOn, isExplorersPirates, patchEp, pirateVictims, pushEpEvents, type EpGame } from './state';

// "Activate the pirate ship" (Rulebook p. 8): an opponent's pirate ship on
// the board goes back to its owner; yours goes (or moves) to a different sea
// hex — not next to the starting island, not on the frame. Then steal 1
// random resource card from a player with a ship on that hex (1 gold if they
// have no cards). A pirate on a shoal sends its fish haul back to the supply.
export function handleEpPlacePirate(state: GameState, action: EpPlacePirateAction): GameState {
  if (!isExplorersPirates(state)) throw new Error('Not an Explorers & Pirates game');
  const pending = state.explorersPirates.pendingPirate;
  if (state.phase !== 'epPlacePirate' || !pending) throw new Error('No pirate ship to place now');
  if (action.playerId !== pending.playerId) throw new Error('Not your pirate ship to place');
  if (!canPlacePirateOn(state, action.hex)) {
    throw new Error('The pirate ship goes on another sea hex, not next to the starting island or on the frame');
  }
  const victims = pirateVictims(state, action.playerId, action.hex);
  if (action.stealFrom !== null && !victims.includes(action.stealFrom)) {
    throw new Error('You can only rob a player with a ship on that hex');
  }
  if (action.stealFrom === null && victims.length > 0) {
    throw new Error('Choose a player to rob');
  }

  let haulLost = false;
  let next: EpGame = patchEp(state, (ep) => {
    const shoal = ep.shoals.find((s) => s.hex === action.hex && s.haul);
    haulLost = !!shoal;
    return {
      ...ep,
      pirate: { owner: action.playerId, hex: action.hex },
      shoals: shoal ? ep.shoals.map((s) => (s === shoal ? { ...s, haul: false } : s)) : ep.shoals,
      fishSupply: shoal ? ep.fishSupply + 1 : ep.fishSupply,
      pendingPirate: undefined,
    };
  });

  let stoleGold = false;
  if (action.stealFrom) {
    const victim = next.players.find((p) => p.id === action.stealFrom)!;
    const cards: Resource[] = [];
    for (const r of RESOURCES) for (let i = 0; i < victim.resources[r]; i++) cards.push(r);
    if (cards.length > 0) {
      const [idx, rng] = rngInt(next.rngState, cards.length);
      const r = cards[idx]!;
      next = { ...next, rngState: rng };
      next = updatePlayer(next, victim.id, (p) => ({ ...p, resources: { ...p.resources, [r]: p.resources[r] - 1 } })) as EpGame;
      next = updatePlayer(next, action.playerId, (p) => ({
        ...p,
        resources: { ...p.resources, [r]: p.resources[r] + 1 },
      })) as EpGame;
    } else {
      stoleGold = true;
      next = addGold(next, victim.id, -1) as EpGame;
      next = addGold(next, action.playerId, 1) as EpGame;
    }
  }
  next = { ...next, phase: pending.returnTo };
  return pushEpEvents(next, [
    {
      kind: 'pirate',
      playerId: action.playerId,
      hex: action.hex,
      stoleFrom: action.stealFrom,
      stoleGold,
      haulLost,
    },
  ]);
}
