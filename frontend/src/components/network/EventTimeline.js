import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * EventTimeline — Attack-Defense causality timeline
 *
 * Correlates Red Team attacks → system detection → Blue Team defense → results
 * into a unified chronological event stream.
 */

// Event types and their visual config
const EVENT_STYLES = {
  attack_start:  { icon: '\u26A1', color: '#ef4444', bg: '#2a0a0a', label: 'Attack' },
  attack_stop:   { icon: '\u23F9', color: '#f97316', bg: '#2a1a0a', label: 'Stopped' },
  detection:     { icon: '\uD83D\uDEA8', color: '#eab308', bg: '#2a2a0a', label: 'Detected' },
  defense:       { icon: '\uD83D\uDEE1\uFE0F', color: '#3b82f6', bg: '#0a1a2a', label: 'Defense' },
  blocked:       { icon: '\u26D4', color: '#ef4444', bg: '#2a0a0a', label: 'Blocked' },
  system:        { icon: '\u2699\uFE0F', color: '#8b5cf6', bg: '#1a0a2a', label: 'System' },
  recovery:      { icon: '\u2705', color: '#22c55e', bg: '#0a2a0a', label: 'Recovery' },
};

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function EventTimeline({ packets, traces, systemState }) {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const listRef = useRef(null);
  const prevStateRef = useRef({});
  const eventIdRef = useRef(0);

  // Derive events from packets, traces, and systemState changes
  const addEvent = useCallback((type, message, detail = null) => {
    eventIdRef.current++;
    setEvents(prev => {
      const next = [...prev, {
        id: eventIdRef.current,
        type,
        message,
        detail,
        timestamp: Date.now(),
      }];
      // Keep last 200 events
      return next.length > 200 ? next.slice(-150) : next;
    });
  }, []);

  // Monitor traces for attack detection
  useEffect(() => {
    if (!traces || traces.length === 0) return;
    const latest = traces[traces.length - 1];
    if (!latest) return;

    // Check if this trace represents an attack
    if (latest.attack_type === 'xss') {
      const layer = (latest.layers || []).find(l => l.action?.includes('xss'));
      addEvent('detection', `XSS payload detected on ${latest.path}`,
        layer ? `${layer.result}: ${layer.detail || 'pattern matched'}` : null);
    } else if (latest.attack_type === 'sqli') {
      const layer = (latest.layers || []).find(l => l.detail?.includes('injection'));
      addEvent('detection', `SQL injection attempt on ${latest.path}`,
        layer ? layer.detail : null);
    } else if (latest.attack_type === 'ddos') {
      addEvent('blocked', `Rate limited: ${latest.method} ${latest.path}`,
        `Status ${latest.status_code}, ${latest.total_duration_ms?.toFixed(0)}ms`);
    }
  }, [traces, addEvent]);

  // Monitor systemState for defense changes
  useEffect(() => {
    if (!systemState) return;
    const prev = prevStateRef.current;

    const net = systemState.network || {};
    const kd = net.kernel_drops || {};
    const tcp = net.tcp_table || {};
    const synRecv = (tcp.state_counts || {})['SYN-RECV'] || 0;
    const drops = kd.iptables_drops || 0;
    const rejects = kd.iptables_rejects || 0;

    // SYN flood detection
    if (synRecv > 10 && (prev.synRecv || 0) <= 10) {
      addEvent('detection', `SYN Flood detected: ${synRecv} SYN-RECV connections`,
        'TCP table shows abnormal SYN-RECV accumulation');
    } else if (synRecv <= 5 && (prev.synRecv || 0) > 10) {
      addEvent('recovery', 'SYN flood subsided', `SYN-RECV dropped to ${synRecv}`);
    }

    // iptables drops spike
    const dropDelta = drops - (prev.drops || 0);
    if (dropDelta > 50) {
      addEvent('defense', `iptables dropped ${dropDelta} packets`,
        `Total drops: ${drops}, rejects: ${rejects}`);
    }

    // Rate limit / XSS toggle changes
    const app = systemState.application || {};
    if (prev.xss !== undefined && prev.xss !== app.xss_protection) {
      addEvent('defense',
        app.xss_protection ? 'XSS Protection enabled' : 'XSS Protection disabled');
    }
    if (prev.rateLimit !== undefined && prev.rateLimit !== app.rate_limiting) {
      addEvent('defense',
        app.rate_limiting ? 'Rate Limiting enabled' : 'Rate Limiting disabled');
    }

    // Error rate spike
    const errRate = app.error_rate || 0;
    if (errRate > 20 && (prev.errRate || 0) <= 20) {
      addEvent('detection', `High error rate: ${errRate.toFixed(1)}%`,
        'Backend may be overwhelmed');
    } else if (errRate <= 5 && (prev.errRate || 0) > 20) {
      addEvent('recovery', `Error rate normalized: ${errRate.toFixed(1)}%`);
    }

    prevStateRef.current = {
      synRecv,
      drops,
      rejects,
      xss: app.xss_protection,
      rateLimit: app.rate_limiting,
      errRate,
    };
  }, [systemState, addEvent]);

  // Monitor blocked packet bursts
  useEffect(() => {
    if (!packets || packets.length === 0) return;
    // Check last 5 packets for block burst
    const last5 = packets.slice(-5);
    const blockedCount = last5.filter(p => p.blocked).length;
    if (blockedCount >= 4) {
      // Avoid spamming — only add if last event wasn't a blocked burst
      setEvents(prev => {
        const lastEvt = prev[prev.length - 1];
        if (lastEvt && lastEvt.type === 'blocked' && Date.now() - lastEvt.timestamp < 3000) return prev;
        eventIdRef.current++;
        return [...prev, {
          id: eventIdRef.current,
          type: 'blocked',
          message: `Blocking burst: ${blockedCount}/5 recent packets dropped`,
          detail: last5.filter(p => p.blocked).map(p => p.block_reason).filter(Boolean).join(', ') || null,
          timestamp: Date.now(),
        }].slice(-200);
      });
    }
  }, [packets]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events]);

  const filteredEvents = filter === 'all' ? events : events.filter(e => {
    if (filter === 'attack') return e.type === 'attack_start' || e.type === 'attack_stop';
    if (filter === 'defense') return e.type === 'defense' || e.type === 'blocked';
    if (filter === 'detection') return e.type === 'detection';
    if (filter === 'system') return e.type === 'system' || e.type === 'recovery';
    return true;
  });

  return (
    <div className="event-timeline">
      <div className="et-header">
        <h4>Event Timeline</h4>
        <div className="et-filters">
          {['all', 'detection', 'defense', 'system'].map(f => (
            <button
              key={f}
              className={`et-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="et-count">{filteredEvents.length}</span>
      </div>

      <div className="et-list" ref={listRef}>
        {filteredEvents.length === 0 ? (
          <div className="et-empty">
            No events yet. Start an attack or toggle defenses to see the timeline.
          </div>
        ) : (
          filteredEvents.map(evt => {
            const style = EVENT_STYLES[evt.type] || EVENT_STYLES.system;
            return (
              <div key={evt.id} className="et-event" style={{ borderLeftColor: style.color }}>
                <div className="et-event-header">
                  <span className="et-event-icon">{style.icon}</span>
                  <span className="et-event-label" style={{ color: style.color }}>{style.label}</span>
                  <span className="et-event-time">{formatTime(evt.timestamp)}</span>
                </div>
                <div className="et-event-message">{evt.message}</div>
                {evt.detail && (
                  <div className="et-event-detail">{evt.detail}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default EventTimeline;
