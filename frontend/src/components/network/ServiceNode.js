import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const statusColors = {
  running: '#00c853',
  exited: '#ff4444',
  restarting: '#ff9800',
  unknown: '#666',
};

function ServiceNode({ data }) {
  const borderColor = statusColors[data.status] || statusColors.unknown;
  const ports = data.ports || [];

  return (
    <div className="service-node" style={{ borderColor }}>
      <Handle type="target" position={Position.Left} className="node-handle" />

      <div className="node-header">
        <span className="node-icon">{data.icon}</span>
        <span className="node-name">{data.name}</span>
        <span className="node-status" style={{ background: borderColor }} />
      </div>

      {ports.length > 0 && (
        <div className="node-ports">
          {ports.map((p, i) => (
            <span key={i} className="node-port">
              :{p.container}
              {p.host && <span className="port-mapping"> → :{p.host}</span>}
            </span>
          ))}
        </div>
      )}

      {data.networks && data.networks.length > 0 && (
        <div className="node-network">
          {data.networks[0].ip && <span className="node-ip">{data.networks[0].ip}</span>}
        </div>
      )}

      {data.reqPerSec !== undefined && (
        <div className="node-rps">
          <span className="rps-value">{data.reqPerSec}</span> req/s
        </div>
      )}

      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}

export default memo(ServiceNode);
