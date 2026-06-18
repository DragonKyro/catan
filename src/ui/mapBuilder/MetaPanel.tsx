import type { CustomMap } from '@/game/customMap/types';
import './SidePanel.css';

interface Props {
  map: CustomMap;
  onUpdate: (patch: Partial<CustomMap>) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  derived: {
    landCount: number;
    seaCount: number;
    desertCount: number;
    portCount: number;
    poolDrawnTerrain: number;
    terrainPoolTotal: number;
    tokenSlots: number;
    tokenPoolTotal: number;
    portPoolTotal: number;
  };
}

export function MetaPanel({ map, onUpdate, radius, onRadiusChange, derived }: Props) {
  return (
    <div className="mb-panel">
      <h3>Map info</h3>
      <label className="mb-field">
        <span>Name</span>
        <input
          type="text"
          value={map.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </label>
      <label className="mb-field">
        <span>Id (filename slug)</span>
        <input
          type="text"
          value={map.id}
          onChange={(e) => onUpdate({ id: e.target.value })}
        />
      </label>
      <label className="mb-field">
        <span>Description</span>
        <textarea
          rows={2}
          value={map.description ?? ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
        />
      </label>
      <div className="mb-row">
        <label className="mb-field">
          <span>Min players</span>
          <input
            type="number"
            min={2}
            max={8}
            value={map.minPlayers}
            onChange={(e) => onUpdate({ minPlayers: Number(e.target.value) })}
          />
        </label>
        <label className="mb-field">
          <span>Max players</span>
          <input
            type="number"
            min={2}
            max={8}
            value={map.maxPlayers}
            onChange={(e) => onUpdate({ maxPlayers: Number(e.target.value) })}
          />
        </label>
        <label className="mb-field">
          <span>VP to win</span>
          <input
            type="number"
            min={3}
            max={25}
            value={map.defaultVpToWin ?? 10}
            onChange={(e) => onUpdate({ defaultVpToWin: Number(e.target.value) })}
          />
        </label>
      </div>
      <label className="mb-field mb-checkbox">
        <input
          type="checkbox"
          checked={map.seafarers}
          onChange={(e) => onUpdate({ seafarers: e.target.checked })}
        />
        <span>Seafarers (enables gold, fog, island chips)</span>
      </label>

      <h3>Disk radius</h3>
      <div className="mb-radius-buttons">
        {[3, 4, 5].map((r) => (
          <button
            key={r}
            className={'mb-radius-btn' + (radius === r ? ' mb-radius-active' : '')}
            onClick={() => onRadiusChange(r)}
          >
            r={r}
          </button>
        ))}
      </div>

      <h3>Counts</h3>
      <ul className="mb-stats">
        <li>Land: <b>{derived.landCount}</b></li>
        <li>Sea: <b>{derived.seaCount}</b></li>
        <li>Desert: <b>{derived.desertCount}</b></li>
        <li>Ports: <b>{derived.portCount}</b></li>
      </ul>
    </div>
  );
}
