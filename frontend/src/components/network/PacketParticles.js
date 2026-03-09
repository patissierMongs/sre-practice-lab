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
  { id: 'client',      label: 'Client',             type: 'laptop',  nx: 0.06, ny: 0.18 },
  { id: 'attacker',    label: 'Attacker',           type: 'laptop',  nx: 0.06, ny: 0.58 },
  { id: 'internet',    label: 'Internet',           type: 'cloud',   nx: 0.22, ny: 0.38 },
  { id: 'nginx',       label: 'Nginx',              type: 'router',  nx: 0.40, ny: 0.38 },
  { id: 'frontend',    label: 'Frontend\n(React)',   type: 'pc',      nx: 0.60, ny: 0.13 },
  { id: 'backend',     label: 'Backend\n(FastAPI)',  type: 'server',  nx: 0.60, ny: 0.62 },
  { id: 'postgres',    label: 'PostgreSQL',          type: 'db',      nx: 0.84, ny: 0.42 },
  { id: 'redis',       label: 'Redis',               type: 'db',      nx: 0.84, ny: 0.78 },
  { id: 'prometheus',  label: 'Prometheus',          type: 'monitor', nx: 0.40, ny: 0.82 },
  { id: 'grafana',     label: 'Grafana',             type: 'monitor', nx: 0.22, ny: 0.82 },
];

const LINKS = [
  { from: 'client',     to: 'internet',   fromPort: '',      toPort: '' },
  { from: 'attacker',   to: 'internet',   fromPort: '',      toPort: '' },
  { from: 'internet',   to: 'nginx',      fromPort: '',      toPort: ':80' },
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
  laptop:  { fill: '#1a1a30', stroke: '#818cf8', accent: '#a5b4fc' },
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

function drawLaptop(ctx, x, y, s, colors) {
  ctx.save();
  const bw = s * 0.65, bh = s * 0.42;
  // Screen (tilted back slightly)
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 2;
  rrect(ctx, x - bw / 2, y - bh / 2 - 8, bw, bh, 3);
  ctx.fill();
  ctx.stroke();
  // Screen inner
  ctx.fillStyle = '#060c1a';
  rrect(ctx, x - bw / 2 + 3, y - bh / 2 - 5, bw - 6, bh - 6, 2);
  ctx.fill();
  // Cursor blink line on screen
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - bw / 6, y - 6);
  ctx.lineTo(x + bw / 6, y - 6);
  ctx.stroke();
  // Keyboard base (wider, thinner)
  ctx.fillStyle = colors.stroke + '40';
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1.5;
  const kw = bw * 1.1, kh = s * 0.10;
  const ky = y + bh / 2 - 8;
  ctx.beginPath();
  ctx.moveTo(x - kw / 2, ky + kh);
  ctx.lineTo(x - bw / 2, ky);
  ctx.lineTo(x + bw / 2, ky);
  ctx.lineTo(x + kw / 2, ky + kh);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

const ICON_RENDERERS = {
  cloud: drawCloud,
  router: drawRouter,
  server: drawServer,
  pc: drawPC,
  laptop: drawLaptop,
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
function isAttack(packet) {
  return packet.blocked || packet.attack_type === 'xss' || packet.attack_type === 'sqli'
    || packet.attack_type === 'ddos' || (packet.status_code && packet.status_code === 429);
}

function getRoute(packet) {
  const path = packet.path || '';
  const layer = packet.layer || '';
  const attack = isAttack(packet);
  const origin = attack ? 'attacker' : 'client';

  if (layer === 'nginx') {
    const route = [origin, 'internet', 'nginx'];
    if (!packet.blocked) {
      route.push(path.startsWith('/api') ? 'backend' : 'frontend');
    }
    return route;
  }

  const route = [origin, 'internet', 'nginx', 'backend'];

  // SQLi attacks that aren't blocked reach the DB
  const dbPath = path.includes('/posts') || path.includes('/users') || path.includes('/health');
  if (dbPath || packet.attack_type === 'sqli') {
    if (!packet.blocked) {
      route.push('postgres');
    }
  }

  return route;
}

function getColor(packet) {
  if (packet.blocked) return '#ef4444';
  if (packet.status_code >= 500) return '#f97316';
  if (packet.status_code >= 400) return '#eab308';
  return '#22d3ee';
}

// ── Debris: dropped packets that pile up ──
class Debris {
  constructor(x, y, color, packet) {
    this.x = x + (Math.random() - 0.5) * 20;
    this.y = y + Math.random() * 10;
    this.color = color;
    this.packet = packet;
    this.size = 8 + Math.random() * 4;
    this.rotation = (Math.random() - 0.5) * 0.6;
    this.createdAt = Date.now();
    this.lifetime = 8000 + Math.random() * 4000; // 8-12s
    this.opacity = 0.85;
  }

  update() {
    const age = Date.now() - this.createdAt;
    if (age > this.lifetime - 2000) {
      // Fade out in last 2 seconds
      this.opacity = Math.max(0, 0.85 * (1 - (age - (this.lifetime - 2000)) / 2000));
    }
    return age < this.lifetime;
  }

  draw(ctx) {
    const w = this.size, h = w * 0.68;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Crumpled envelope
    ctx.fillStyle = '#1a0808';
    ctx.strokeStyle = this.color + '80';
    ctx.lineWidth = 1;
    rrect(ctx, -w / 2, -h / 2, w, h, 1);
    ctx.fill();
    ctx.stroke();

    // X mark
    ctx.strokeStyle = '#ef444460';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w / 4, -h / 4);
    ctx.lineTo(w / 4, h / 4);
    ctx.moveTo(w / 4, -h / 4);
    ctx.lineTo(-w / 4, h / 4);
    ctx.stroke();

    ctx.restore();
  }

  hit(px, py) {
    return Math.abs(px - this.x) <= this.size && Math.abs(py - this.y) <= this.size * 0.7;
  }
}

// ── Spark particle (impact effect) ──
class Spark {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.size = 2 + Math.random() * 2;
    this.life = 1;
    this.decay = 0.03 + Math.random() * 0.03;
    this.alive = true;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.08;
    this.vx *= 0.97;
    this.life -= this.decay;
    if (this.life <= 0) this.alive = false;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
    this.settled = false; // becomes debris
    this.bvx = 0;
    this.bvy = 0;
    this.x = 0;
    this.y = 0;
    this.dmap = dmap;
    this.impactSpawned = false;
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
      this.bvy += 0.25;
      this.bvx *= 0.95;
      this.opacity -= 0.015;
      this.size = Math.max(5, this.size - 0.08);
      // When slowed enough, settle as debris
      if (Math.abs(this.bvx) < 0.3 && Math.abs(this.bvy) < 0.5 && this.bvy > 0) {
        this.settled = true;
        this.alive = false;
      }
      if (this.opacity <= 0) {
        this.settled = true;
        this.alive = false;
      }
      return;
    }
    this.progress += this.speed;
    if (this.progress >= 1) {
      this.segIdx++;
      this.progress = 0;
      if (this.packet.blocked && this.segIdx >= this.route.length - 1) {
        this.bouncing = true;
        this.impactSpawned = false;
        // Bounce away from the blocking device
        const blockDev = this.dmap[this.route[this.route.length - 1]];
        const prevDev = this.dmap[this.route[this.route.length - 2]];
        if (blockDev && prevDev) {
          // Bounce direction: away from target, biased downward
          const dx = prevDev.x - blockDev.x;
          const dy = prevDev.y - blockDev.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          this.bvx = (dx / dist) * (1.5 + Math.random() * 2);
          this.bvy = Math.abs(dy / dist) * 0.5 + 1 + Math.random() * 1.5; // bias downward
        } else {
          this.bvx = (Math.random() - 0.5) * 3;
          this.bvy = 1 + Math.random() * 2;
        }
        this.size = 18;
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
  const debrisRef = useRef([]);
  const sparksRef = useRef([]);
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

      // Debris (piled up dropped packets) — draw UNDER envelopes
      debrisRef.current = debrisRef.current.filter(d => d.update());
      debrisRef.current.forEach(d => d.draw(ctx));

      // Debris count label near pile
      if (debrisRef.current.length > 0) {
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#ef4444cc';
        ctx.textAlign = 'center';
        // Find average position of recent debris
        const recent = debrisRef.current.slice(-20);
        const ax = recent.reduce((s, d) => s + d.x, 0) / recent.length;
        const ay = Math.min(...recent.map(d => d.y)) - 10;
        ctx.fillText(`${debrisRef.current.length} dropped`, ax, ay);
      }

      // Update envelopes — spawn debris + sparks when settled
      envRef.current = envRef.current.filter(e => {
        e.dmap = dp;
        e.update();

        // Spawn sparks on first bounce frame
        if (e.bouncing && !e.impactSpawned) {
          e.impactSpawned = true;
          for (let i = 0; i < 8; i++) {
            sparksRef.current.push(new Spark(e.x, e.y, e.color));
          }
        }

        // Convert to debris when settled
        if (e.settled) {
          debrisRef.current.push(new Debris(e.x, e.y, e.color, e.packet));
          // Cap debris
          if (debrisRef.current.length > 60) {
            debrisRef.current = debrisRef.current.slice(-50);
          }
          return false;
        }

        return e.alive;
      });

      envRef.current.forEach(e => e.draw(ctx));

      // Sparks
      sparksRef.current = sparksRef.current.filter(s => { s.update(); return s.alive; });
      sparksRef.current.forEach(s => s.draw(ctx));

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

    // Check envelopes first (moving packets)
    for (let i = envRef.current.length - 1; i >= 0; i--) {
      if (envRef.current[i].hit(x, y)) {
        if (onParticleClick) {
          onParticleClick(envRef.current[i].packet, { x: e.clientX, y: e.clientY });
        }
        return;
      }
    }
    // Check debris (dropped packets pile)
    for (let i = debrisRef.current.length - 1; i >= 0; i--) {
      if (debrisRef.current[i].hit(x, y)) {
        if (onParticleClick) {
          onParticleClick(debrisRef.current[i].packet, { x: e.clientX, y: e.clientY });
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
