import React from 'react';

/**
 * Popup that appears when a particle is clicked.
 * Shows packet payload, headers, trace info.
 */
function ParticleInspector({ packet, position, onClose }) {
  if (!packet) return null;

  const statusColor = packet.status_code < 300 ? '#66bb6a'
    : packet.status_code < 400 ? '#42a5f5'
    : packet.status_code < 500 ? '#ffb74d'
    : '#ef5350';

  const time = packet.timestamp ? new Date(packet.timestamp).toLocaleTimeString() : '';

  return (
    <div
      className="particle-inspector"
      style={{
        left: Math.min(position.x, window.innerWidth - 380),
        top: Math.min(position.y + 10, window.innerHeight - 400),
      }}
    >
      <div className="pi-header">
        <span className="pi-method">{packet.method}</span>
        <span className="pi-path">{packet.path}</span>
        <span className="pi-status" style={{ color: statusColor }}>{packet.status_code}</span>
        <button className="pi-close" onClick={onClose}>{'\u2715'}</button>
      </div>

      <div className="pi-body">
        {/* General Info */}
        <div className="pi-section">
          <div className="pi-section-title">General</div>
          <div className="pi-row"><span>Time</span><span>{time}</span></div>
          <div className="pi-row"><span>Source</span><span>{packet.source_ip}:{packet.source_port}</span></div>
          <div className="pi-row"><span>Dest</span><span>{packet.dest_service}:{packet.dest_port}</span></div>
          <div className="pi-row"><span>Layer</span><span>{packet.layer}</span></div>
          <div className="pi-row"><span>Duration</span><span>{packet.response_time_ms}ms</span></div>
          <div className="pi-row"><span>Size</span><span>{packet.size_bytes || 0}B</span></div>
          {packet.blocked && (
            <div className="pi-row pi-row-danger">
              <span>Blocked</span>
              <span>{packet.block_reason || 'Yes'}</span>
            </div>
          )}
        </div>

        {/* Request Headers */}
        {packet.request_headers && Object.keys(packet.request_headers).length > 0 && (
          <div className="pi-section">
            <div className="pi-section-title">Request Headers</div>
            {Object.entries(packet.request_headers).slice(0, 10).map(([k, v]) => (
              <div key={k} className="pi-row pi-row-mono">
                <span>{k}</span>
                <span>{String(v).substring(0, 60)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Request Body */}
        {packet.request_body && (
          <div className="pi-section">
            <div className="pi-section-title">Request Body</div>
            <pre className="pi-payload">{packet.request_body}</pre>
          </div>
        )}

        {/* Response Body */}
        {packet.response_body && (
          <div className="pi-section">
            <div className="pi-section-title">Response Body</div>
            <pre className="pi-payload">{packet.response_body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default ParticleInspector;
