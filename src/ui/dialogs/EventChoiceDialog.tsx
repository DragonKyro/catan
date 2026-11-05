import { useState, type ReactElement } from 'react';
import type { PlayerId, Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { useCanAct } from '@/ui/shared/useCanAct';
import { playerColorVar } from '@/ui/shared/playerColors';
import { totalResources } from '@/game/resources';
import { EVENT_CARD_INFO } from '@/game/modules/traders/variants/eventCards/deck';
import './EventChoiceDialog.css';

// Catan Event Cards: the answer an event waits for from the seat whose turn
// it is to answer — take a resource (Plentiful Year, Calm Seas,
// Tournament), give one (Good Neighbors: to your left; Helpful Neighbor: to
// a player you pick), steal (Conflict, Trade Advantage; you may pass), or
// damage a road (Earthquake: click one of your roads on the board).
export function EventChoiceDialog() {
  const { game, dispatch } = useGameStore();
  const [recipient, setRecipient] = useState<PlayerId | null>(null);
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  const pending = game?.eventCards?.pending;
  if (!game || !acting || game.phase !== 'eventResolution' || !pending) return null;
  const choice = pending.choices[0];
  if (!choice) return null;
  const info = EVENT_CARD_INFO[pending.card.kind];
  const name = (id: PlayerId) => game.players.find((p) => p.id === id)?.name ?? id;
  const title = `${info.icon} ${info.name} (${pending.card.number})`;
  if (!canAct) {
    return (
      <DialogShell title={title} blocking>
        <p className="eventdlg-text">{info.text}</p>
        <p className="eventdlg-soft">Waiting for {name(acting)}…</p>
      </DialogShell>
    );
  }
  const me = game.players.find((p) => p.id === acting)!;
  const answer = (extra: { resource?: Resource; target?: PlayerId | null }) => {
    setRecipient(null);
    dispatch({ type: 'resolveEvent', playerId: acting, ...extra });
  };

  let body: ReactElement;
  switch (choice.kind) {
    case 'takeResource':
      body = (
        <>
          <p className="eventdlg-ask">{me.name}: take 1 resource of your choice from the supply.</p>
          <div className="eventdlg-row">
            {RESOURCES.map((r) => (
              <Button key={r} size="sm" disabled={game.bank[r] <= 0} onClick={() => answer({ resource: r })}>
                <ResourceChip resource={r} count={game.bank[r]} size="sm" />
              </Button>
            ))}
          </div>
        </>
      );
      break;
    case 'giveResource': {
      const recipients = choice.recipients ?? [];
      const to = recipients.length === 1 ? recipients[0]! : recipient;
      body = (
        <>
          <p className="eventdlg-ask">
            {me.name}: give 1 resource of your choice
            {recipients.length === 1
              ? ` to ${name(recipients[0]!)}${pending.card.kind === 'goodNeighbors' ? ' (on your left)' : ' (fewer VPs)'}.`
              : ' to a player with fewer VPs — pick who first.'}
          </p>
          {recipients.length > 1 && (
            <div className="eventdlg-row">
              {recipients.map((id) => {
                const p = game.players.find((x) => x.id === id)!;
                return (
                  <Button
                    key={id}
                    size="sm"
                    variant={recipient === id ? 'primary' : 'secondary'}
                    onClick={() => setRecipient(id)}
                  >
                    <span className="eventdlg-dot" style={{ background: playerColorVar(p.color) }} />
                    {p.name}
                  </Button>
                );
              })}
            </div>
          )}
          <div className="eventdlg-row">
            {RESOURCES.map((r) => (
              <Button
                key={r}
                size="sm"
                disabled={me.resources[r] <= 0 || !to}
                onClick={() => answer({ resource: r, target: to })}
              >
                <ResourceChip resource={r} count={me.resources[r]} size="sm" />
              </Button>
            ))}
          </div>
          {!to && <p className="eventdlg-soft">Pick who receives it first.</p>}
        </>
      );
      break;
    }
    case 'steal': {
      const victims = game.players.filter((p) => p.id !== acting && totalResources(p.resources) > 0);
      body = (
        <>
          <p className="eventdlg-ask">{me.name}: steal 1 random resource from a player of your choice.</p>
          <div className="eventdlg-row">
            {victims.map((p) => (
              <Button key={p.id} size="sm" onClick={() => answer({ target: p.id })}>
                <span className="eventdlg-dot" style={{ background: playerColorVar(p.color) }} />
                {p.name} ({totalResources(p.resources)})
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => answer({ target: null })}>
              Don't steal
            </Button>
          </div>
        </>
      );
      break;
    }
    case 'damageRoad':
      body = (
        <p className="eventdlg-ask">
          {me.name}: click one of your roads (outlined in amber on the board) to damage it. You'll need to repair
          it (1 brick + 1 wood) before building more roads.
        </p>
      );
      break;
  }

  return (
    <DialogShell title={title} blocking>
      <p className="eventdlg-text">{info.text}</p>
      {body}
    </DialogShell>
  );
}
