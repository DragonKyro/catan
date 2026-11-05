import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import type { LobbyGame, LobbySeat, LobbyState } from '@/net/types';
import {
  defaultLobbyGame,
  lobbyBaseMaps,
  lobbyRules,
  lobbyScenario,
  lobbySettings,
  lobbyStartProblem,
  lobbyVpTarget,
  normalizeLobbyGame,
  withLobbyRules,
} from './lobbyGame';

function lobby(game: LobbyGame, seats = 4): LobbyState {
  const seat = (i: number): LobbySeat => ({ uuid: `u${i}`, name: `P${i}`, isAI: false, color: 'red' });
  return {
    hostUuid: 'u0',
    seats: Array.from({ length: seats }, (_, i) => seat(i)),
    victoryPointsToWin: null,
    seed: 7,
    game,
  };
}

// The game the host would start from this lobby.
function startedGame(l: LobbyState) {
  return createGame({
    playerNames: l.seats.map((s) => s.name),
    playerTypes: l.seats.map(() => 'human'),
    seed: l.seed,
    settings: lobbySettings(l),
  });
}

describe('online lobby game choice', () => {
  it('offers one expansion at a time', () => {
    let g = withLobbyRules(defaultLobbyGame(), 'citiesKnights');
    expect(lobbyRules(g)).toBe('citiesKnights');
    g = withLobbyRules(g, 'traders');
    expect(g).toMatchObject({ seafarers: false, citiesKnights: false, traders: true });
    expect(lobbyRules(normalizeLobbyGame({ ...g, seafarers: true }))).toBe('seafarers');
  });

  it('Cities & Knights: 13 VP, 3-6 seats, its own first-game board, no Gold Rush / Volcano', () => {
    const g = withLobbyRules(defaultLobbyGame(), 'citiesKnights');
    const info = lobbyScenario(g);
    expect(info).toMatchObject({ name: 'Cities & Knights', minPlayers: 3, maxPlayers: 6 });
    expect(info.recommendedVp(4)).toBe(13);
    const maps = lobbyBaseMaps(g).map((m) => m.id);
    expect(maps).toContain('ckFirstGame');
    expect(maps).not.toContain('goldRush');
    expect(maps).not.toContain('volcano');
    // The first-game board is a C&K board only.
    expect(lobbyBaseMaps(defaultLobbyGame()).map((m) => m.id)).not.toContain('ckFirstGame');
    // A map the new rules refuse falls back to the standard board.
    const fromVolcano = withLobbyRules({ ...defaultLobbyGame(), baseScenarioId: 'volcano' }, 'citiesKnights');
    expect(fromVolcano.baseScenarioId).toBe('standard');

    const game = startedGame(lobby(g));
    expect(game.settings.expansions).toEqual(['citiesAndKnights']);
    expect(game.settings.victoryPointsToWin).toBe(13);
    expect(lobbyStartProblem(lobby(g, 7))).toMatch(/3–6 players/);
  });

  it('the C&K first-game board is 3-4 players', () => {
    const g = { ...withLobbyRules(defaultLobbyGame(), 'citiesKnights'), baseScenarioId: 'ckFirstGame' };
    expect(lobbyScenario(g)).toMatchObject({ minPlayers: 3, maxPlayers: 4 });
    expect(startedGame(lobby(g, 3)).settings.baseScenarioId).toBe('ckFirstGame');
  });

  it("Traders & Barbarians: each scenario's VP target and seat range", () => {
    const at = (id: string) => ({ ...withLobbyRules(defaultLobbyGame(), 'traders'), tradersScenarioId: id });
    expect(lobbyScenario(at('riversOfCatan'))).toMatchObject({ minPlayers: 3, maxPlayers: 6 });
    expect(lobbyScenario(at('riversOfCatan')).recommendedVp(4)).toBe(10);
    expect(lobbyScenario(at('merchantTrains')).recommendedVp(4)).toBe(12);
    expect(lobbyScenario(at('barbarianAttack')).recommendedVp(5)).toBe(12);
    expect(lobbyScenario(at('tradersAndBarbarians'))).toMatchObject({ minPlayers: 3, maxPlayers: 4 });
    expect(lobbyScenario(at('tradersAndBarbarians')).recommendedVp(4)).toBe(13);

    const game = startedGame(lobby(at('barbarianAttack'), 5));
    expect(game.settings).toMatchObject({
      expansions: ['traders'],
      tradersScenarioId: 'barbarianAttack',
      victoryPointsToWin: 12,
    });
    expect(game.barbarianAttack).toBeDefined();
  });

  it('variants stack on any rules; Strongest Ports adds 1 to the target; no Event Cards with C&K', () => {
    const base = { ...defaultLobbyGame(), variants: { friendlyRobber: true, strongestPorts: true, eventCards: true } };
    const l = lobby(base);
    expect(lobbyVpTarget(l)).toBe(11);
    const game = startedGame(l);
    expect(game.settings.victoryPointsToWin).toBe(11);
    expect(game.settings.tradersVariants).toEqual({ friendlyRobber: true, strongestPorts: true, eventCards: true });
    expect(game.eventCards).toBeDefined();

    const ck = withLobbyRules(base, 'citiesKnights');
    expect(ck.variants).toEqual({ friendlyRobber: true, strongestPorts: true, eventCards: false });
    expect(startedGame(lobby(ck)).settings.victoryPointsToWin).toBe(14);
  });

  it('no variants means no tradersVariants (the trained AI still plays the plain base game)', () => {
    const s = lobbySettings(lobby(defaultLobbyGame()));
    expect(s.tradersVariants).toBeUndefined();
    expect(s.aiLevel).toBeDefined();
    const withVariant = lobbySettings(lobby({ ...defaultLobbyGame(), variants: { friendlyRobber: true, strongestPorts: false, eventCards: false } }));
    expect(withVariant.aiLevel).toBeUndefined();
  });

  it('fills in a lobby from an older build (no C&K / T&B / variant fields)', () => {
    const old = { seafarers: true, scenarioId: 'fourIslands', baseScenarioId: 'standard' } as unknown as LobbyGame;
    const g = normalizeLobbyGame(old);
    expect(g).toMatchObject({ seafarers: true, scenarioId: 'fourIslands', citiesKnights: false, traders: false });
    expect(g.variants).toEqual({ friendlyRobber: false, strongestPorts: false, eventCards: false });
    expect(lobbySettings(lobby(g)).expansions).toEqual(['seafarers']);
  });
});
