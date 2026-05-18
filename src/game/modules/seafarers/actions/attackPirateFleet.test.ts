import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { calculateVictoryPoints } from '../../../scoring/points';
import type { EdgeId, GameState } from '../../../types';

// The Pirate Islands scenario seeds `state.pirateFleet` on a sea hex
// between the main island and the pirate isles. Players attack via
// `attackPirateFleet`, capped to one attack per turn and gated on having
// a ship on an edge adjacent to the fleet's hex. Killing blow = +2 VP.
describe('Pirate Islands: pirate fleet combat', () => {
  function fresh(): GameState {
    const g = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 17,
      settings: { expansions: ['seafarers'], scenarioId: 'pirateIslands' },
      randomizeTurnOrder: false,
    });
    return { ...g, phase: 'main', hasRolledThisTurn: true };
  }

  // Plant a ship for `playerId` on an arbitrary edge adjacent to the
  // fleet hex so the adjacency check passes.
  function placeAdjacentShip(state: GameState, playerId: string): GameState {
    const fleetHex = state.pirateFleet!.hexId;
    const adjEdgeId: EdgeId | undefined = state.board.edgeIds.find((eid) => {
      const e = state.board.edges[eid];
      return e?.hexes.includes(fleetHex);
    });
    if (!adjEdgeId) throw new Error('No edge adjacent to fleet hex on this seed');
    return {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, ships: [...p.ships, adjEdgeId] } : p,
      ),
    };
  }

  it('seeds a fleet with full strength and no defeater', () => {
    const s = fresh();
    expect(s.pirateFleet).toBeDefined();
    expect(s.pirateFleet!.strength).toBe(s.pirateFleet!.maxStrength);
    expect(s.pirateFleet!.defeatedBy).toBeNull();
  });

  it('rejects attack without an adjacent ship', () => {
    const s = fresh();
    expect(() =>
      applyAction(s, { type: 'attackPirateFleet', playerId: 'p0' }),
    ).toThrow(/ship adjacent/i);
  });

  it('reduces fleet strength by 1 per attack', () => {
    let s = placeAdjacentShip(fresh(), 'p0');
    const before = s.pirateFleet!.strength;
    s = applyAction(s, { type: 'attackPirateFleet', playerId: 'p0' });
    expect(s.pirateFleet!.strength).toBe(before - 1);
    expect(s.attackedPirateThisTurn).toBe(true);
  });

  it('blocks a second attack on the same turn', () => {
    let s = placeAdjacentShip(fresh(), 'p0');
    s = applyAction(s, { type: 'attackPirateFleet', playerId: 'p0' });
    expect(() =>
      applyAction(s, { type: 'attackPirateFleet', playerId: 'p0' }),
    ).toThrow(/once per turn/i);
  });

  it('marks defeatedBy and awards +2 VP on the killing blow', () => {
    let s = placeAdjacentShip(fresh(), 'p0');
    // Hand-craft state right before the killing blow: strength 1.
    s = {
      ...s,
      pirateFleet: { ...s.pirateFleet!, strength: 1 },
    };
    const vpBefore = calculateVictoryPoints(s, 'p0', false);
    s = applyAction(s, { type: 'attackPirateFleet', playerId: 'p0' });
    expect(s.pirateFleet!.strength).toBe(0);
    expect(s.pirateFleet!.defeatedBy).toBe('p0');
    expect(calculateVictoryPoints(s, 'p0', false) - vpBefore).toBe(2);
  });

  it('rejects attack once defeated', () => {
    let s = placeAdjacentShip(fresh(), 'p0');
    s = {
      ...s,
      pirateFleet: { ...s.pirateFleet!, strength: 0, defeatedBy: 'p1' },
    };
    expect(() =>
      applyAction(s, { type: 'attackPirateFleet', playerId: 'p0' }),
    ).toThrow(/already defeated/i);
  });
});
