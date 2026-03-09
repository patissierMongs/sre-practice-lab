import React, { useRef, useEffect, useCallback } from 'react';

/**
 * Cisco Packet Tracer – Simulation Mode
 *
 * Dark themed topology with recognizable network device icons,
 * grid background, wire connections with port labels,
 * and animated envelope packets.
 */

// ── Topology layout ──
const DEVICES = [
  { id: 'internet',    label: 'Internet',          type: 'cloud',   nx: 0.08, ny: 0.38 },
  { id: 'nginx',       label: 'Nginx',             type: 'router',  nx: 0.28, ny: 0.38 },
  { id: 'frontend',    label: 'Frontend\n(React)',  type: 'pc',      nx: 0.50, ny: 0.13 },
  { id: 'backend',     label: 'Backend\n(FastAPI)', type: 'server',  nx: 0.50, ny: 0.62 },
  { id: 'postgres',    label: 'PostgreSQL',         type: 'db',      nx: 0.78, ny: 0.42 },
  { id: 'redis',       label: 'Redis',              type: 'db',      nx: 0.78, ny: 0.78 },
  { id: 'prometheus',  label: 'Prometheus',         type: 'monitor', nx: 0.28, ny: 0.80 },
  { id: 'grafana',     label: 'Grafana',            type: 'monitor', nx: 0.08, ny: 0.80 },
];

const LINKS = [
  { from: 'internet',   to: 'nginx',      fromPort: ':80',   toPort: ':80' },
  { from: 'nginx',      to: 'frontend',   fromPort: ':3000', toPort: ':3000' },
  { from: 'nginx',      to: 'backend',    fromPort: ':8000', toPort: ':8000' },
  { from: 'backend',    to: 'postgres',   fromPort: '',      toPort: ':5432' },
  { from: 'backend',    to: 'redis',      fromPort: '',      toPort: ':6379' },
  { from: 'backend',    to: 'prometheus', fromPort: '',      toPort: ':9090' },
  { from: 'prometheus', to: 'grafana',    fromPort: '',      toPort: ':3000' },
];

// ── Colors ──
const C = {
  bg: '#0b1120',
  grid: '#131d30',
  gridAccent: '#1a2744',
  wire: '#1e3350',
  wireActive: '#3b82f6',
  text: '#94a3b8',
  textBright: '#e2e8f0',
  portLabel: '#64748b',
  // Device fills
  cloud:   { fill: '#1a1040', stroke: '#8b5cf6', accent: '#a78bfa' },
  router:  { fill: '#0c2a1e', stroke: '#10b981', accent: '#34d399' },
  server:  { fill: '#172040', stroke: '#3b82f6', accent: '#60a5fa' },
  pc:      { fill: '#1a2030', stroke: '#64748b', accent: '#94a3b8' },
  db:      { fill: '#1a2e1a', stroke: '#22c55e', accent: '#4ade80' },
  monitor: { fill: '#2a1a0a', stroke: '#f59e0b', accent: '#fbbf24' },
};

// ── Grid background ──
function drawGrid(ctx, w, h) {
  const step = 20;
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  // Accent every 5th line
  ctx.strokeStyle = C.gridAccent;
  ctx.lineWidth = 0.7;
  for (let x = 0; x < w; x += step * 5) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += step * 5) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

// ── Rounded rect helper ──
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Device icon renderers ──
function drawCloud(ctx, x, y, s, colors) {
  ctx.save();
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - s * 0.22, y + s * 0.05, s * 0.28, Math.PI * 0.4, Math.PI * 1.8);
  ctx.arc(x + s * 0.05, y - s * 0.18, s * 0.26, Math.PI * 1.0, Math.PI * 0.2);
  ctx.arc(x + s * 0.26, y + s * 0.04, s * 0.24, Math.PI * 1.4, Math.PI * 0.7);
  ctx.arc(x, y + s * 0.22, s * 0.35, Math.PI * 0.0, Math.PI * 1.0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRouter(ctx, x, y, s, colors) {
  // Cisco router icon: circle with arrows
  ctx.save();
  const r = s * 0.38;
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Cross arrows inside
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  const ar = r * 0.55;
  // Horizontal arrow
  ctx.beginPath();
  ctx.moveTo(x - ar, y); ctx.lineTo(x + ar, y);
  ctx.moveTo(x + ar - 4, y - 4); ctx.lineTo(x + ar, y); ctx.lineTo(x + ar - 4, y + 4);
  ctx.stroke();
  // Vertical arrow
  ctx.beginPath();
  ctx.moveTo(x, y - ar); ctx.lineTo(x, y + ar);
  ctx.moveTo(x - 4, y + ar - 4); ctx.lineTo(x, y + ar); ctx.lineTo(x + 4, y + ar - 4);
  ctx.stroke();
  ctx.restore();
}

function drawServer(ctx, x, y, s, colors) {
  ctx.save();
  const w = s * 0.65, h = s * 0.80;
  const rx = x - w / 2, ry = y - h / 2;
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 2;
  rrect(ctx, rx, ry, w, h, 4);
  ctx.fill();
  ctx.stroke();
  // 3 rack slots
  const slotH = (h - 12) / 3;
  for (let i = 0; i < 3; i++) {
    const sy = ry + 4 + i * (slotH + 1);
    ctx.fillStyle = '#070d18';
    rrect(ctx, rx + 4, sy, w - 8, slotH - 1, 2);
    ctx.fill();
    // LED
    ctx.fillStyle = i === 0 ? '#22c55e' : colors.accent;
    ctx.beginPath();
    ctx.arc(rx + w - 10, sy + slotH / 2 - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Drive lines
    ctx.strokeStyle = colors.stroke + '40';
    ctx.lineWidth = 0.5;
    for (let j = 1; j <= 3; j++) {
      const lx = rx + 8 + j * 8;
      ctx.beginPath(); ctx.moveTo(lx, sy + 3); ctx.lineTo(lx, sy + slotH - 4); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPC(ctx, x, y, s, colors) {
  ctx.save();
  const mw = s * 0.60, mh = s * 0.45;
  // Monitor
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 2;
  rrect(ctx, x - mw / 2, y - mh / 2 - 6, mw, mh, 3);
  ctx.fill();
  ctx.stroke();
  // Screen
  ctx.fillStyle = '#060c18';
  rrect(ctx, x - mw / 2 + 3, y - mh / 2 - 3, mw - 6, mh - 8, 2);
  ctx.fill();
  // Screen glow line
  ctx.strokeStyle = colors.accent + '30';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - mw / 4, y - 4);
  ctx.lineTo(x + mw / 4, y - 4);
  ctx.stroke();
  // Stand
  ctx.fillStyle = colors.stroke;
  ctx.fillRect(x - 3, y + mh / 2 - 6, 6, 10);
  // Base
  ctx.fillRect(x - 12, y + mh / 2 + 3, 24, 3);
  ctx.restore();
}

function drawDB(ctx, x, y, s, colors) {
  ctx.save();
  const cw = s * 0.52, ch = s * 0.72;
  const ry = ch / 5;
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 2;
  // Body
  ctx.beginPath();
  ctx.ellipse(x, y - ch / 2 + ry, cw / 2, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + cw / 2, y + ch / 2 - ry);
  ctx.ellipse(x, y + ch / 2 - ry, cw / 2, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Top cap
  ctx.beginPath();
  ctx.ellipse(x, y - ch / 2 + ry, cw / 2, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = colors.stroke + '25';
  ctx.fill();
  ctx.strokeStyle = colors.stroke;
  ctx.stroke();
  // Middle ring
  ctx.beginPath();
  ctx.ellipse(x, y - ch / 8, cw / 2, ry * 0.6, 0, 0, Math.PI * 2);
  ctx.strokeStyle = colors.stroke + '50';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawMonitor(ctx, x, y, s, colors) {
  // Dashboard gauge icon
  ctx.save();
  const r = s * 0.36;
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 2;
  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Gauge arc
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, Math.PI * 0.8, Math.PI * 0.2, false);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  // Needle
  const angle = -Math.PI * 0.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * r * 0.55, y + Math.sin(angle) * r * 0.55);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Center dot
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = colors.accent;
  ctx.fill();
  ctx.restore();
}

const ICON_RENDERERS = {
  cloud: drawCloud,
  router: drawRouter,
  server: drawServer,
  pc: drawPC,
  db: drawDB,
  monitor: drawMonitor,
};

// ── Wire drawing ──
function drawWire(ctx, from, to, fromPort, toPort, active, iconSize) {
  ctx.save();

  // Orthogonal routing: if angle is steep, use L-shaped path
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(Math.abs(dy), Math.abs(dx));

  ctx.strokeStyle = active ? C.wireActive : C.wire;
  ctx.lineWidth = active ? 2.5 : 1.5;

  if (angle > Math.PI / 4 && Math.abs(dx) > 40) {
    // L-shaped routing
    const midX = from.x + dx * 0.5;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(midX, from.y);
    ctx.lineTo(midX, to.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  } else {
    // Straight line
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  // Active glow
  if (active) {
    ctx.shadowColor = C.wireActive;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Port labels
  const fontSize = Math.max(8, iconSize * 0.22);
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = C.portLabel;
  ctx.textAlign = 'center';

  if (fromPort) {
    const lx = from.x + dx * 0.15;
    const ly = from.y + dy * 0.15 - 6;
    ctx.fillText(fromPort, lx, ly);
  }
  if (toPort) {
    const lx = from.x + dx * 0.85;
    const ly = from.y + dy * 0.85 - 6;
    ctx.fillText(toPort, lx, ly);
  }

  ctx.restore();
}

// ── Envelope packet ──
function drawEnvelope(ctx, x, y, color, size, blocked) {
  const w = size, h = size * 0.68;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  // Body
  ctx.fillStyle = blocked ? '#2a0a0a' : '#101828';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  rrect(ctx, x - w / 2, y - h / 2, w, h, 2);
  ctx.fill();
  ctx.stroke();

  // Flap
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x, y);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Blocked X
  if (blocked) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - w / 3, y - h / 3);
    ctx.lineTo(x + w / 3, y + h / 3);
    ctx.moveTo(x + w / 3, y - h / 3);
    ctx.lineTo(x - w / 3, y + h / 3);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Packet route determination ──
function getRoute(packet) {
  const path = packet.path || '';
  const layer = packet.layer || '';

  if (layer === 'nginx') {
    const route = ['internet', 'nginx'];
    if (!packet.blocked) {
      route.push(path.startsWith('/api') ? 'backend' : 'frontend');
    }
    return route;
  }

  const route = ['nginx', 'backend'];
  if (!packet.blocked && (path.includes('/posts') || path.includes('/users') || path.includes('/health'))) {
    route.push('postgres');
  }
  return route;
}

function getColor(packet) {
  if (packet.blocked) return '#ef4444';
  if (packet.status_code >= 500) return '#f97316';
  if (packet.status_code >= 400) return '#eab308';
  return '#22d3ee';
}

// ── Packet envelope entity ──
class PacketEnvelope {
  constructor(packet, route, id, dmap) {
    this.id = id;
    this.packet = packet;
    this.route = route;
    this.color = getColor(packet);
    this.size = 16;
    this.opacity = 1;
    this.progress = 0;
    this.segIdx = 0;
    this.speed = 0.006 + Math.random() * 0.005;
    this.alive = true;
    this.bouncing = false;
    this.bvx = 0;
    this.bvy = 0;
    this.x = 0;
    this.y = 0;
    this.dmap = dmap;
    this._pos();
  }

  _pos() {
    if (this.bouncing) return;
    const a = this.dmap[this.route[this.segIdx]];
    const b = this.dmap[this.route[this.segIdx + 1]];
    if (!a || !b) { this.alive = false; return; }
    const t = this.progress;
    const off = (this.id % 2 === 0 ? -6 : 6);
    this.x = a.x + (b.x - a.x) * t;
    this.y = a.y + (b.y - a.y) * t + off * Math.sin(t * Math.PI);
  }

  update() {
    if (!this.alive) return;
    if (this.bouncing) {
      this.x += this.bvx;
      this.y += this.bvy;
      this.bvy += 0.3;
      this.bvx *= 0.96;
      this.opacity -= 0.02;
      this.size = Math.max(4, this.size - 0.1);
      if (this.opacity <= 0) this.alive = false;
      return;
    }
    this.progress += this.speed;
    if (this.progress >= 1) {
      this.segIdx++;
      this.progress = 0;
      if (this.packet.blocked && this.segIdx >= this.route.length - 1) {
        this.bouncing = true;
        const a = -Math.PI / 3 + Math.random() * (-Math.PI / 3);
        const sp = 2 + Math.random() * 3;
        this.bvx = Math.cos(a) * sp * (Math.random() > 0.5 ? 1 : -1);
        this.bvy = Math.sin(a) * sp - 2;
        this.size = 20;
        return;
      }
      if (this.segIdx >= this.route.length - 1) {
        this.opacity -= 0.1;
        if (this.opacity <= 0) this.alive = false;
        return;
      }
    }
    this._pos();
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    drawEnvelope(ctx, this.x, this.y, this.color, this.size, this.packet.blocked && this.bouncing);
    ctx.restore();
  }

  hit(px, py) {
    return Math.abs(px - this.x) <= this.size && Math.abs(py - this.y) <= this.size * 0.7;
  }
}

// ── Traffic counter per link ──
function getActiveLinks(envelopes) {
  const active = new Set();
  envelopes.forEach(e => {
    if (!e.alive || e.bouncing) return;
    const a = e.route[e.segIdx];
    const b = e.route[e.segIdx + 1];
    if (a && b) active.add(`${a}->${b}`);
  });
  return active;
}

// ═══════════════════════════════════
// Main Component
// ═══════════════════════════════════
function PacketParticles({ packets, onParticleClick }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const envRef = useRef([]);
  const idRef = useRef(0);
  const prevLenRef = useRef(0);
  const animRef = useRef(null);
  const sizeRef = useRef({ w: 600, h: 400 });
  const dposRef = useRef({});

  const computePos = useCallback(() => {
    const { w, h } = sizeRef.current;
    const m = {};
    DEVICES.forEach(d => { m[d.id] = { x: d.nx * w, y: d.ny * h }; });
    dposRef.current = m;
  }, []);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const canvas = canvasRef.current;

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const dpr = window.devicePixelRatio || 1;
          sizeRef.current = { w: width, h: height };
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';
          const ctx = canvas.getContext('2d');
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          computePos();
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [computePos]);

  // Ingest new packets
  useEffect(() => {
    if (!packets || packets.length === 0) return;
    if (packets.length <= prevLenRef.current) {
      prevLenRef.current = packets.length;
      return;
    }
    const fresh = packets.slice(prevLenRef.current);
    prevLenRef.current = packets.length;

    fresh.forEach(pkt => {
      const route = getRoute(pkt);
      if (route.length < 2) return;
      idRef.current++;
      envRef.current.push(new PacketEnvelope(pkt, route, idRef.current, dposRef.current));
    });

    if (envRef.current.length > 150) {
      envRef.current = envRef.current.slice(-100);
    }
  }, [packets]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function draw() {
      const { w, h } = sizeRef.current;
      const dp = dposRef.current;
      const iconSize = Math.max(36, Math.min(w, h) * 0.095);

      // Clear & background
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Grid
      drawGrid(ctx, w, h);

      // Active links for glow
      const activeLinks = getActiveLinks(envRef.current);

      // Wires
      LINKS.forEach(link => {
        const a = dp[link.from];
        const b = dp[link.to];
        if (!a || !b) return;
        const key = `${link.from}->${link.to}`;
        drawWire(ctx, a, b, link.fromPort, link.toPort, activeLinks.has(key), iconSize);
      });

      // Devices
      DEVICES.forEach(dev => {
        const p = dp[dev.id];
        if (!p) return;

        const render = ICON_RENDERERS[dev.type];
        const colors = C[dev.type] || C.server;
        if (render) render(ctx, p.x, p.y, iconSize, colors);

        // Status dot (green = up)
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(p.x + iconSize * 0.32, p.y - iconSize * 0.32, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0b1120';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        const fs = Math.max(10, iconSize * 0.28);
        ctx.font = `600 ${fs}px -apple-system, 'Segoe UI', sans-serif`;
        ctx.fillStyle = C.textBright;
        ctx.textAlign = 'center';
        const lines = dev.label.split('\n');
        lines.forEach((line, i) => {
          ctx.fillText(line, p.x, p.y + iconSize * 0.48 + 14 + i * (fs + 2));
        });
        // Sub-label (second line dimmer)
        if (lines.length > 1) {
          // already drawn above, just the first line is bright
        }
      });

      // Envelopes
      envRef.current = envRef.current.filter(e => e.alive);
      envRef.current.forEach(e => {
        e.dmap = dp;
        e.update();
        e.draw(ctx);
      });

      // Legend
      drawLegend(ctx, w, h);

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Legend
  function drawLegend(ctx, w, h) {
    const lx = 12, ly = h - 14;
    ctx.font = '10px monospace';
    const items = [
      { color: '#22d3ee', label: 'Normal' },
      { color: '#ef4444', label: 'Blocked' },
      { color: '#f97316', label: '5xx' },
      { color: '#eab308', label: '4xx' },
    ];
    let ox = lx;
    items.forEach(it => {
      // Dot
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.arc(ox, ly, 4, 0, Math.PI * 2);
      ctx.fill();
      // Text
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText(it.label, ox + 7, ly + 3);
      ox += ctx.measureText(it.label).width + 22;
    });
  }

  // Click
  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = envRef.current.length - 1; i >= 0; i--) {
      if (envRef.current[i].hit(x, y)) {
        if (onParticleClick) {
          onParticleClick(envRef.current[i].packet, { x: e.clientX, y: e.clientY });
        }
        return;
      }
    }
  }, [onParticleClick]);

  return (
    <div ref={containerRef} className="packet-sim-container">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="packet-sim-canvas"
      />
    </div>
  );
}

export default PacketParticles;
