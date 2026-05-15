import type { BoardState, Port } from '@/game/types';
import { getEdgeMidpoint, getPortMarkerPosition } from './boardLayout';
import { RESOURCE_ICON } from '@/ui/shared/ResourceChip';

interface Props {
  board: BoardState;
  port: Port;
}

const PORT_FILL: Record<string, string> = {
  generic: '#dad6c2',
  wood: 'var(--terrain-wood)',
  brick: 'var(--terrain-brick)',
  sheep: 'var(--terrain-sheep)',
  wheat: 'var(--terrain-wheat)',
  ore: 'var(--terrain-ore)',
};

export function PortMarker({ board, port }: Props) {
  const mid = getEdgeMidpoint(board, port.edge);
  const marker = getPortMarkerPosition(board, port.edge, 26);
  const ratio = port.type === 'generic' ? '3:1' : '2:1';
  const icon = port.type === 'generic' ? '?' : RESOURCE_ICON[port.type];

  return (
    <g className="port">
      {/* Dock lines from the two vertices of the coastal edge to the marker */}
      <line
        x1={board.vertices[board.edges[port.edge]!.vertices[0]]!.position.x}
        y1={board.vertices[board.edges[port.edge]!.vertices[0]]!.position.y}
        x2={marker.x}
        y2={marker.y}
        stroke="#3a3a3a"
        strokeWidth={1.5}
      />
      <line
        x1={board.vertices[board.edges[port.edge]!.vertices[1]]!.position.x}
        y1={board.vertices[board.edges[port.edge]!.vertices[1]]!.position.y}
        x2={marker.x}
        y2={marker.y}
        stroke="#3a3a3a"
        strokeWidth={1.5}
      />
      <circle
        cx={marker.x}
        cy={marker.y}
        r={18}
        fill={PORT_FILL[port.type]}
        stroke="#1a1a1a"
        strokeWidth={1.5}
      />
      <text
        x={marker.x}
        y={marker.y - 4}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={port.type === 'generic' ? 14 : 12}
        fontWeight={700}
        fill="#1a1a1a"
      >
        {icon}
      </text>
      <text
        x={marker.x}
        y={marker.y + 9}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        fill="#1a1a1a"
      >
        {ratio}
      </text>
      <text
        x={mid.x}
        y={mid.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={1}
        fill="transparent"
      >
        port-anchor
      </text>
    </g>
  );
}
