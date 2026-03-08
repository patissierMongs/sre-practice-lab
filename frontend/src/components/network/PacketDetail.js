import React, { useState } from 'react';

function TreeSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="tree-section">
      <div className="tree-header" onClick={() => setOpen(!open)}>
        <span className="tree-arrow">{open ? '▼' : '▶'}</span>
        <span className="tree-title">{title}</span>
      </div>
      {open && <div className="tree-content">{children}</div>}
    </div>
  );
}

function HeadersView({ headers }) {
  if (!headers || Object.keys(headers).length === 0) {
    return <div className="tree-value">( 없음 )</div>;
  }
  return (
    <div className="headers-list">
      {Object.entries(headers).map(([k, v]) => (
        <div key={k} className="header-row">
          <span className="header-key">{k}:</span>
          <span className="header-value">{v}</span>
        </div>
      ))}
    </div>
  );
}

function PacketDetail({ packet }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!packet) {
    return (
      <div className="packet-detail-empty">
        <div className="empty-icon">📋</div>
        <p>패킷을 선택하면 상세 정보가 표시됩니다</p>
      </div>
    );
  }

  if (showRaw) {
    return (
      <div className="packet-detail">
        <div className="detail-toolbar">
          <h3>Packet #{packet.id} - Raw</h3>
          <button className="filter-btn active" onClick={() => setShowRaw(false)}>Tree View</button>
        </div>
        <pre className="raw-view">{JSON.stringify(packet, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div className="packet-detail">
      <div className="detail-toolbar">
        <h3>Packet #{packet.id}</h3>
        <button className="filter-btn" onClick={() => setShowRaw(true)}>Raw JSON</button>
      </div>

      <TreeSection title="General" defaultOpen={true}>
        <div className="tree-row">
          <span className="tree-label">Source</span>
          <span className="tree-value">{packet.source_ip}:{packet.source_port}</span>
        </div>
        <div className="tree-row">
          <span className="tree-label">Destination</span>
          <span className="tree-value">{packet.dest_service}:{packet.dest_port}</span>
        </div>
        <div className="tree-row">
          <span className="tree-label">Timestamp</span>
          <span className="tree-value">{packet.timestamp}</span>
        </div>
        <div className="tree-row">
          <span className="tree-label">Layer</span>
          <span className={`layer-badge layer-${packet.layer}`}>{packet.layer}</span>
        </div>
        <div className="tree-row">
          <span className="tree-label">Blocked</span>
          <span className="tree-value">
            {packet.blocked ? (
              <span style={{ color: '#ff4444' }}>Yes - {packet.block_reason}</span>
            ) : (
              <span style={{ color: '#00c853' }}>No</span>
            )}
          </span>
        </div>
      </TreeSection>

      <TreeSection title="Request" defaultOpen={true}>
        <div className="tree-row">
          <span className="tree-label">Method</span>
          <span className={`method-badge method-${packet.method}`}>{packet.method}</span>
        </div>
        <div className="tree-row">
          <span className="tree-label">Path</span>
          <span className="tree-value">{packet.path}</span>
        </div>
        {packet.query_params && (
          <div className="tree-row">
            <span className="tree-label">Query</span>
            <span className="tree-value">{packet.query_params}</span>
          </div>
        )}
        <TreeSection title={`Headers (${Object.keys(packet.request_headers || {}).length})`}>
          <HeadersView headers={packet.request_headers} />
        </TreeSection>
        {packet.request_body && (
          <TreeSection title="Body">
            <pre className="body-preview">{packet.request_body}</pre>
          </TreeSection>
        )}
      </TreeSection>

      <TreeSection title="Response" defaultOpen={true}>
        <div className="tree-row">
          <span className="tree-label">Status</span>
          <span className={`status-badge status-${Math.floor(packet.status_code / 100)}xx`}>
            {packet.status_code}
          </span>
        </div>
        <TreeSection title={`Headers (${Object.keys(packet.response_headers || {}).length})`}>
          <HeadersView headers={packet.response_headers} />
        </TreeSection>
        {packet.response_body && (
          <TreeSection title="Body">
            <pre className="body-preview">{packet.response_body}</pre>
          </TreeSection>
        )}
      </TreeSection>

      <TreeSection title="Timing" defaultOpen={true}>
        <div className="tree-row">
          <span className="tree-label">Response Time</span>
          <span className="tree-value">{packet.response_time_ms}ms</span>
        </div>
        <div className="tree-row">
          <span className="tree-label">Size</span>
          <span className="tree-value">{packet.size_bytes} bytes</span>
        </div>
      </TreeSection>
    </div>
  );
}

export default PacketDetail;
