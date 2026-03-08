import React, { useState, useEffect, useRef } from 'react';

const STATUS_COLORS = {
  2: '#1b3a2a',   // 2xx: 초록
  3: '#1a2a3a',   // 3xx: 파랑
  4: '#3a2a1a',   // 4xx: 주황
  5: '#3a1a1a',   // 5xx: 빨강
};

const BLOCKED_COLOR = '#3a1a2a';
const RATE_LIMITED_COLOR = '#2a1a3a';  // 429: 보라

function getRowColor(packet) {
  if (packet.blocked) return BLOCKED_COLOR;
  if (packet.status_code === 429) return RATE_LIMITED_COLOR;
  const category = Math.floor(packet.status_code / 100);
  return STATUS_COLORS[category] || 'transparent';
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('ko-KR', { hour12: false, fractionalSecondDigits: 3 });
  } catch {
    return timestamp;
  }
}

function PacketList({ packets, selectedPacket, onSelectPacket, filter, onFilterChange }) {
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [packets, autoScroll]);

  const filtered = packets.filter(p => {
    if (filter.method && p.method !== filter.method) return false;
    if (filter.path && !p.path.toLowerCase().includes(filter.path.toLowerCase())) return false;
    if (filter.statusMin && p.status_code < parseInt(filter.statusMin)) return false;
    if (filter.statusMax && p.status_code > parseInt(filter.statusMax)) return false;
    return true;
  });

  return (
    <div className="packet-list-container">
      {/* 필터 바 */}
      <div className="packet-filter-bar">
        <select
          value={filter.method}
          onChange={e => onFilterChange({ ...filter, method: e.target.value })}
          className="filter-select"
        >
          <option value="">Method</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          type="text"
          placeholder="Path filter..."
          value={filter.path}
          onChange={e => onFilterChange({ ...filter, path: e.target.value })}
          className="filter-input"
        />
        <input
          type="number"
          placeholder="Status min"
          value={filter.statusMin}
          onChange={e => onFilterChange({ ...filter, statusMin: e.target.value })}
          className="filter-input filter-narrow"
        />
        <input
          type="number"
          placeholder="Status max"
          value={filter.statusMax}
          onChange={e => onFilterChange({ ...filter, statusMax: e.target.value })}
          className="filter-input filter-narrow"
        />
        <button
          className={`filter-btn ${autoScroll ? 'active' : ''}`}
          onClick={() => setAutoScroll(!autoScroll)}
          title="Auto-scroll"
        >
          {autoScroll ? '⏬' : '⏸'}
        </button>
      </div>

      {/* 패킷 테이블 */}
      <div className="packet-table-wrapper" ref={listRef}>
        <table className="packet-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Time</th>
              <th>Source</th>
              <th>Dest</th>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th>Size</th>
              <th>Time(ms)</th>
              <th>Layer</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr
                key={p.id}
                className={`packet-row ${selectedPacket?.id === p.id ? 'selected' : ''}`}
                style={{ backgroundColor: getRowColor(p) }}
                onClick={() => onSelectPacket(p)}
              >
                <td>{p.id}</td>
                <td>{formatTime(p.timestamp)}</td>
                <td className="mono">{p.source_ip}</td>
                <td className="mono">{p.dest_service}:{p.dest_port}</td>
                <td><span className={`method-badge method-${p.method}`}>{p.method}</span></td>
                <td className="path-cell" title={p.path}>{p.path}</td>
                <td>
                  <span className={`status-badge status-${Math.floor(p.status_code / 100)}xx`}>
                    {p.status_code}
                  </span>
                  {p.blocked && <span className="blocked-icon" title={p.block_reason}>🚫</span>}
                </td>
                <td>{p.size_bytes > 1024 ? `${(p.size_bytes / 1024).toFixed(1)}K` : p.size_bytes}</td>
                <td>{p.response_time_ms}</td>
                <td><span className={`layer-badge layer-${p.layer}`}>{p.layer}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="packet-empty">
            {packets.length === 0 ? '패킷 대기 중... 트래픽이 발생하면 여기에 표시됩니다.' : '필터에 맞는 패킷이 없습니다.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default PacketList;
