import type { EpMission, ExplorersPiratesState, PlayerId } from '../../types';
import type { EpBoardSetup } from './board';
import { EP_FISH_HAULS, EP_MISSIONS } from './constants';

export function initialExplorersPiratesState(
  setup: EpBoardSetup,
  playerIds: PlayerId[],
): ExplorersPiratesState {
  const perMission = <T>(value: () => T): Record<EpMission, T> =>
    Object.fromEntries(EP_MISSIONS.map((m) => [m, value()])) as Record<EpMission, T>;
  return {
    hidden: setup.hidden,
    regionOf: setup.regionOf,
    discs: setup.discs,
    lairTokens: setup.lairTokens,
    councilHex: setup.councilHex,
    councilAnchors: setup.councilAnchors,
    startIsland: setup.startIsland,
    frameHexes: setup.frameHexes,
    harborSites: setup.harborSites,
    harbors: {},
    ships: [],
    nextShipId: 1,
    pirate: null,
    lairs: [],
    farms: [],
    shoals: [],
    fishSupply: EP_FISH_HAULS,
    tracks: perMission(() => Object.fromEntries(playerIds.map((p) => [p, 0]))),
    arrivals: perMission(() => ({})),
    trackSeq: 0,
    pendingLairs: [],
    fastGoldUsed: 0,
  };
}
