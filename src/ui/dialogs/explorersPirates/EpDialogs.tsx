import { useState, type ReactNode } from 'react';
import type { EpCargo, GameState, PlayerId, VertexId } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';
import { useCanAct } from '@/ui/shared/useCanAct';
import { cargoUnits, farmCount, harborsAtShip, isExplorersPirates } from '@/game/modules/explorersPirates/state';
import { EP_CAPACITY } from '@/game/modules/explorersPirates/constants';
import { CargoIcon, EP_CARGO_LABEL, EpShipIcon, HarborIcon } from '@/ui/game/explorersPirates/EpArt';
import { epSelectedShip } from '@/ui/game/explorersPirates/shipActions';
import { CoinIcon } from '@/ui/game/traders/TradersIcons';

// Explorers & Pirates dialogs opened from the ActionBar: Fast Gold (1 card
// → 1 gold) and moving pieces between a ship and the harbor settlement next
// to it. Both are seat-gated with useCanAct.

export function EpFastGoldDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  if (!game || !acting || !canAct || !isExplorersPirates(game) || game.phase !== 'main') return null;
  const player = game.players.find((p) => p.id === acting)!;
  const allowed = farmCount(game, acting, 'fastGold');
  const left = allowed - game.explorersPirates.fastGoldUsed;
  return (
    <DialogShell title="Fast Gold" onClose={closeDialog} footer={<Button onClick={closeDialog}>Done</Button>}>
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Your crew on a Fast Gold spice farm lets you trade 1 resource card for 1 gold
        {allowed > 1 ? ' (twice a turn with both farms)' : ' once a turn'}. {left} left this turn.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {RESOURCES.map((r) => {
          const ok = left > 0 && player.resources[r] > 0;
          return (
            <Button
              key={r}
              size="sm"
              disabled={!ok}
              title={ok ? `Give 1 ${RESOURCE_LABEL[r].toLowerCase()} for 1 gold` : `No ${RESOURCE_LABEL[r].toLowerCase()} to give`}
              onClick={() => dispatch({ type: 'epFastGold', playerId: acting, give: r })}
            >
              <ResourceChip resource={r} count={1} size="sm" dimmed={!ok} />
              <span aria-hidden> →</span> <CoinIcon size={14} />
            </Button>
          );
        })}
      </div>
    </DialogShell>
  );
}

// Which side each piece ends up on; indices into the ship / harbor cargo.
interface Plan {
  harbor: VertexId;
  load: number[]; // harbor cargo → ship
  unload: number[]; // ship cargo → harbor
}

export function EpTransferDialog() {
  const { game, dispatch, closeDialog, uiMode } = useGameStore();
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  const [plan, setPlan] = useState<Plan | null>(null);
  if (!game || !acting || !canAct || !isExplorersPirates(game) || game.phase !== 'epMovement') return null;
  const ship = epSelectedShip(game, acting, uiMode.kind === 'epMove' ? uiMode.ship : undefined);
  if (!ship) return null;
  const harbors = harborsAtShip(game, ship);
  if (harbors.length === 0) return null;
  const current: Plan = plan && harbors.includes(plan.harbor) ? plan : { harbor: harbors[0]!, load: [], unload: [] };
  const harborCargo = game.explorersPirates.harbors[current.harbor] ?? [];
  const color = game.players.find((p) => p.id === acting)!.color;

  const shipAfter: EpCargo[] = [
    ...ship.cargo.filter((_, i) => !current.unload.includes(i)),
    ...current.load.map((i) => harborCargo[i]!),
  ];
  const harborAfter: EpCargo[] = [
    ...harborCargo.filter((_, i) => !current.load.includes(i)),
    ...current.unload.map((i) => ship.cargo[i]!),
  ];
  const fits = cargoUnits(shipAfter) <= EP_CAPACITY && cargoUnits(harborAfter) <= EP_CAPACITY;
  const changed = current.load.length + current.unload.length > 0;
  const toggle = (side: 'load' | 'unload', i: number) => {
    const list = current[side];
    setPlan({ ...current, [side]: list.includes(i) ? list.filter((x) => x !== i) : [...list, i] });
  };
  const cell = (pieces: readonly EpCargo[], side: 'load' | 'unload', moving: number[]) =>
    pieces.length === 0 ? (
      <span style={{ color: 'var(--text-soft)', fontSize: '0.85em' }}>empty</span>
    ) : (
      pieces.map((c, i) => (
        <Button
          key={i}
          size="sm"
          variant={moving.includes(i) ? 'primary' : undefined}
          onClick={() => toggle(side, i)}
          title={`${moving.includes(i) ? 'Keep' : 'Move'} the ${EP_CARGO_LABEL[c]}`}
        >
          <CargoIcon piece={c} color={color} size={16} /> {EP_CARGO_LABEL[c]} {side === 'unload' ? '→' : '←'}
        </Button>
      ))
    );
  return (
    <DialogShell
      title="Load / unload"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!changed || !fits}
            onClick={() => {
              dispatch({
                type: 'epTransfer',
                playerId: acting,
                ship: ship.id,
                harbor: current.harbor,
                load: current.load.map((i) => harborCargo[i]!),
                unload: current.unload.map((i) => ship.cargo[i]!),
              });
              setPlan(null);
            }}
          >
            Move pieces
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Pick the pieces to move. Ships and harbor settlements each hold 1 large piece (settler, fish haul) or 2 small
        ones (crews, spice sacks).
      </p>
      {harbors.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {harbors.map((h, i) => (
            <Button
              key={h}
              size="sm"
              variant={h === current.harbor ? 'primary' : undefined}
              onClick={() => setPlan({ harbor: h, load: [], unload: [] })}
            >
              Harbor {i + 1}
            </Button>
          ))}
        </div>
      )}
      <TransferRow icon={<EpShipIcon color={color} size={22} cargo={shipAfter} />} label="Ship" after={shipAfter}>
        {cell(ship.cargo, 'unload', current.unload)}
      </TransferRow>
      <TransferRow icon={<HarborIcon color={color} size={22} />} label="Harbor" after={harborAfter}>
        {cell(harborCargo, 'load', current.load)}
      </TransferRow>
      {!fits && (
        <p style={{ marginBottom: 0, color: '#ff8a80', fontSize: '0.85em' }}>Not enough room — move fewer pieces.</p>
      )}
    </DialogShell>
  );
}

function TransferRow({
  icon,
  label,
  after,
  children,
}: {
  icon: ReactNode;
  label: string;
  after: readonly EpCargo[];
  children: ReactNode;
}) {
  const full = cargoUnits(after) >= EP_CAPACITY;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
      {icon}
      <strong style={{ minWidth: 52 }}>{label}</strong>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>{children}</div>
      <span style={{ fontSize: '0.8em', color: full ? 'var(--accent)' : 'var(--text-soft)' }}>
        {cargoUnits(after)}/{EP_CAPACITY}
      </span>
    </div>
  );
}

// Victims for the E&P pirate (RobberStealDialog), with what they'd lose.
export function epVictimNote(game: GameState, pid: PlayerId): string {
  const p = game.players.find((x) => x.id === pid);
  if (!p) return '';
  const cards = RESOURCES.reduce((n, r) => n + p.resources[r], 0);
  return cards > 0 ? `${cards} card${cards === 1 ? '' : 's'}` : 'no cards: 1 gold';
}
