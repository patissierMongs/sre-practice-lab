import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';

const PRESET_RULES = [
  { label: 'Block port 80 (HTTP)', chain: 'INPUT', protocol: 'tcp', dport: '80', target: 'DROP' },
  { label: 'Block port 8000 (Backend)', chain: 'INPUT', protocol: 'tcp', dport: '8000', target: 'DROP' },
  { label: 'Block port 5432 (PostgreSQL)', chain: 'INPUT', protocol: 'tcp', dport: '5432', target: 'DROP' },
  { label: 'Block port 6379 (Redis)', chain: 'INPUT', protocol: 'tcp', dport: '6379', target: 'DROP' },
  { label: 'Reject all TCP (REJECT)', chain: 'INPUT', protocol: 'tcp', dport: '', target: 'REJECT' },
];

function DefenseLab({ systemState }) {
  const [security, setSecurity] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Custom rule form
  const [customChain, setCustomChain] = useState('INPUT');
  const [customProto, setCustomProto] = useState('tcp');
  const [customPort, setCustomPort] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [customTarget, setCustomTarget] = useState('DROP');

  const fetchSecurity = useCallback(async () => {
    try {
      const res = await api.get('/security/');
      setSecurity(res.data);
    } catch {}
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const res = await api.get('/security/iptables');
      if (res.data.success) setRules(res.data.rules);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSecurity();
    fetchRules();
    const iv = setInterval(fetchRules, 5000);
    return () => clearInterval(iv);
  }, [fetchSecurity, fetchRules]);

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const toggleXSS = async () => {
    try {
      const res = await api.post('/security/toggle-xss');
      setSecurity(res.data);
      flash(res.data.xss_protection ? 'XSS Protection ON' : 'XSS Protection OFF');
    } catch { flash('Failed'); }
  };

  const toggleRateLimit = async () => {
    try {
      const res = await api.post('/security/toggle-rate-limit');
      setSecurity(res.data);
      flash(res.data.rate_limiting ? 'Rate Limiting ON' : 'Rate Limiting OFF');
    } catch { flash('Failed'); }
  };

  const addRule = async (rule) => {
    setLoading(true);
    try {
      const res = await api.post('/security/iptables/add', rule);
      flash(res.data.message);
      await fetchRules();
    } catch { flash('Failed to add rule'); }
    setLoading(false);
  };

  const deleteRule = async (chain, num) => {
    try {
      const res = await api.post(`/security/iptables/delete?chain=${chain}&num=${num}`);
      flash(res.data.message);
      await fetchRules();
    } catch { flash('Failed to delete rule'); }
  };

  const flushRules = async () => {
    try {
      const res = await api.post('/security/iptables/flush');
      flash(res.data.message);
      await fetchRules();
    } catch { flash('Failed to flush'); }
  };

  const addCustomRule = () => {
    addRule({
      chain: customChain,
      protocol: customProto,
      source: customSource,
      dport: customPort,
      target: customTarget,
    });
  };

  // Kernel drop stats from systemState
  const kd = systemState?.network?.kernel_drops || {};
  const iptDrops = kd.iptables_drops || 0;
  const iptRejects = kd.iptables_rejects || 0;
  const conntrack = kd.conntrack || {};

  return (
    <div className="defense-lab">
      {message && <div className="defense-flash">{message}</div>}

      {/* Application-level toggles */}
      <div className="defense-section">
        <h4>Application Defense</h4>
        <div className="defense-toggles">
          <button
            className={`defense-toggle ${security?.xss_protection ? 'on' : 'off'}`}
            onClick={toggleXSS}
          >
            <span className="toggle-dot" />
            <span>XSS Filter</span>
          </button>
          <button
            className={`defense-toggle ${security?.rate_limiting ? 'on' : 'off'}`}
            onClick={toggleRateLimit}
          >
            <span className="toggle-dot" />
            <span>Rate Limit</span>
          </button>
        </div>
      </div>

      {/* Kernel stats */}
      <div className="defense-section">
        <h4>Kernel Stats</h4>
        <div className="defense-kernel-stats">
          <div className="kstat">
            <span className="kstat-val kstat-drop">{iptDrops}</span>
            <span className="kstat-label">iptables DROP</span>
          </div>
          <div className="kstat">
            <span className="kstat-val kstat-reject">{iptRejects}</span>
            <span className="kstat-label">iptables REJECT</span>
          </div>
          <div className="kstat">
            <span className="kstat-val">{conntrack.entries || 0}</span>
            <span className="kstat-label">conntrack entries</span>
          </div>
          <div className="kstat">
            <span className="kstat-val kstat-drop">{conntrack.drop || 0}</span>
            <span className="kstat-label">conntrack drops</span>
          </div>
        </div>
      </div>

      {/* Preset iptables rules */}
      <div className="defense-section">
        <h4>
          iptables Rules
          <button className="defense-flush-btn" onClick={flushRules}>Flush All</button>
        </h4>
        <div className="defense-presets">
          {PRESET_RULES.map((r, i) => (
            <button
              key={i}
              className="defense-preset-btn"
              onClick={() => addRule(r)}
              disabled={loading}
            >
              {r.target === 'DROP' ? '\u26D4' : '\u274C'} {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom rule builder */}
      <div className="defense-section">
        <h4>Custom Rule</h4>
        <div className="defense-custom-form">
          <select value={customChain} onChange={e => setCustomChain(e.target.value)}>
            <option value="INPUT">INPUT</option>
            <option value="OUTPUT">OUTPUT</option>
            <option value="FORWARD">FORWARD</option>
          </select>
          <select value={customProto} onChange={e => setCustomProto(e.target.value)}>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
          </select>
          <input
            type="text"
            placeholder="Source IP"
            value={customSource}
            onChange={e => setCustomSource(e.target.value)}
          />
          <input
            type="text"
            placeholder="Port"
            value={customPort}
            onChange={e => setCustomPort(e.target.value)}
          />
          <select value={customTarget} onChange={e => setCustomTarget(e.target.value)}>
            <option value="DROP">DROP</option>
            <option value="REJECT">REJECT</option>
            <option value="ACCEPT">ACCEPT</option>
            <option value="LOG">LOG</option>
          </select>
          <button className="defense-add-btn" onClick={addCustomRule} disabled={loading}>
            Add
          </button>
        </div>
      </div>

      {/* Active rules list */}
      <div className="defense-section">
        <h4>Active Rules ({rules.length})</h4>
        <div className="defense-rules-list">
          {rules.length === 0 ? (
            <div className="defense-empty">No custom rules (default ACCEPT policy)</div>
          ) : (
            rules.map((r, i) => (
              <div key={i} className={`defense-rule ${r.target === 'DROP' || r.target === 'REJECT' ? 'rule-drop' : 'rule-accept'}`}>
                <span className="rule-chain">{r.chain}</span>
                <span className="rule-target">{r.target}</span>
                <span className="rule-proto">{r.protocol}</span>
                <span className="rule-detail">
                  {r.source !== '0.0.0.0/0' && r.source ? `src:${r.source}` : ''}
                  {r.extra && ` ${r.extra}`}
                </span>
                <span className="rule-pkts">{r.packets} pkts</span>
                <button className="rule-delete" onClick={() => deleteRule(r.chain, r.num)}>{'\u2715'}</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default DefenseLab;
