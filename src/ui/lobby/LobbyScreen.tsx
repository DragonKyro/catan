import { useEffect, useState } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import { roomLink, type LobbyState } from '@/net';
import { Button } from '@/ui/shared/Button';
import { ChatPanel } from '@/ui/chat/ChatPanel';
import { PLAYER_COLOR_LABEL, playerColorVar } from '@/ui/shared/playerColors';
import { ColorPicker } from '@/ui/shared/ColorPicker';
import { MenuBadge } from '@/ui/menu/MenuBadge';
import { AI_LEVEL_LABEL } from '@/ai/nn/levelInfo';
import { InfoTip } from '@/ui/shared/InfoTip';
import { RULE_OPTION_TEXT, TWO_PLAYER_INFO } from '@/ui/shared/ruleOptions';
import {
  LOBBY_RULES,
  LOBBY_RULE_OPTIONS,
  LOBBY_TRADERS_VARIANTS,
  MAX_SEATS,
  type LobbyVariantId,
  ONLINE_SEAFARERS_SCENARIOS,
  ONLINE_TRADERS_SCENARIOS,
  type LobbyRules,
  lobbyBaseMaps,
  lobbyUsesTrainedAi,
  lobbyRules,
  lobbyScenario,
  lobbyStartProblem,
  lobbyVariantBlockReason,
  lobbyVariantLabels,
  lobbyVariantOn,
  lobbyVp,
  lobbyVpTarget,
  withLobbyRules,
} from '@/store/lobbyGame';
import './LobbyScreen.css';

/** Creating a room, or a guest looking it up. Never shown as an (empty) lobby. */
function JoiningCard() {
  const { roomCode, role, leaveRoom } = useNetworkStore();
  const creating = role === 'host';
  return (
    <div className="lobby-wrap lobby-wrap-single">
      <div className="lobby-card">
        <header className="lobby-header">
          <Button variant="ghost" size="sm" onClick={leaveRoom}>← Cancel</Button>
          <div className="lobby-roomcode-wrap">
            <span className="lobby-roomcode-label">{creating ? 'Creating a room' : 'Joining room'}</span>
            {roomCode && <div className="lobby-roomcode lobby-roomcode-static">{roomCode}</div>}
          </div>
          <span className="lobby-badge">
            <MenuBadge kind="online" />
          </span>
        </header>
        <div className="lobby-status">Connecting to the game server…</div>
      </div>
    </div>
  );
}

function ErrorCard() {
  const { errorMessage, joinFailure, clearError, retryJoin } = useNetworkStore();
  return (
    <div className="lobby-wrap lobby-wrap-single">
      <div className="lobby-card">
        <header className="lobby-header">
          <Button variant="ghost" size="sm" onClick={clearError}>
            ← Back
          </Button>
          <div className="lobby-roomcode-wrap" />
          <span className="lobby-badge">
            <MenuBadge kind="online" />
          </span>
        </header>
        {joinFailure && (
          <h3 className="lobby-error-title">
            {joinFailure.reason === 'unreachable' ? "Can't reach the game server" : `Room ${joinFailure.code} not found`}
          </h3>
        )}
        <div className="lobby-status" style={{ whiteSpace: 'pre-wrap' }}>
          {errorMessage ?? 'Connection error.'}
        </div>
        {joinFailure?.detail && <p className="lobby-debug">{joinFailure.detail}</p>}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={joinFailure?.reason === 'unreachable' ? retryJoin : clearError}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

const VP_COMMIT_DELAY_MS = 600;

/** The game the room will play: the host picks it, everyone else sees it. */
function GameSettings({ lobby, isHost }: { lobby: LobbyState; isHost: boolean }) {
  const { hostSetGame, hostSetVP } = useNetworkStore();
  const info = lobbyScenario(lobby.game);
  const recommended = info.recommendedVp(lobby.seats.length);
  const vp = lobbyVp(lobby);
  // What the host is typing; sent once they pause (or leave the field),
  // not once per keystroke.
  const [vpDraft, setVpDraft] = useState<string | null>(null);
  const commitVp = (draft: string) => {
    setVpDraft(null);
    const n = Math.round(Number(draft));
    const next = n > 0 ? Math.max(3, Math.min(20, n)) : recommended;
    if (next !== vp) hostSetVP(next);
  };
  useEffect(() => {
    if (vpDraft === null) return;
    const t = setTimeout(() => commitVp(vpDraft), VP_COMMIT_DELAY_MS);
    return () => clearTimeout(t);
    // Restart the wait on each keystroke only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vpDraft]);
  const hasAi = lobby.seats.some((s) => s.isAI);
  const trainedAi = lobbyUsesTrainedAi(lobby);
  const rules = lobbyRules(lobby.game);
  const variants = lobbyVariantLabels(lobby);
  // Two seats on the base game: colonist.io's 1v1 rules.
  const twoPlayer = lobby.seats.length === 2 && rules === 'base';

  if (!isHost) {
    return (
      <div className="lobby-settings">
        <h3>Game</h3>
        <p className="lobby-summary">
          {info.name} · {lobbyVpTarget(lobby)} VP to win
          {twoPlayer && (
            <>
              {' · 1v1 rules'}
              <InfoTip text={TWO_PLAYER_INFO} label="Two-player rules" />
            </>
          )}
          {variants.length > 0 && ` · ${variants.join(', ')}`}
          {hasAi && trainedAi && ` · ${AI_LEVEL_LABEL.hard} AI`}
        </p>
      </div>
    );
  }

  return (
    <div className="lobby-settings">
      <h3>Game</h3>
      <label className="lobby-vp">
        <span>Rules</span>
        <select
          value={rules}
          onChange={(e) => hostSetGame(withLobbyRules(lobby.game, e.target.value as LobbyRules))}
        >
          {LOBBY_RULES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      {rules === 'seafarers' && (
        <label className="lobby-vp">
          <span>Scenario</span>
          <select
            value={lobby.game.scenarioId}
            onChange={(e) => hostSetGame({ ...lobby.game, scenarioId: e.target.value })}
          >
            {ONLINE_SEAFARERS_SCENARIOS.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {rules === 'traders' && (
        <label className="lobby-vp">
          <span>Scenario</span>
          <select
            value={lobby.game.tradersScenarioId}
            onChange={(e) => hostSetGame({ ...lobby.game, tradersScenarioId: e.target.value })}
          >
            {ONLINE_TRADERS_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {(rules === 'base' || rules === 'citiesKnights') && (
        <label className="lobby-vp">
          <span>Map</span>
          <select
            value={lobby.game.baseScenarioId}
            onChange={(e) => hostSetGame({ ...lobby.game, baseScenarioId: e.target.value })}
          >
            {lobbyBaseMaps(lobby.game).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {rules === 'traders' && (
        <OptionGroup
          label="Variants"
          aria="Traders & Barbarians variants"
          ids={LOBBY_TRADERS_VARIANTS}
          lobby={lobby}
          onToggle={(id, on) => hostSetGame({ ...lobby.game, variants: { ...lobby.game.variants, [id]: on } })}
        />
      )}
      <OptionGroup
        label="Rule options"
        aria="Rule options"
        ids={LOBBY_RULE_OPTIONS}
        lobby={lobby}
        onToggle={(id, on) => hostSetGame({ ...lobby.game, variants: { ...lobby.game.variants, [id]: on } })}
        note={twoPlayer ? <InfoTip text={TWO_PLAYER_INFO} label="Two-player rules" /> : null}
      />
      <label className="lobby-vp">
        <span>
          Victory points to win{' '}
          <span className="lobby-vp-hint">
            (recommended {recommended}
            {lobbyVariantOn(lobby, 'strongestPorts') && ', +1 for Strongest Ports'}
            {twoPlayer && lobby.victoryPointsToWin === null && ', 1v1 rules'})
          </span>
        </span>
        <span className="lobby-vp-controls">
          {lobby.victoryPointsToWin !== null && lobby.victoryPointsToWin !== recommended && (
            <Button size="sm" variant="ghost" onClick={() => hostSetVP(null)}>
              Reset
            </Button>
          )}
          <input
            type="number"
            min={3}
            max={20}
            value={vpDraft ?? vp}
            onChange={(e) => setVpDraft(e.target.value)}
            onBlur={() => vpDraft !== null && commitVp(vpDraft)}
          />
        </span>
      </label>
    </div>
  );
}

export function LobbyScreen() {
  const {
    role,
    roomCode,
    lobby,
    onlineUuids,
    serverConnected,
    hostAddAISeat,
    hostRemoveSeat,
    hostStartGame,
    setSeatColor,
    leaveRoom,
    connection,
    myUuid,
  } = useNetworkStore();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<number | null>(null);

  if (connection === 'error') return <ErrorCard />;
  if (connection === 'connecting') return <JoiningCard />;

  const isHost = role === 'host';
  const problem = lobbyStartProblem(lobby);

  const flash = (what: 'code' | 'link') => {
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };
  const copyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      flash('code');
    } catch {
      /* ignore */
    }
  };
  // Phones get the share sheet; elsewhere the link goes to the clipboard.
  const shareLink = async () => {
    if (!roomCode) return;
    const url = roomLink(roomCode);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Catan', text: `Join my Catan room ${roomCode}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        flash('link');
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="lobby-wrap">
      <div className="lobby-card">
        <header className="lobby-header">
          <Button variant="ghost" size="sm" onClick={leaveRoom}>← Leave</Button>
          <div className="lobby-roomcode-wrap">
            <span className="lobby-roomcode-label">Room</span>
            <button type="button" className="lobby-roomcode" onClick={copyCode}>
              {roomCode}
              <span className="lobby-roomcode-copy">{copied === 'code' ? '✓ copied' : 'click to copy'}</span>
            </button>
          </div>
          <span className="lobby-badge">
            <MenuBadge kind="online" />
          </span>
        </header>
        <div className="lobby-share">
          <Button size="sm" variant="ghost" onClick={shareLink}>
            {copied === 'link' ? '✓ Link copied' : '🔗 Share invite link'}
          </Button>
        </div>

        <div className="lobby-seats">
          <h3>Players ({lobby.seats.length} / {MAX_SEATS})</h3>
          {lobby.seats.map((seat, i) => {
            const online = seat.isAI || (seat.uuid !== null && onlineUuids.has(seat.uuid));
            // Your own color, and (host) the AI seats' colors.
            const canRecolor = !lobby.started && (seat.uuid === myUuid || (isHost && seat.isAI));
            const picking = canRecolor && colorPickerFor === i;
            return (
              <div key={`${seat.uuid ?? seat.name}-${i}`} className="lobby-seat">
                <span className="lobby-seat-swatch-wrap">
                  {canRecolor ? (
                    <button
                      type="button"
                      className="lobby-seat-swatch lobby-seat-swatch-btn"
                      style={{ background: playerColorVar(seat.color) }}
                      onClick={() => setColorPickerFor(picking ? null : i)}
                      aria-label={`Change color (${PLAYER_COLOR_LABEL[seat.color]})`}
                      aria-expanded={picking}
                      title={`${PLAYER_COLOR_LABEL[seat.color]} — click to change`}
                    />
                  ) : (
                    <span className="lobby-seat-swatch" style={{ background: playerColorVar(seat.color) }} />
                  )}
                  {picking && (
                    <ColorPicker
                      value={seat.color}
                      taken={lobby.seats.filter((_, j) => j !== i).map((s) => s.color)}
                      onPick={(c) => {
                        setSeatColor(i, c);
                        setColorPickerFor(null);
                      }}
                    />
                  )}
                </span>
                <span className="lobby-seat-name">
                  {seat.name}
                  {seat.isAI && <span className="lobby-seat-tag">AI</span>}
                  {!seat.isAI && (
                    <span className={`lobby-seat-dot ${online ? 'online' : 'offline'}`} />
                  )}
                </span>
                {isHost && i > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => hostRemoveSeat(i)}>
                    ×
                  </Button>
                )}
              </div>
            );
          })}
          {isHost && lobby.seats.length < MAX_SEATS && (
            <Button size="sm" onClick={hostAddAISeat}>+ Add AI seat</Button>
          )}
        </div>

        <GameSettings lobby={lobby} isHost={isHost} />

        {problem && <p className="lobby-problem">{problem}</p>}
        {lobby.started && <p className="lobby-status">Starting…</p>}
        {!isHost && !lobby.started && <p className="lobby-status">Waiting for the host to start…</p>}

        {isHost && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={problem !== null || lobby.started === true}
            onClick={() => void hostStartGame()}
          >
            Start game
          </Button>
        )}

        {!serverConnected && <p className="lobby-debug">Reconnecting to the game server…</p>}
      </div>

      <div className="lobby-chat-wrap">
        <ChatPanel />
      </div>
    </div>
  );
}

/** A row of option checkboxes, each with an ⓘ saying what it does (host only). */
function OptionGroup({
  label,
  aria,
  ids,
  lobby,
  onToggle,
  note,
}: {
  label: string;
  aria: string;
  ids: LobbyVariantId[];
  lobby: LobbyState;
  onToggle: (id: LobbyVariantId, on: boolean) => void;
  note?: React.ReactNode;
}) {
  return (
    <div className="lobby-variants" role="group" aria-label={aria}>
      <span className="lobby-variants-label">
        {label}
        {note}
      </span>
      {ids.map((id) => {
        const blocked = lobbyVariantBlockReason(lobby.game, id);
        const text = RULE_OPTION_TEXT[id];
        return (
          <label key={id} className="lobby-variant" title={blocked ?? undefined}>
            <input
              type="checkbox"
              aria-label={text.label}
              checked={lobbyVariantOn(lobby, id)}
              disabled={blocked !== null}
              onChange={(e) => onToggle(id, e.target.checked)}
            />
            <span>{text.label}</span>
            <InfoTip text={blocked ? `${blocked}. ${text.info}` : text.info} label={text.label} />
          </label>
        );
      })}
    </div>
  );
}
