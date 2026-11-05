// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { defaultLobbyGame, withLobbyRules } from '@/store/lobbyGame';
import type { LobbyGame, LobbyState } from '@/net/types';
import { LobbyScreen } from './LobbyScreen';

// The lobby's game settings for each rule set, as the host and as a guest.
function showLobby(game: LobbyGame, role: 'host' | 'guest') {
  const me = role === 'host' ? 'host-uuid' : 'guest-uuid';
  const lobby: LobbyState = {
    hostUuid: 'host-uuid',
    seats: [
      { uuid: 'host-uuid', name: 'Hana', isAI: false, color: 'red' },
      { uuid: 'guest-uuid', name: 'Gus', isAI: false, color: 'blue' },
      { uuid: null, name: 'AI 1', isAI: true, color: 'white' },
    ],
    victoryPointsToWin: null,
    seed: 1,
    game,
  };
  useNetworkStore.setState({ connection: 'lobby', role, myUuid: me, roomCode: 'ABCD', lobby });
  render(<LobbyScreen />);
}

function select(label: string): HTMLSelectElement {
  return within(screen.getByText(label, { selector: 'span' }).closest('label')!).getByRole(
    'combobox',
  ) as HTMLSelectElement;
}

afterEach(cleanup);

describe('online lobby game settings', () => {
  it('the host picks any of the five rule sets', () => {
    showLobby(defaultLobbyGame(), 'host');
    const rules = select('Rules');
    expect([...rules.options].map((o) => o.text)).toEqual([
      'Base game',
      'Seafarers',
      'Cities & Knights',
      'Traders & Barbarians',
      'Explorers & Pirates',
    ]);
  });

  it('Cities & Knights: C&K maps, and no Event Cards', () => {
    showLobby(withLobbyRules(defaultLobbyGame(), 'citiesKnights'), 'host');
    const maps = [...select('Map').options].map((o) => o.value);
    expect(maps).toContain('ckFirstGame');
    expect(maps).not.toContain('volcano');
    const box = (name: RegExp) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
    expect(box(/Catan Event Cards/).disabled).toBe(true);
    expect(box(/Friendly Robber/).disabled).toBe(false);
  });

  it('Explorers & Pirates: no map or scenario choice, and no variants', () => {
    showLobby(withLobbyRules(defaultLobbyGame(), 'explorersPirates'), 'host');
    expect(screen.queryByLabelText('Map')).toBeNull();
    expect(screen.queryByLabelText('Scenario')).toBeNull();
    const box = (name: RegExp) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
    expect(box(/Friendly Robber/).disabled).toBe(true);
    expect(box(/Catan Event Cards/).disabled).toBe(true);
  });

  it('Traders & Barbarians: every scenario', () => {
    showLobby(withLobbyRules(defaultLobbyGame(), 'traders'), 'host');
    const scenarios = [...select('Scenario').options].map((o) => o.value);
    expect(scenarios).toEqual([
      'riversOfCatan',
      'fishingOnCatan',
      'merchantTrains',
      'barbarianAttack',
      'tradersAndBarbarians',
    ]);
  });

  it("a guest sees the game, the real VP target and the variants", () => {
    const game = {
      ...withLobbyRules(defaultLobbyGame(), 'traders'),
      tradersScenarioId: 'merchantTrains',
      variants: { friendlyRobber: true, strongestPorts: true, eventCards: false },
    };
    showLobby(game, 'guest');
    // getByText throws when the summary isn't there.
    screen.getByText(/Traders & Barbarians: Merchant Trains · 13 VP to win · Friendly Robber, Strongest Ports/);
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
