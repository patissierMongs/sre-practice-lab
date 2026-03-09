import React, { useMemo, useState } from 'react';

const STATE_COLORS = {
  'ESTAB': '#22c55e',
  'SYN-SENT': '#f59e0b',
  'SYN-RECV': '#ef4444',
  'FIN-WAIT-1': '#8b5cf6',
  'FIN-WAIT-2': '#8b5cf6',
  'TIME-WAIT': '#6b7280',
  'CLOSE-WAIT': '#f97316',
  'LAST-ACK': '#ec4899',
  'LISTEN': '#3b82f6',
  'CLOSING': '#ef4444',
  'UNCONN': '#6b7280',
};

function TcpTable({ systemState }) {
  const [filterState, setFilterState] = useState('all');
  const [sortBy, setSortBy] = useState('state');

  const tcpData = systemState?.network?.tcp_table || {};
  const connections = tcpData.connections || [];
  const stateCounts = tcpData.state_counts || {};
  const total = tcpData.total || 0;

  const filtered = useMemo(() => {
    let list = connections;
    if (filterState !== 'all') {
      list = list.filter(c => c.state === filterState);
    }
    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'state') return a.state.localeCompare(b.state);
      if (sortBy === 'local') return a.local_port.localeCompare(b.local_port);
      if (sortBy === 'peer') return a.peer_addr.localeCompare(b.peer_addr);
      if (sortBy === 'recv_q') return b.recv_q - a.recv_q;
      return 0;
    });
    return list;
  }, [connections, filterState, sortBy]);

  // Highlight dangerous states
  const synRecvCount = stateCounts['SYN-RECV'] || 0;
  const isSynFlood = synRecvCount > 10;

  return (
    <div className="tcp-table">
      {/* State summary bar */}
      <div className="tcp-summary">
        <div className="tcp-total">
          <span className="tcp-total-num">{total}</span>
          <span className="tcp-total-label">Total Connections</span>
        </div>
        <div className="tcp-states">
          {Object.entries(stateCounts).map(([state, count]) => (
            <button
              key={state}
              className={`tcp-state-chip ${filterState === state ? 'active' : ''} ${state === 'SYN-RECV' && isSynFlood ? 'danger' : ''}`}
              style={{ '--state-color': STATE_COLORS[state] || '#6b7280' }}
              onClick={() => setFilterState(filterState === state ? 'all' : state)}
            >
              <span className="chip-dot" />
              <span className="chip-state">{state}</span>
              <span className="chip-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SYN Flood warning */}
      {isSynFlood && (
        <div className="tcp-alert">
          SYN Flood detected: {synRecvCount} half-open connections (SYN-RECV)
        </div>
      )}

      {/* Connection table */}
      <div className="tcp-table-wrap">
        <table>
          <thead>
            <tr>
              <th className="tcp-th-sort" onClick={() => setSortBy('state')}>
                State {sortBy === 'state' && '\u25BC'}
              </th>
              <th className="tcp-th-sort" onClick={() => setSortBy('local')}>
                Local {sortBy === 'local' && '\u25BC'}
              </th>
              <th className="tcp-th-sort" onClick={() => setSortBy('peer')}>
                Peer {sortBy === 'peer' && '\u25BC'}
              </th>
              <th className="tcp-th-sort" onClick={() => setSortBy('recv_q')}>
                Recv-Q {sortBy === 'recv_q' && '\u25BC'}
              </th>
              <th>Send-Q</th>
              <th>Service</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="6" className="tcp-empty">No connections</td></tr>
            ) : (
              filtered.map((c, i) => (
                <tr key={i} className={c.state === 'SYN-RECV' && isSynFlood ? 'tcp-row-danger' : ''}>
                  <td>
                    <span
                      className="tcp-state-badge"
                      style={{ color: STATE_COLORS[c.state] || '#6b7280' }}
                    >
                      {c.state}
                    </span>
                  </td>
                  <td className="tcp-addr">{c.local_addr}:{c.local_port}</td>
                  <td className="tcp-addr">{c.peer_addr}:{c.peer_port}</td>
                  <td className={c.recv_q > 0 ? 'tcp-q-warn' : ''}>{c.recv_q}</td>
                  <td className={c.send_q > 0 ? 'tcp-q-warn' : ''}>{c.send_q}</td>
                  <td className="tcp-svc">{c.service}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TcpTable;
