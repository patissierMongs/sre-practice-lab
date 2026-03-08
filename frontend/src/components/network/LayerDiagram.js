import React from 'react';

function MeterBar({ value, max, label, color = '#4fc3f7' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="xray-meter">
      <div className="xray-meter-label">
        <span>{label}</span>
        <span className="xray-meter-value" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="xray-meter-track">
        <div
          className="xray-meter-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function StatBox({ label, value, unit, color }) {
  return (
    <div className="xray-stat-box">
      <div className="xray-stat-value" style={color ? { color } : {}}>{value}</div>
      <div className="xray-stat-label">{label}{unit ? ` (${unit})` : ''}</div>
    </div>
  );
}

function LayerDiagram({ systemState }) {
  if (!systemState) {
    return (
      <div className="xray-layers xray-loading">
        <div className="xray-loading-text">Connecting to system...</div>
      </div>
    );
  }

  const { network, nginx, application, database, redis } = systemState;

  // Network layer
  const ports = network?.open_ports || [];
  const iptables = network?.iptables_rules || [];
  const connections = network?.active_connections || {};
  const chainRules = iptables.filter(r => r.type === 'chain');
  const ruleCount = iptables.filter(r => r.type === 'rule').length;

  // DB layer
  const dbPoolSize = database?.pool_size || 20;
  const dbCheckedOut = database?.pool_checked_out || 0;
  const dbActiveQueries = database?.active_queries || 0;
  const cacheHitRatio = database?.cache_hit_ratio || 0;

  // Redis layer
  const redisClients = redis?.connected_clients || 0;
  const redisMemory = redis?.used_memory_human || '0B';
  const redisHitRate = redis?.hit_rate || 0;

  return (
    <div className="xray-layers">
      {/* Network Layer */}
      <div className="xray-layer xray-layer-network">
        <div className="xray-layer-header">
          <span className="xray-layer-icon">&#x1F310;</span>
          <span className="xray-layer-title">Network Layer</span>
          <span className="xray-layer-badge">{Object.values(connections).reduce((a, b) => a + b, 0)} conns</span>
        </div>
        <div className="xray-layer-body xray-layer-cols">
          <div className="xray-section">
            <div className="xray-section-title">Open Ports</div>
            <div className="xray-port-list">
              {ports.length > 0 ? ports.map((p, i) => (
                <span key={i} className="xray-port-badge">:{p.port}</span>
              )) : <span className="xray-dim">No ports detected</span>}
            </div>
          </div>
          <div className="xray-section">
            <div className="xray-section-title">iptables</div>
            <div className="xray-iptables">
              {chainRules.map((c, i) => (
                <div key={i} className="xray-chain">
                  <span className="xray-chain-name">{c.chain}</span>
                  <span className={`xray-chain-policy ${c.policy === 'ACCEPT' ? 'accept' : 'drop'}`}>
                    {c.policy}
                  </span>
                </div>
              ))}
              {ruleCount > 0 && <div className="xray-dim">{ruleCount} rules active</div>}
            </div>
          </div>
          <div className="xray-section">
            <div className="xray-section-title">Connections</div>
            <div className="xray-conn-list">
              {Object.entries(connections).map(([svc, count]) => (
                <div key={svc} className="xray-conn-item">
                  <span>{svc}</span>
                  <span className="xray-conn-count">{count}</span>
                </div>
              ))}
              {Object.keys(connections).length === 0 && <span className="xray-dim">No active connections</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Flow Arrow */}
      <div className="xray-flow-arrow">
        <svg width="24" height="32" viewBox="0 0 24 32">
          <path d="M12 0 L12 24 M6 18 L12 26 L18 18" stroke="#4fc3f7" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {/* Nginx Layer */}
      <div className="xray-layer xray-layer-nginx">
        <div className="xray-layer-header">
          <span className="xray-layer-icon">&#x26A1;</span>
          <span className="xray-layer-title">Nginx Reverse Proxy</span>
          <span className="xray-layer-badge">{nginx?.blocked_recent || 0} blocked</span>
        </div>
        <div className="xray-layer-body">
          <div className="xray-stats-row">
            <StatBox label="Rate Limit" value={nginx?.rate_limit_zones?.[0]?.rate || '30r/m'} />
            <StatBox label="Burst" value={nginx?.rate_limit_zones?.[0]?.burst || 20} />
            <StatBox label="Conn Limit" value={nginx?.conn_limit?.max || 10} />
            <StatBox label="Passed" value={nginx?.passed_recent || 0} color="#66bb6a" />
            <StatBox label="Blocked" value={nginx?.blocked_recent || 0} color="#ef5350" />
          </div>
          <div className="xray-nginx-headers">
            {(nginx?.security_headers || []).map((h, i) => (
              <span key={i} className="xray-header-badge">{h.split(':')[0]}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Flow Arrow */}
      <div className="xray-flow-arrow">
        <svg width="24" height="32" viewBox="0 0 24 32">
          <path d="M12 0 L12 24 M6 18 L12 26 L18 18" stroke="#4fc3f7" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {/* Application Layer */}
      <div className="xray-layer xray-layer-app">
        <div className="xray-layer-header">
          <span className="xray-layer-icon">&#x2699;</span>
          <span className="xray-layer-title">Application Layer</span>
          <span className="xray-layer-badge">{application?.active_requests || 0} req/s</span>
        </div>
        <div className="xray-layer-body">
          <div className="xray-stats-row">
            <StatBox label="Avg Latency" value={application?.avg_response_time_ms || 0} unit="ms" />
            <StatBox label="Error Rate" value={application?.error_rate || 0} unit="%" color={application?.error_rate > 5 ? '#ef5350' : undefined} />
            <StatBox label="Total Req" value={application?.total_packets || 0} />
          </div>
          <div className="xray-middleware-chain">
            <span className="xray-mw-label">Middleware:</span>
            <span className="xray-mw-item">CORS</span>
            <span className="xray-mw-arrow">&rarr;</span>
            <span className="xray-mw-item">TrafficCapture</span>
            <span className="xray-mw-arrow">&rarr;</span>
            <span className={`xray-mw-item ${application?.xss_protection ? 'active' : 'inactive'}`}>
              XSS {application?.xss_protection ? 'ON' : 'OFF'}
            </span>
            <span className="xray-mw-arrow">&rarr;</span>
            <span className={`xray-mw-item ${application?.rate_limiting ? 'active' : 'inactive'}`}>
              RateLimit {application?.rate_limiting ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Flow Arrow */}
      <div className="xray-flow-arrow">
        <svg width="24" height="32" viewBox="0 0 24 32">
          <path d="M12 0 L12 24 M6 18 L12 26 L18 18" stroke="#4fc3f7" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {/* Database Layer */}
      <div className="xray-layer xray-layer-db">
        <div className="xray-layer-header">
          <span className="xray-layer-icon">&#x1F5C4;</span>
          <span className="xray-layer-title">Database Layer</span>
        </div>
        <div className="xray-layer-body xray-layer-cols">
          <div className="xray-section xray-db-section">
            <div className="xray-section-title">PostgreSQL</div>
            <MeterBar value={dbCheckedOut} max={dbPoolSize} label="Connection Pool" color="#66bb6a" />
            <div className="xray-stats-row">
              <StatBox label="Active Queries" value={dbActiveQueries} />
              <StatBox label="Cache Hit" value={`${cacheHitRatio}%`} color={cacheHitRatio > 90 ? '#66bb6a' : '#ffb74d'} />
              <StatBox label="Commits" value={database?.xact_commit || 0} />
              <StatBox label="Rollbacks" value={database?.xact_rollback || 0} color={database?.xact_rollback > 0 ? '#ef5350' : undefined} />
            </div>
          </div>
          <div className="xray-section xray-redis-section">
            <div className="xray-section-title">Redis</div>
            <div className="xray-stats-row">
              <StatBox label="Clients" value={redisClients} />
              <StatBox label="Memory" value={redisMemory} />
              <StatBox label="Hit Rate" value={`${redisHitRate}%`} color={redisHitRate > 80 ? '#66bb6a' : '#ffb74d'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LayerDiagram;
