import { describe, expect, it } from 'vitest';
import { createGame } from '../../createGame';
import { applyAction } from '../../engine';
import { updatePlayer } from '../../helpers';
import { calculateVictoryPoints } from '../../scoring/points';
import { getBankTradeRate } from '../../actions/trade';
import { canPlaceSettlement, canPlaceInitialSettlement } from '../../placement';
import type { GameState, Player, PlayerId } from '../../types';
import { resolveEdgeRef, resolveVertexRef } from './board/generator';
import { isShipMovable } from './validation/shipPlacement';
import { pirateIslandsShipViolation, shipAdvancesLine } from './pirateIslands';
import { robberOrPirateChoicePhase } from './routing';

// Scenario mechanics, checked against the Seafarers 2025 rulebook. The four
// maps here are fixed setups, so coordinates are exact (see the scenario
// files for the transcriptions). Corners: 0 NE, 1 SE, 2 S, 3 SW, 4 NW, 5 N;
// edge directions: 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE.

function game(scenarioId: string, n = 4, seed = 3): GameState {
  return createGame({
    playerNames: Array.from({ length: n }, (_, i) => `P${i}`),
    seed,
    settings: { expansions: ['seafarers'], scenarioId },
    randomizeTurnOrder: false,
  });
}
function toMain(s: GameState, current = 0, clear = true): GameState {
  return {
    ...s,
    players: clear
      ? s.players.map((p) => ({ ...p, settlements: [], cities: [], roads: [], ships: [] }))
      : s.players,
    phase: 'main',
    setupState: undefined,
    hasRolledThisTurn: true,
    currentPlayerIndex: current,
    turnHolderIndex: current,
  };
}
function put(s: GameState, pid: PlayerId, patch: Partial<Player>): GameState {
  return updatePlayer(s, pid, (p) => ({ ...p, ...patch }));
}
const V = (s: GameState, q: number, r: number, corner: 0 | 1 | 2 | 3 | 4 | 5) =>
  resolveVertexRef(s.board, { q, r, corner });
const E = (s: GameState, q: number, r: number, direction: 0 | 1 | 2 | 3 | 4 | 5) =>
  resolveEdgeRef(s.board, { q, r, direction });
const none = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
const rich = { wood: 9, brick: 9, sheep: 9, wheat: 9, ore: 9 };
const devs = (unplayed: Player['devCards']['unplayed']): Player['devCards'] => ({
  unplayed,
  boughtThisTurn: [],
  playedKnights: 0,
  victoryPoints: 0,
});

// ------------------------------------------------------------------------
describe('The Forgotten Tribe', () => {
  it('a ship onto a VP edge takes the token (+1 VP)', () => {
    let s = toMain(game('forgottenTribe'));
    // (0,-3)'s NW corner = (-1,-3)'s NE corner, one end of the VP edge.
    s = put(s, 'p0', { ships: [E(s, 0, -3, 4)], resources: rich });
    const vpEdge = E(s, -1, -3, 5);
    expect(s.tribeTokens!.find((t) => t.edge === vpEdge)?.type).toBe('victoryPoint');
    const before = calculateVictoryPoints(s, 'p0', true);
    s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge: vpEdge });
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(before + 1);
    expect(s.tribeTokens!.find((t) => t.edge === vpEdge)?.claimedBy).toBe('p0');
  });

  it('a port taken with no coastal settlement is held; a dev card is "bought this turn"', () => {
    let s = toMain(game('forgottenTribe'));
    s = put(s, 'p0', { ships: [E(s, 0, -3, 4)], resources: rich });
    // Port on (-1,-3)'s NW edge (shares the N corner with the VP edge).
    s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge: E(s, -1, -3, 5) });
    s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge: E(s, -1, -3, 4) });
    expect(s.phase).toBe('main');
    expect(s.players[0]!.heldPorts).toHaveLength(1);
    // Dev card on the W edge (shares the NW corner).
    s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge: E(s, -1, -3, 3) });
    const p0 = s.players[0]!;
    expect(p0.devCards.boughtThisTurn.length + p0.devCards.victoryPoints).toBe(1);
  });

  it('with a coastal settlement the port is placed at once and works', () => {
    let s = toMain(game('forgottenTribe'));
    // A coastal settlement on the large island: (-3,-1) wheat 6, NW corner
    // faces the sea row above.
    const home = V(s, -3, -1, 4);
    s = put(s, 'p0', { settlements: [home], ships: [E(s, 0, -3, 4)], resources: rich });
    s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge: E(s, -1, -3, 5) });
    s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge: E(s, -1, -3, 4) });
    expect(s.phase).toBe('placeTribePort');
    const portType = s.pendingTribePort!.portType;
    // The settlement faces the sea frame: a frame edge is a valid harbor.
    const edge = s.board.vertices[home]!.edges.find((e) => s.board.edges[e]!.hexes.length === 1)!;
    s = applyAction(s, { type: 'placeTribePort', playerId: 'p0', edge });
    expect(s.phase).toBe('main');
    expect(s.players[0]!.ports).toContain(portType);
    const give = portType === 'generic' ? 'wood' : portType;
    expect(getBankTradeRate(s, 'p0', give)).toBe(portType === 'generic' ? 3 : 2);
  });

  it('settlements only on numbered hexes', () => {
    const s = toMain(game('forgottenTribe'));
    // (-1,-3) gold and (0,-3) mountains carry no numbers: their shared
    // corners can't be settled even when connected.
    const bareCorner = V(s, -1, -3, 1); // SE corner: (-1,-3), (0,-3), sea
    const withShip = put(s, 'p0', { ships: [s.board.vertices[bareCorner]!.edges[0]!] });
    expect(canPlaceSettlement(withShip, 'p0', bareCorner)).toBe(false);
  });
});

// ------------------------------------------------------------------------
describe('Cloth for Catan', () => {
  // (1,-3) brick 5 on the north island; its S corner is one ship away from
  // the village 11 at (0,-1)'s N corner, along (0,-2)'s E edge.
  function routed() {
    let s = toMain(game('clothForCatan'));
    s = put(s, 'p0', { settlements: [V(s, 1, -3, 2)], resources: rich });
    s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge: E(s, 0, -2, 0) });
    return s;
  }

  it('a route to a village opens trade: 1 cloth at once', () => {
    const s = routed();
    const village = s.clothVillages!.find((v) => v.number === 11 && v.vertex === V(s, 0, -1, 5))!;
    expect(village.partners).toEqual(['p0']);
    expect(village.supply).toBe(4);
    expect(s.players[0]!.cloth).toBe(1);
  });

  it("the village's number pays its partners; the route's ships are locked", () => {
    let s = routed();
    expect(isShipMovable(s, 'p0', E(s, 0, -2, 0))).toBe(false);
    s = { ...s, phase: 'rollOrPlayKnight', hasRolledThisTurn: false };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [5, 6] });
    expect(s.players[0]!.cloth).toBe(2);
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(1 + 1); // settlement + 1 pair
  });

  it('an empty village no longer produces; 5 empty villages end the game', () => {
    let s = routed();
    s = {
      ...s,
      clothVillages: s.clothVillages!.map((v, i) => (i < 5 ? { ...v, supply: 0 } : v)),
    };
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe('p0'); // most VP (settlement + cloth)
  });

  it('the pirate stays put until you trade with a village', () => {
    const s = toMain(game('clothForCatan'));
    expect(robberOrPirateChoicePhase(s)).toBe('moveRobber');
    expect(robberOrPirateChoicePhase(routed())).toBe('chooseRobberOrPirate');
  });

  it('three starting settlements; only the third pays resources', () => {
    let s = game('clothForCatan', 3);
    expect(s.settings.setupRounds).toBe(3);
    let placed = 0;
    while (s.phase === 'setupRound1' || s.phase === 'setupRound2' || s.phase === 'setupRound3' || s.phase === 'chooseGoldResource') {
      if (s.phase === 'chooseGoldResource') {
        const pid = Object.keys(s.goldChoiceState!.pending)[0]!;
        s = applyAction(s, { type: 'chooseGoldResource', playerId: pid, resources: Array(s.goldChoiceState!.pending[pid]).fill('wheat') });
        continue;
      }
      const pid = s.playerOrder[s.currentPlayerIndex]!;
      if (s.setupState!.step === 'settlement') {
        if (s.phase !== 'setupRound3') {
          expect(s.players.every((p) => p.resources.wood + p.resources.brick + p.resources.sheep + p.resources.wheat + p.resources.ore === 0)).toBe(true);
        }
        const v = s.board.vertexIds.find((x) => canPlaceInitialSettlement(s, x))!;
        s = applyAction(s, { type: 'placeInitialSettlement', playerId: pid, vertex: v });
        placed++;
      } else {
        const v = s.setupState!.lastPlacedSettlement!;
        const e = s.board.vertices[v]!.edges.find((x) =>
          s.board.edges[x]!.hexes.some((h) => s.board.hexes[h]!.terrain !== 'sea') &&
          !s.players.some((p) => p.roads.includes(x) || p.ships.includes(x)),
        )!;
        s = applyAction(s, { type: 'placeInitialRoad', playerId: pid, edge: e });
      }
    }
    expect(placed).toBe(9);
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.players.every((p) => p.settlements.length === 3)).toBe(true);
  });
});

// ------------------------------------------------------------------------
describe('The Pirate Islands', () => {
  it('seats the rulebook pieces: fortresses, beachheads, a settlement and ship each', () => {
    const s = game('pirateIslands', 4);
    // Red (slot 0): settlement on (3,-3) S, fortress on (-1,-3) N, beachhead (0,-3) NE.
    expect(s.players[0]!.settlements).toEqual([V(s, 3, -3, 2)]);
    expect(s.pirateIslands!.fortresses[0]).toMatchObject({
      vertex: V(s, -1, -3, 5),
      beachhead: V(s, 0, -3, 0),
      lairs: 3,
    });
    // 3 players skip the white slot.
    const s3 = game('pirateIslands', 3);
    expect(s3.players[1]!.settlements).toEqual([V(s3, 1, 0, 2)]);
  });

  it('the fleet sails by the lower die and attacks buildings on its hex', () => {
    let s = toMain(game('pirateIslands', 4));
    // Fleet at path[7] = (-1,3); a roll of 2+6 moves it 2 to (-2,2).
    const target = s.pirateIslands!.path[9]!;
    const corner = s.board.hexes[target]!.corners[0]!;
    s = put(s, 'p0', { cities: [corner], resources: { ...none, ore: 3 } });
    s = put(s, 'p1', { resources: { ...none, wheat: 3 } });
    s = { ...s, phase: 'rollOrPlayKnight', hasRolledThisTurn: false };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [2, 6] });
    expect(s.board.pirateHex).toBe(target);
    // Strength 2 beats 0 warships: 1 card + 1 for the city there.
    expect(s.players[0]!.resources.ore).toBe(1);
    expect(s.pirateIslands!.lastFleetAttack!.results[0]).toMatchObject({ outcome: 'lost', discarded: 2 });
    expect(s.players[1]!.resources.wheat).toBe(3);
  });

  it('beating the fleet pays a resource of choice', () => {
    let s = toMain(game('pirateIslands', 4));
    const target = s.pirateIslands!.path[9]!;
    const corner = s.board.hexes[target]!.corners[0]!;
    const ship = s.board.vertices[corner]!.edges[0]!;
    s = put(s, 'p0', { settlements: [corner], ships: [ship], warships: [ship, ship, ship] });
    s = { ...s, phase: 'rollOrPlayKnight', hasRolledThisTurn: false };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [2, 6] });
    expect(s.phase).toBe('chooseGoldResource');
    expect(s.goldChoiceState!.pending.p0).toBe(1);
  });

  it('no robber: a 7 lets the roller steal from anyone', () => {
    let s = toMain(game('pirateIslands', 4));
    s = put(s, 'p2', { resources: { ...none, brick: 2 } });
    s = { ...s, phase: 'rollOrPlayKnight', hasRolledThisTurn: false };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(s.phase).toBe('stealResource');
    s = applyAction(s, { type: 'stealResource', playerId: 'p0', stealFrom: 'p2' });
    expect(s.players[0]!.resources.brick).toBe(1);
    expect(s.phase).toBe('main');
  });

  it('Knights only make warships; VP cards become Knights at 4 players', () => {
    let s = game('pirateIslands', 4);
    expect(s.devCardDeck.filter((c) => c === 'victoryPoint')).toHaveLength(0);
    expect(game('pirateIslands', 3).devCardDeck.length).toBe(20);
    s = toMain(s, 0, false);
    s = put(s, 'p0', { devCards: devs(['knight']) });
    s = applyAction(s, { type: 'playKnight', playerId: 'p0' });
    expect(s.players[0]!.warships).toEqual(s.players[0]!.ships);
    expect(s.phase).toBe('main');
  });

  it('one line of ships to the west, by the shortest path, no branching', () => {
    let s = toMain(game('pirateIslands', 4), 0, false);
    s = { ...s, board: { ...s.board, pirateHex: s.pirateIslands!.path[4] } };
    s = put(s, 'p0', { resources: { ...rich, wood: 15, sheep: 15 } });
    // Sail toward the beachhead one shortest-path step at a time.
    const beachhead = s.pirateIslands!.fortresses[0]!.beachhead;
    for (let step = 0; step < 14; step++) {
      const p0 = s.players[0]!;
      if (p0.ships.some((e) => s.board.edges[e]!.vertices.includes(beachhead))) break;
      const pick = s.board.edgeIds.find((e) => {
        if (!shipAdvancesLine(s, 'p0', e)) return false;
        try {
          applyAction(s, { type: 'buildShip', playerId: 'p0', edge: e });
          return true;
        } catch {
          return false;
        }
      })!;
      expect(pick).toBeDefined();
      s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge: pick });
    }
    const p0 = s.players[0]!;
    expect(p0.ships.some((e) => s.board.edges[e]!.vertices.includes(beachhead))).toBe(true);
    // A second western line, or a branch off the line, is refused.
    const tipLess = s.board.edgeIds.filter(
      (e) => pirateIslandsShipViolation(s, 'p0', e) !== null,
    );
    expect(tipLess.length).toBeGreaterThan(0);
    // The beachhead may now be settled (and no other pirate-island corner).
    expect(canPlaceSettlement(s, 'p0', beachhead)).toBe(true);
    expect(canPlaceSettlement(s, 'p1', beachhead)).toBe(false);
  });

  it('ending the turn with the line at the fortress attacks it; 3 wins recapture it', () => {
    let s = toMain(game('pirateIslands', 4), 0, false);
    const f = s.pirateIslands!.fortresses[0]!;
    const ship = s.board.vertices[f.vertex]!.edges[0]!;
    const sevenWarships = Array(7).fill(ship) as string[];
    s = put(s, 'p0', { ships: [...s.players[0]!.ships, ship], warships: sevenWarships });
    for (let i = 0; i < 3; i++) {
      s = { ...s, phase: 'main', currentPlayerIndex: 0, turnHolderIndex: 0, hasRolledThisTurn: true };
      s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
      expect(s.pirateIslands!.lastFortressAttack!.outcome).toBe('won');
    }
    expect(s.pirateIslands!.fortresses[0]!.lairs).toBe(0);
    expect(s.players[0]!.settlements).toContain(f.vertex);
  });

  it('losing the assault costs the ships nearest the fortress', () => {
    let s = toMain(game('pirateIslands', 4), 0, false);
    const f = s.pirateIslands!.fortresses[0]!;
    const ship = s.board.vertices[f.vertex]!.edges[0]!;
    s = put(s, 'p0', { ships: [...s.players[0]!.ships, ship], warships: [] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.pirateIslands!.lastFortressAttack!.outcome).toBe('lost');
    expect(s.players[0]!.ships).not.toContain(ship);
  });

  it('the win needs the recaptured fortress AND 10 VP', () => {
    let s = toMain(game('pirateIslands', 4), 0, false);
    const many = s.board.vertexIds.filter((v) => s.board.vertices[v]!.hexes.length === 3).slice(0, 9);
    s = put(s, 'p0', { settlements: [...s.players[0]!.settlements, ...many] });
    expect(calculateVictoryPoints(s, 'p0', true)).toBeGreaterThanOrEqual(10);
    // 10 VP alone doesn't end the game.
    expect(s.phase).toBe('main');
    const f = s.pirateIslands!.fortresses[0]!;
    s = {
      ...s,
      pirateIslands: { ...s.pirateIslands!, fortresses: s.pirateIslands!.fortresses.map((x) => (x.playerId === 'p0' ? { ...x, lairs: 1 } : x)) },
    };
    const ship = s.board.vertices[f.vertex]!.edges[0]!;
    s = put(s, 'p0', { ships: [...s.players[0]!.ships, ship], warships: Array(7).fill(ship) as string[] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.winner).toBe('p0');
  });
});

// ------------------------------------------------------------------------
describe('The Wonders of Catan', () => {
  it('claim one wonder whose requirement you meet; others are locked out', () => {
    let s = toMain(game('wondersOfCatan'));
    s = put(s, 'p0', { cities: [V(s, 0, 0, 5), V(s, -3, 1, 2)] });
    expect(() => applyAction(s, { type: 'claimWonder', playerId: 'p1', wonderId: 'grandTheater' })).toThrow();
    s = applyAction(s, { type: 'claimWonder', playerId: 'p0', wonderId: 'grandTheater' });
    expect(() => applyAction(s, { type: 'claimWonder', playerId: 'p0', wonderId: 'grandCastle' })).toThrow(/one wonder/);
    s = { ...s, currentPlayerIndex: 1, turnHolderIndex: 1 };
    s = put(s, 'p1', { cities: [V(s, 1, -1, 5), V(s, -1, 2, 2)], resources: rich });
    expect(() => applyAction(s, { type: 'buildWonder', playerId: 'p1', wonderId: 'grandTheater' })).toThrow();
  });

  it('levels cost the tile, give no VP, and the fourth wins', () => {
    let s = toMain(game('wondersOfCatan'));
    s = put(s, 'p0', { cities: [V(s, 0, 0, 5), V(s, -3, 1, 2)], resources: { ...rich, sheep: 12 } });
    const vp = calculateVictoryPoints(s, 'p0', true);
    s = applyAction(s, { type: 'buildWonder', playerId: 'p0', wonderId: 'grandTheater' });
    expect(s.players[0]!.resources.sheep).toBe(12 - 3);
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(vp);
    s = applyAction(s, { type: 'buildWonder', playerId: 'p0', wonderId: 'grandTheater' });
    s = applyAction(s, { type: 'buildWonder', playerId: 'p0', wonderId: 'grandTheater' });
    expect(s.phase).toBe('main');
    s = applyAction(s, { type: 'buildWonder', playerId: 'p0', wonderId: 'grandTheater' });
    expect(s.winner).toBe('p0');
  });

  it('10 VP wins only with a strictly higher wonder level than everyone', () => {
    let s = toMain(game('wondersOfCatan'));
    const spots = s.board.vertexIds.filter((v) => s.board.vertices[v]!.hexes.length === 3).slice(0, 8);
    s = put(s, 'p0', { settlements: spots, cities: [V(s, 0, 0, 5)], resources: rich });
    expect(calculateVictoryPoints(s, 'p0', true)).toBeGreaterThanOrEqual(10);
    // Rival already at level 1 on another wonder.
    s = { ...s, wonders: s.wonders!.map((w) => (w.id === 'grandTheater' ? { ...w, claimedBy: 'p1', level: 1 } : w)) };
    s = applyAction(s, { type: 'claimWonder', playerId: 'p0', wonderId: 'grandCastle' });
    s = applyAction(s, { type: 'buildWonder', playerId: 'p0', wonderId: 'grandCastle' });
    expect(s.phase).toBe('main'); // level 1 vs 1: no lead
    s = applyAction(s, { type: 'buildWonder', playerId: 'p0', wonderId: 'grandCastle' });
    expect(s.winner).toBe('p0'); // level 2 > 1 with 10+ VP
  });

  it('marker wonders need a building on a marker; setup avoids the markers', () => {
    const s = toMain(game('wondersOfCatan'));
    const wall = s.wonderSites!.greatWall![0]!;
    expect(() => applyAction(s, { type: 'claimWonder', playerId: 'p0', wonderId: 'greatWall' })).toThrow();
    const ok = applyAction(put(s, 'p0', { settlements: [wall] }), { type: 'claimWonder', playerId: 'p0', wonderId: 'greatWall' });
    expect(ok.wonders!.find((w) => w.id === 'greatWall')!.claimedBy).toBe('p0');
    const fresh = game('wondersOfCatan');
    for (const v of fresh.setupBlockedVertices!) expect(canPlaceInitialSettlement(fresh, v)).toBe(false);
  });
});
