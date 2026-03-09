import React, { useRef, useEffect, useCallback } from 'react';

/**
 * Packet Tracer Simulation Mode
 *
 * Cisco Packet Tracer style: device icons connected by wires,
 * packets rendered as envelopes traveling along connections.
 * Click an envelope to inspect PDU details at each layer.
 */

// ── Device definitions (positions are in 0-1 normalized coords) ──
const DEVICES = [
  { id: 'traffic-gen', name: 'Traffic\nGenerator', type: 'cloud',   nx: 0.06, ny: 0.40 },
  { id: 'nginx',       name: 'Nginx',              type: 'server',  nx: 0.30, ny: 0.40 },
  { id: 'frontend',    name: 'Frontend',            type: 'desktop', nx: 0.54, ny: 0.15 },
  { id: 'backend',     name: 'Backend',             type: 'server',  nx: 0.54, ny: 0.65 },
  { id: 'postgres',    name: 'PostgreSQL',          type: 'db',      nx: 0.82, ny: 0.50 },
  { id: 'redis',       name: 'Redis',               type: 'db',      nx: 0.82, ny: 0.82 },
  { id: 'prometheus',  name: 'Prometheus',           type: 'monitor', nx: 0.30, ny: 0.85 },
  { id: 'grafana',     name: 'Grafana',              type: 'monitor', nx: 0.06, ny: 0.85 },
];

const LINKS = [
  ['traffic-gen', 'nginx'],
  ['nginx', 'frontend'],
  ['nginx', 'backend'],
  ['backend', 'postgres'],
  ['backend', 'redis'],
  ['backend', 'prometheus'],
  ['prometheus', 'grafana'],
];

// ── Device icon drawing ──
function drawDeviceIcon(ctx, type, x, y, w) {
  const h = w;
  ctx.save();

  switch (type) {
    case 'server': {
      // Rack server icon
      const rw = w * 0.8, rh = h * 0.9;
      const rx = x - rw / 2, ry = y - rh / 2;
      ctx.fillStyle = '#1e3a5f';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      roundRect(ctx, rx, ry, rw, rh, 4);
      ctx.fill();
      ctx.stroke();
      // Slots
      for (let i = 0; i < 3; i++) {
        const sy = ry + 6 + i * (rh / 3.5);
        ctx.fillStyle = '#0f2440';
        ctx.fillRect(rx + 4, sy, rw - 8, rh / 5);
        ctx.fillStyle = i === 0 ? '#22c55e' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(rx + rw - 8, sy + rh / 10, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'db': {
      // Database cylinder
      const cw = w * 0.6, ch = h * 0.85;
      const cx = x, cy = y;
      ctx.fillStyle = '#1a3a2a';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      // Body
      ctx.beginPath();
      ctx.ellipse(cx, cy - ch / 3, cw / 2, ch / 6, 0, Math.PI, 0);
      ctx.lineTo(cx + cw / 2, cy + ch / 4);
      ctx.ellipse(cx, cy + ch / 4, cw / 2, ch / 6, 0, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Top ellipse
      ctx.beginPath();
      ctx.ellipse(cx, cy - ch / 3, cw / 2, ch / 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#245238';
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'cloud': {
      // Cloud shape
      ctx.fillStyle = '#2d1f3d';
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x - w * 0.15, y, w * 0.25, 0, Math.PI * 2);
      ctx.arc(x + w * 0.15, y, w * 0.25, 0, Math.PI * 2);
      ctx.arc(x, y - h * 0.12, w * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'desktop': {
      // Monitor
      const mw = w * 0.7, mh = h * 0.55;
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      roundRect(ctx, x - mw / 2, y - mh / 2 - 4, mw, mh, 3);
      ctx.fill();
      ctx.stroke();
      // Screen glow
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - mw / 2 + 3, y - mh / 2 - 1, mw - 6, mh - 6);
      // Stand
      ctx.fillStyle = '#475569';
      ctx.fillRect(x - 3, y + mh / 2 - 4, 6, 8);
      ctx.fillRect(x - 10, y + mh / 2 + 3, 20, 3);
      break;
    }
    case 'monitor': {
      // Dashboard/gauge
      const mr = w * 0.35;
      ctx.fillStyle = '#1a1a2e';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, mr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Gauge needle
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + mr * 0.6, y - mr * 0.3);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      break;
    }
    default:
      ctx.fillStyle = '#21262d';
      ctx.beginPath();
      ctx.arc(x, y, w * 0.3, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
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

// ── Envelope (packet) drawing ──
function drawEnvelope(ctx, x, y, color, size, blocked) {
  const w = size, h = size * 0.7;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;

  // Envelope body
  ctx.fillStyle = blocked ? '#3a1515' : '#1a2233';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 2);
  ctx.fill();
  ctx.stroke();

  // Envelope flap (triangle)
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x, y);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.strokeStyle = color + '88';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Blocked X overlay
  if (blocked) {
    ctx.strokeStyle = '#ef5350';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w / 3, y - h / 3);
    ctx.lineTo(x + w / 3, y + h / 3);
    ctx.moveTo(x + w / 3, y - h / 3);
    ctx.lineTo(x - w / 3, y + h / 3);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Packet route logic ──
function getRoute(packet) {
  const path = packet.path || '';
  const layer = packet.layer || '';

  if (layer === 'nginx') {
    const route = ['traffic-gen', 'nginx'];
    if (!packet.blocked) {
      route.push(path.startsWith('/api') ? 'backend' : 'frontend');
    }
    return route;
  }

  const route = ['nginx', 'backend'];
  if (!packet.blocked && (path.includes('/posts') || path.includes('/users') || path.includes('/health/ready'))) {
    route.push('postgres');
  }
  return route;
}

function getEnvelopeColor(packet) {
  if (packet.blocked) return '#ef5350';
  if (packet.status_code >= 500) return '#ff9800';
  if (packet.status_code >= 400) return '#ffb74d';
  return '#4fc3f7';
}

// ── Packet envelope entity ──
class PacketEnvelope {
  constructor(packet, route, id, deviceMap) {
    this.id = id;
    this.packet = packet;
    this.route = route;
    this.color = getEnvelopeColor(packet);
    this.size = 14;
    this.opacity = 1;
    this.progress = 0;
    this.segmentIdx = 0;
    this.speed = 0.008 + Math.random() * 0.006;
    this.alive = true;
    this.bouncing = false;
    this.bounceVx = 0;
    this.bounceVy = 0;
    this.x = 0;
    this.y = 0;
    this.deviceMap = deviceMap;
    this._updatePosition();
  }

  _getDevicePos(id) {
    return this.deviceMap[id] || { x: 0, y: 0 };
  }

  _updatePosition() {
    if (this.bouncing) return;
    const from = this._getDevicePos(this.route[this.segmentIdx]);
    const to = this._getDevicePos(this.route[this.segmentIdx + 1]);
    if (!from || !to) { this.alive = false; return; }

    const t = this.progress;
    // Slight vertical offset so packets don't overlap the wire
    const offsetY = (this.id % 2 === 0 ? -8 : 8);
    this.x = from.x + (to.x - from.x) * t;
    this.y = from.y + (to.y - from.y) * t + offsetY * Math.sin(t * Math.PI);
  }

  update() {
    if (!this.alive) return;

    if (this.bouncing) {
      this.x += this.bounceVx;
      this.y += this.bounceVy;
      this.bounceVy += 0.25;
      this.bounceVx *= 0.97;
      this.opacity -= 0.018;
      this.size = Math.max(4, this.size - 0.08);
      if (this.opacity <= 0) this.alive = false;
      return;
    }

    this.progress += this.speed;

    if (this.progress >= 1) {
      this.segmentIdx++;
      this.progress = 0;

      if (this.packet.blocked && this.segmentIdx >= this.route.length - 1) {
        this.bouncing = true;
        const angle = -Math.PI / 3 + Math.random() * (-Math.PI / 3);
        const spd = 2.5 + Math.random() * 3;
        this.bounceVx = Math.cos(angle) * spd * (Math.random() > 0.5 ? 1 : -1);
        this.bounceVy = Math.sin(angle) * spd - 2;
        this.size = 18;
        return;
      }

      if (this.segmentIdx >= this.route.length - 1) {
        this.opacity -= 0.08;
        if (this.opacity <= 0) this.alive = false;
        return;
      }
    }

    this._updatePosition();
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    drawEnvelope(ctx, this.x, this.y, this.color, this.size, this.packet.blocked && this.bouncing);
    ctx.restore();
  }

  containsPoint(px, py) {
    return Math.abs(px - this.x) <= this.size && Math.abs(py - this.y) <= this.size * 0.7;
  }
}

// ═══════════════════════════════════
// Main Component
// ═══════════════════════════════════
function PacketParticles({ packets, onParticleClick }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const envelopesRef = useRef([]);
  const idCounterRef = useRef(0);
  const prevPacketLenRef = useRef(0);
  const animFrameRef = useRef(null);
  const sizeRef = useRef({ w: 600, h: 400 });
  const devicePosRef = useRef({});

  // Compute device positions from container size
  const computePositions = useCallback(() => {
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const map = {};
    DEVICES.forEach(d => {
      map[d.id] = { x: d.nx * w, y: d.ny * h };
    });
    devicePosRef.current = map;
  }, []);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const canvas = canvasRef.current;

    const observer = new ResizeObserver(entries => {
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
          computePositions();
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [computePositions]);

  // Add envelopes when packets arrive
  useEffect(() => {
    if (!packets || packets.length === 0) return;
    if (packets.length <= prevPacketLenRef.current) {
      prevPacketLenRef.current = packets.length;
      return;
    }

    const newPkts = packets.slice(prevPacketLenRef.current);
    prevPacketLenRef.current = packets.length;

    newPkts.forEach(pkt => {
      const route = getRoute(pkt);
      if (route.length < 2) return;
      idCounterRef.current++;
      envelopesRef.current.push(
        new PacketEnvelope(pkt, route, idCounterRef.current, devicePosRef.current)
      );
    });

    if (envelopesRef.current.length > 150) {
      envelopesRef.current = envelopesRef.current.slice(-100);
    }
  }, [packets]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function animate() {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      const devPos = devicePosRef.current;
      const iconSize = Math.max(28, Math.min(w, h) * 0.07);

      // ── Draw wires ──
      LINKS.forEach(([a, b]) => {
        const from = devPos[a];
        const to = devPos[b];
        if (!from || !to) return;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Subtle direction indicator (small dot at midpoint)
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        ctx.beginPath();
        ctx.arc(mx, my, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#334155';
        ctx.fill();
      });

      // ── Draw devices ──
      DEVICES.forEach(dev => {
        const pos = devPos[dev.id];
        if (!pos) return;

        drawDeviceIcon(ctx, dev.type, pos.x, pos.y, iconSize);

        // Label
        ctx.font = `${Math.max(9, iconSize * 0.32)}px -apple-system, sans-serif`;
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        const lines = dev.name.split('\n');
        lines.forEach((line, i) => {
          ctx.fillText(line, pos.x, pos.y + iconSize / 2 + 12 + i * 12);
        });
      });

      // ── Update & draw envelopes ──
      envelopesRef.current = envelopesRef.current.filter(e => e.alive);
      envelopesRef.current.forEach(e => {
        // Update device map reference for responsive positions
        e.deviceMap = devPos;
        e.update();
        e.draw(ctx);
      });

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Click handler
  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);

    for (let i = envelopesRef.current.length - 1; i >= 0; i--) {
      const env = envelopesRef.current[i];
      if (env.containsPoint(x, y)) {
        if (onParticleClick) {
          onParticleClick(env.packet, { x: e.clientX, y: e.clientY });
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
        style={{ cursor: 'crosshair' }}
      />
    </div>
  );
}

export default PacketParticles;
