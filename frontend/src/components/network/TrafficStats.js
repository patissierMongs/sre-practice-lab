import React, { useState, useEffect } from 'react';
import api from '../../api';

function TrafficStats({ packets, capturing, onToggleCapture }) {
  const [stats, setStats] = useState({
    total_packets: 0,
    passed: 0,
    blocked: 0,
    requests_per_second: 0,
    avg_response_time_ms: 0,
    error_rate: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      api.get('/traffic/stats').then(res => setStats(res.data)).catch(() => {});
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const passedPct = stats.total_packets > 0
    ? ((stats.passed / stats.total_packets) * 100).toFixed(1)
    : 0;

  return (
    <div className="traffic-stats-bar">
      <div className="stat-item" onClick={onToggleCapture} style={{ cursor: 'pointer' }}>
        <span className={`capture-dot ${capturing ? 'active' : ''}`} />
        <span className="stat-label">{capturing ? 'CAPTURING' : 'PAUSED'}</span>
      </div>

      <div className="stat-item">
        <span className="stat-value">{stats.requests_per_second}</span>
        <span className="stat-label">req/s</span>
      </div>

      <div className="stat-item">
        <span className="stat-value">{stats.total_packets}</span>
        <span className="stat-label">Total</span>
      </div>

      <div className="stat-item">
        <span className="stat-value" style={{ color: '#00c853' }}>{stats.passed}</span>
        <span className="stat-label">Passed</span>
      </div>

      <div className="stat-item">
        <span className="stat-value" style={{ color: '#ff4444' }}>{stats.blocked}</span>
        <span className="stat-label">Blocked</span>
      </div>

      <div className="stat-item stat-bar-container">
        <div className="stat-progress-bar">
          <div className="stat-progress-fill" style={{ width: `${passedPct}%` }} />
        </div>
        <span className="stat-label">{passedPct}% passed</span>
      </div>

      <div className="stat-item">
        <span className="stat-value">{stats.avg_response_time_ms}</span>
        <span className="stat-label">Avg(ms)</span>
      </div>

      <div className="stat-item">
        <span className="stat-value" style={{ color: stats.error_rate > 5 ? '#ff4444' : '#aaa' }}>
          {stats.error_rate}%
        </span>
        <span className="stat-label">Errors</span>
      </div>
    </div>
  );
}

export default TrafficStats;
