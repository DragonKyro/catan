import type { PortType, Resource } from '@/game/types';
import type { Tool } from './useBuilderState';
import './Toolbar.css';

const RESOURCES: Resource[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
const PORTS: PortType[] = ['generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'];

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  seafarers: boolean;
}

const TERRAIN_LABEL: Record<string, string> = {
  land: 'Land',
  sea: 'Sea',
  desert: 'Desert',
  wood: '🌲 Wood',
  brick: '🧱 Brick',
  sheep: '🐑 Sheep',
  wheat: '🌾 Wheat',
  ore: '⛰ Ore',
  gold: '⭐ Gold',
};

const PORT_LABEL: Record<string, string> = {
  generic: '3:1',
  wood: '🌲 2:1',
  brick: '🧱 2:1',
  sheep: '🐑 2:1',
  wheat: '🌾 2:1',
  ore: '⛰ 2:1',
};

export function Toolbar({ tool, setTool, seafarers }: Props) {
  const isActive = (predicate: boolean) => (predicate ? ' mb-tool-active' : '');

  return (
    <div className="mb-toolbar">
      <section className="mb-tool-group">
        <h4>Position</h4>
        <button
          className={'mb-tool' + isActive(tool.kind === 'paint' && tool.terrain === 'land')}
          onClick={() => setTool({ kind: 'paint', terrain: 'land' })}
        >
          {TERRAIN_LABEL.land}
        </button>
        <button
          className={'mb-tool' + isActive(tool.kind === 'paint' && tool.terrain === 'sea')}
          onClick={() => setTool({ kind: 'paint', terrain: 'sea' })}
        >
          {TERRAIN_LABEL.sea}
        </button>
        <button
          className={'mb-tool' + isActive(tool.kind === 'paint' && tool.terrain === 'desert')}
          onClick={() => setTool({ kind: 'paint', terrain: 'desert' })}
        >
          {TERRAIN_LABEL.desert}
        </button>
        <button
          className={'mb-tool mb-tool-danger' + isActive(tool.kind === 'erase')}
          onClick={() => setTool({ kind: 'erase' })}
        >
          ✕ Erase
        </button>
      </section>

      <section className="mb-tool-group">
        <h4>Pin terrain</h4>
        {RESOURCES.map((r) => (
          <button
            key={r}
            className={'mb-tool' + isActive(tool.kind === 'paintTerrain' && tool.terrain === r)}
            onClick={() => setTool({ kind: 'paintTerrain', terrain: r })}
          >
            {TERRAIN_LABEL[r]}
          </button>
        ))}
        {seafarers && (
          <button
            className={'mb-tool' + isActive(tool.kind === 'paintTerrain' && tool.terrain === 'gold')}
            onClick={() => setTool({ kind: 'paintTerrain', terrain: 'gold' })}
          >
            {TERRAIN_LABEL.gold}
          </button>
        )}
      </section>

      <section className="mb-tool-group">
        <h4>Pin token</h4>
        <button
          className={'mb-tool' + isActive(tool.kind === 'token' && tool.value === null)}
          onClick={() => setTool({ kind: 'token', value: null })}
        >
          —
        </button>
        {[2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((n) => (
          <button
            key={n}
            className={'mb-tool' + isActive(tool.kind === 'token' && tool.value === n)}
            onClick={() => setTool({ kind: 'token', value: n })}
          >
            {n}
          </button>
        ))}
      </section>

      <section className="mb-tool-group">
        <h4>Ports</h4>
        {PORTS.map((p) => (
          <button
            key={p}
            className={'mb-tool' + isActive(tool.kind === 'port' && tool.type === p)}
            onClick={() => setTool({ kind: 'port', type: p })}
          >
            {PORT_LABEL[p]}
          </button>
        ))}
      </section>

      {seafarers && (
        <section className="mb-tool-group">
          <h4>Fog</h4>
          <button
            className={'mb-tool' + isActive(tool.kind === 'fog')}
            onClick={() => setTool({ kind: 'fog' })}
          >
            ☁ Toggle fog
          </button>
        </section>
      )}
    </div>
  );
}
