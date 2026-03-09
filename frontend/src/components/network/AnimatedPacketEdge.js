import React, { memo, useMemo } from 'react';
import { getBezierPath, BaseEdge } from 'reactflow';

/**
 * Custom edge that renders animated packet dots along the path.
 * Props.data.packets: array of { id, color, progress }
 */
function AnimatedPacketEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd, data,
}) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  const activeDots = data?.activeDots || [];
  const edgeColor = activeDots.length > 0 ? '#58a6ff' : (style?.stroke || '#30363d');

  return (
    <>
      {/* Base edge line */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...style, stroke: edgeColor, strokeWidth: activeDots.length > 0 ? 2.5 : 1.5 }}
        markerEnd={markerEnd}
      />

      {/* Glow effect when active */}
      {activeDots.length > 0 && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeColor}
          strokeWidth="6"
          strokeOpacity="0.15"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Animated dots along the path */}
      {activeDots.map((dot) => (
        <circle key={dot.id} r="5" fill={dot.color} style={{ filter: `drop-shadow(0 0 4px ${dot.color})` }}>
          <animateMotion
            dur={`${dot.speed || 0.8}s`}
            begin={`${dot.delay || 0}s`}
            fill="freeze"
            path={edgePath}
            keyPoints="0;1"
            keyTimes="0;1"
          />
          <animate
            attributeName="r"
            values="5;3;0"
            keyTimes="0;0.7;1"
            dur={`${dot.speed || 0.8}s`}
            begin={`${dot.delay || 0}s`}
            fill="freeze"
          />
          <animate
            attributeName="opacity"
            values="1;1;0"
            keyTimes="0;0.8;1"
            dur={`${dot.speed || 0.8}s`}
            begin={`${dot.delay || 0}s`}
            fill="freeze"
          />
        </circle>
      ))}

      {/* Traffic counter badge */}
      {data?.trafficCount > 0 && (
        <g>
          <rect
            x={(sourceX + targetX) / 2 - 14}
            y={(sourceY + targetY) / 2 - 10}
            width="28"
            height="16"
            rx="8"
            fill="#21262d"
            stroke="#30363d"
            strokeWidth="1"
          />
          <text
            x={(sourceX + targetX) / 2}
            y={(sourceY + targetY) / 2 + 2}
            textAnchor="middle"
            fill="#8b949e"
            fontSize="9"
            fontFamily="monospace"
          >
            {data.trafficCount}
          </text>
        </g>
      )}
    </>
  );
}

export default memo(AnimatedPacketEdge);
