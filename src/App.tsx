import { useEffect } from 'react';
import { type DialogName, type UIMode, useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { useReplayStore } from '@/store/replayStore';
import { HomeMenu } from '@/ui/newGame/HomeMenu';
import { LobbyScreen } from '@/ui/lobby/LobbyScreen';
import { GameView } from '@/ui/game/GameView';
import { ReplayScreen } from '@/ui/replay/ReplayScreen';
import { getSavedDisplayName, roomCodeFromUrl } from '@/net';
import {
  ScenarioPreviewPage,
  buildPreviewGameForView,
  parsePreviewQuery,
} from '@/ui/mapBuilder/ScenarioPreview';

/** A page opened (or reloaded) with ?room=ABCD rejoins that room, if this device has a name to join with. */
function useRejoinFromUrl(): void {
  useEffect(() => {
    const code = roomCodeFromUrl();
    const name = getSavedDisplayName();
    const net = useNetworkStore.getState();
    if (code && name && net.connection === 'disconnected' && !useGameStore.getState().game) {
      void net.joinRoom(code, name);
    }
  }, []);
}

// `?preview=<kind>:<id>` renders one scenario's board full-window (map
// checks against the rulebook; see ScenarioPreview.tsx). With `view=game`
// the fast-forwarded position is loaded into the normal game screen
// instead. Read once.
const PREVIEW_SPEC = typeof window === 'undefined' ? null : parsePreviewQuery(window.location.search);
if (PREVIEW_SPEC?.view === 'game') {
  const previewGame = buildPreviewGameForView(PREVIEW_SPEC);
  useGameStore.getState().setGameState(previewGame);
  // One human at this device: skip the hot-seat "pass the device" screen.
  useGameStore.setState({ handoffAcknowledgedForPlayer: previewGame.players[0]!.id });
  // `&dialog=<name>` opens a dialog for screenshots (e.g. progressCards).
  // `&mode=<kind>` puts the board in a click mode (e.g. recruitKnight).
  const params = new URLSearchParams(window.location.search);
  const dialog = params.get('dialog');
  if (dialog) useGameStore.setState({ dialog: dialog as DialogName });
  const mode = params.get('mode');
  if (mode) useGameStore.setState({ uiMode: { kind: mode } as UIMode });
}

export default function App() {
  const game = useGameStore((s) => s.game);
  const connection = useNetworkStore((s) => s.connection);
  const replayData = useReplayStore((s) => s.data);
  useRejoinFromUrl();

  if (PREVIEW_SPEC && PREVIEW_SPEC.view !== 'game') {
    return <ScenarioPreviewPage spec={PREVIEW_SPEC} />;
  }

  // Replay overrides everything — it's a top-level view triggered either
  // from GameOver ("Watch replay") or HomeMenu ("Load replay"). Exiting
  // replay restores whichever underlying view is active.
  if (replayData) {
    return (
      <div className="app-root">
        <ReplayScreen />
      </div>
    );
  }
  // Game running takes priority over network screens.
  if (game) {
    return (
      <div className="app-root">
        <GameView />
      </div>
    );
  }
  // In a network session before game starts → lobby (or "connecting"/"error"
  // placeholder; the lobby screen knows how to render each).
  if (
    connection === 'lobby' ||
    connection === 'connecting' ||
    connection === 'error'
  ) {
    return (
      <div className="app-root">
        <LobbyScreen />
      </div>
    );
  }
  return (
    <div className="app-root">
      <HomeMenu />
    </div>
  );
}
