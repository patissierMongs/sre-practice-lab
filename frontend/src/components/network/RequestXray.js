import React, { useState } from 'react';

const LAYER_COLORS = {
  nginx: '#26a69a',
  middleware: '#ab47bc',
  handler: '#42a5f5',
  database: '#66bb6a',
  redis: '#ef5350',
};

const LAYER_ICONS = {
  nginx: '\u26A1',
  middleware: '\u{1F6E1}',
  handler: '\u2699',
  database: '\u{1F5C4}',
  redis: '\u{1F534}',
};

const RESULT_STYLES = {
  forwarded: 'result-pass',
  clean: 'result-pass',
  passed: 'result-pass',
  committed: 'result-pass',
  sanitized: 'result-warn',
  detected: 'result-danger',
  blocked: 'result-danger',
  passed_vulnerable: 'result-danger',
  error: 'result-danger',
};

function TraceFlowNode({ layer, index, total, expanded, onToggle }) {
  const color = LAYER_COLORS[layer.layer] || '#78909c';
  const icon = LAYER_ICONS[layer.layer] || '\u2022';
  const resultClass = RESULT_STYLES[layer.result] || 'result-neutral';
  const isLast = index === total - 1;

  return (
    <div className="xray-trace-node">
      {/* Vertical connector line */}
      <div className="xray-trace-connector">
        <div className="xray-trace-dot" style={{ borderColor: color, backgroundColor: `${color}33` }} />
        {!isLast && <div className="xray-trace-line" style={{ borderColor: `${color}66` }} />}
      </div>

      {/* Node content */}
      <div className={`xray-trace-content ${expanded ? 'expanded' : ''}`} onClick={onToggle}>
        <div className="xray-trace-header">
          <span className="xray-trace-icon">{icon}</span>
          <span className="xray-trace-layer" style={{ color }}>{layer.layer}</span>
          <span className="xray-trace-action">{layer.action}</span>
          <span className={`xray-trace-result ${resultClass}`}>{layer.result}</span>
          <span className="xray-trace-duration">{layer.duration_ms}ms</span>
        </div>

        {expanded && (
          <div className="xray-trace-detail">
            <div className="xray-trace-detail-text">{layer.detail}</div>
            {layer.metadata && Object.keys(layer.metadata).length > 0 && (
              <div className="xray-trace-metadata">
                {Object.entries(layer.metadata).map(([key, val]) => (
                  <span key={key} className="xray-meta-tag">
                    {key}: {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TraceCard({ trace, isSelected, onSelect }) {
  const attackColors = {
    xss: '#ff9800',
    sqli: '#f44336',
    ddos: '#e91e63',
    normal: '#4caf50',
    recon: '#9c27b0',
  };

  const statusColor = trace.status_code < 300 ? '#66bb6a'
    : trace.status_code < 400 ? '#42a5f5'
    : trace.status_code < 500 ? '#ffb74d'
    : '#ef5350';

  const time = trace.timestamp ? new Date(trace.timestamp).toLocaleTimeString() : '';

  return (
    <div
      className={`xray-trace-card ${isSelected ? 'selected' : ''} ${trace.attack_type !== 'normal' ? 'attack' : ''}`}
      onClick={() => onSelect(trace.trace_id)}
    >
      <div className="xray-trace-card-header">
        <span className="xray-trace-method">{trace.method}</span>
        <span className="xray-trace-path">{trace.path}</span>
        <span className="xray-trace-status" style={{ color: statusColor }}>{trace.status_code}</span>
      </div>
      <div className="xray-trace-card-footer">
        <span className="xray-trace-time">{time}</span>
        <span className="xray-trace-total-ms">{trace.total_duration_ms}ms</span>
        {trace.attack_type !== 'normal' && (
          <span className="xray-attack-badge" style={{ backgroundColor: attackColors[trace.attack_type] || '#9e9e9e' }}>
            {trace.attack_type.toUpperCase()}
          </span>
        )}
        <span className="xray-trace-layers-count">{trace.layers?.length || 0} layers</span>
      </div>
    </div>
  );
}

function RequestXray({ traces }) {
  const [selectedId, setSelectedId] = useState(null);
  const [expandedLayers, setExpandedLayers] = useState({});
  const [filterAttack, setFilterAttack] = useState('all');

  const selectedTrace = traces.find(t => t.trace_id === selectedId);

  const filteredTraces = filterAttack === 'all'
    ? traces
    : traces.filter(t => t.attack_type === filterAttack);

  const toggleLayer = (index) => {
    setExpandedLayers(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const selectTrace = (id) => {
    setSelectedId(id);
    setExpandedLayers({});
  };

  return (
    <div className="xray-request-panel">
      {/* Trace List */}
      <div className="xray-trace-list">
        <div className="xray-trace-list-header">
          <span className="xray-trace-list-title">Request Traces</span>
          <div className="xray-filter-row">
            {['all', 'normal', 'xss', 'sqli', 'ddos'].map(f => (
              <button
                key={f}
                className={`xray-filter-btn ${filterAttack === f ? 'active' : ''}`}
                onClick={() => setFilterAttack(f)}
              >
                {f === 'all' ? 'All' : f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="xray-trace-list-body">
          {filteredTraces.length === 0 && (
            <div className="xray-empty">No traces yet. Send some requests!</div>
          )}
          {[...filteredTraces].reverse().map(trace => (
            <TraceCard
              key={trace.trace_id}
              trace={trace}
              isSelected={selectedId === trace.trace_id}
              onSelect={selectTrace}
            />
          ))}
        </div>
      </div>

      {/* Trace Detail - X-ray Flow */}
      <div className="xray-trace-detail-panel">
        {!selectedTrace ? (
          <div className="xray-empty xray-detail-empty">
            <div className="xray-empty-icon">{'\uD83D\uDD0D'}</div>
            <div>Select a trace to see the X-ray flow</div>
          </div>
        ) : (
          <>
            <div className="xray-detail-header">
              <span className="xray-trace-method">{selectedTrace.method}</span>
              <span className="xray-trace-path">{selectedTrace.path}</span>
              <span className="xray-trace-status" style={{
                color: selectedTrace.status_code < 300 ? '#66bb6a' : selectedTrace.status_code < 500 ? '#ffb74d' : '#ef5350'
              }}>
                {selectedTrace.status_code}
              </span>
              <span className="xray-trace-total-ms">{selectedTrace.total_duration_ms}ms</span>
            </div>

            <div className="xray-flow-diagram">
              {/* Source */}
              <div className="xray-trace-node xray-trace-source">
                <div className="xray-trace-connector">
                  <div className="xray-trace-dot xray-trace-dot-source" />
                  <div className="xray-trace-line" />
                </div>
                <div className="xray-trace-content">
                  <div className="xray-trace-header">
                    <span className="xray-trace-icon">{'\uD83C\uDF10'}</span>
                    <span className="xray-trace-layer">Client</span>
                    <span className="xray-trace-action">{selectedTrace.source_ip}</span>
                  </div>
                </div>
              </div>

              {/* Layers */}
              {(selectedTrace.layers || []).map((layer, i) => (
                <TraceFlowNode
                  key={i}
                  layer={layer}
                  index={i}
                  total={selectedTrace.layers.length}
                  expanded={!!expandedLayers[i]}
                  onToggle={() => toggleLayer(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RequestXray;
