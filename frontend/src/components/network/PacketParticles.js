import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';

/**
 * Canvas-based particle system for packet visualization on topology.
 *
 * Each packet = a particle that travels along edges.
 * Blocked packets bounce/deflect off the blocking node.
 * Click a particle to inspect its payload.
 */

// Node positions (must match TopologyMap POSITIONS)
const NODE_POSITIONS = {
  'traffic-generator': { x: 60, y: 180 },
  'nginx':             { x: 310, y: 180 },
  'frontend':          { x: 560, y: 80 },
  'backend':           { x: 560, y: 280 },
  'postgres':          { x: 810, y: 230 },
  'redis':             { x: 810, y: 330 },
};

// Colors
const STATUS_COLORS = {
  pass: '#66bb6a',
  blocked: '#ef5350',
  error: '#ff9800',
  warn: '#ffb74d',
};

function getParticleColor(packet) {
  if (packet.blocked) return STATUS_COLORS.blocked;
  if (packet.status_code >= 500) return STATUS_COLORS.error;
  if (packet.status_code >= 400) return STATUS_COLORS.warn;
  return STATUS_COLORS.pass;
}

// Determine the route (sequence of node names) a packet takes
function getRoute(packet) {
  const path = packet.path || '';
  const layer = packet.layer || '';

  if (layer === 'nginx') {
    const route = ['traffic-generator', 'nginx'];
    if (!packet.blocked) {
      route.push(path.startsWith('/api') ? 'backend' : 'frontend');
    }
    return route;
  }

  // application layer
  const route = ['nginx', 'backend'];
  if (!packet.blocked && (path.includes('/posts') || path.includes('/users') || path.includes('/health/ready'))) {
    route.push('postgres');
  }
  return route;
}

class Particle {
  constructor(packet, route, id) {
    this.id = id;
    this.packet = packet;
    this.route = route;
    this.color = getParticleColor(packet);
    this.radius = 5;
    this.opacity = 1;
    this.progress = 0;       // 0..1 along current segment
    this.segmentIdx = 0;     // which segment of the route
    this.speed = 0.012 + Math.random() * 0.008; // vary speed slightly
    this.alive = true;
    this.bouncing = false;   // true when deflecting after drop
    this.bounceVx = 0;
    this.bounceVy = 0;
    this.x = 0;
    this.y = 0;
    this.trail = [];         // position history for trail effect
    this._updatePosition();
  }

  _updatePosition() {
    if (this.bouncing) return;

    const from = NODE_POSITIONS[this.route[this.segmentIdx]];
    const to = NODE_POSITIONS[this.route[this.segmentIdx + 1]];
    if (!from || !to) {
      this.alive = false;
      return;
    }

    // Bezier-like curve for visual appeal
    const t = this.progress;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - 30; // slight arc upward

    this.x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * midX + t * t * to.x;
    this.y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * midY + t * t * to.y;
  }

  update() {
    if (!this.alive) return;

    if (this.bouncing) {
      // Physics: apply velocity + gravity + friction
      this.x += this.bounceVx;
      this.y += this.bounceVy;
      this.bounceVy += 0.3;   // gravity
      this.bounceVx *= 0.98;  // friction
      this.opacity -= 0.015;
      this.radius = Math.max(1, this.radius - 0.05);

      if (this.opacity <= 0) {
        this.alive = false;
      }
      return;
    }

    // Save trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    this.progress += this.speed;

    if (this.progress >= 1) {
      // Arrived at next node
      this.segmentIdx++;
      this.progress = 0;

      // Check if blocked at this node (bounce!)
      if (this.packet.blocked && this.segmentIdx >= this.route.length - 1) {
        this._startBounce();
        return;
      }

      // Check if route is complete
      if (this.segmentIdx >= this.route.length - 1) {
        // Fade out at destination
        this.opacity -= 0.05;
        if (this.opacity <= 0) this.alive = false;
        return;
      }
    }

    this._updatePosition();
  }

  _startBounce() {
    this.bouncing = true;
    // Random deflection direction
    const angle = (-Math.PI / 4) + Math.random() * (-Math.PI / 2); // upward-ish
    const speed = 3 + Math.random() * 4;
    this.bounceVx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1);
    this.bounceVy = Math.sin(angle) * speed - 2; // initial upward velocity
    this.radius = 7; // brief enlarge on bounce
  }

  draw(ctx) {
    if (!this.alive) return;

    // Trail
    if (this.trail.length > 1 && !this.bouncing) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.strokeStyle = this.color + '44';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Glow
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.bouncing ? 15 : 8;

    // Main circle
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Bounce: X mark
    if (this.bouncing) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      const s = this.radius;
      ctx.beginPath();
      ctx.moveTo(this.x - s, this.y - s);
      ctx.lineTo(this.x + s, this.y + s);
      ctx.moveTo(this.x + s, this.y - s);
      ctx.lineTo(this.x - s, this.y + s);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Hit test for click
  containsPoint(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return dx * dx + dy * dy <= (this.radius + 4) * (this.radius + 4);
  }
}

function PacketParticles({ packets, width = 900, height = 500, onParticleClick }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const idCounterRef = useRef(0);
  const prevPacketLenRef = useRef(0);
  const animFrameRef = useRef(null);

  // Add new particles when packets arrive
  useEffect(() => {
    if (!packets || packets.length === 0) return;
    if (packets.length <= prevPacketLenRef.current) {
      prevPacketLenRef.current = packets.length;
      return;
    }

    const newPackets = packets.slice(prevPacketLenRef.current);
    prevPacketLenRef.current = packets.length;

    newPackets.forEach(pkt => {
      const route = getRoute(pkt);
      if (route.length < 2) return;
      idCounterRef.current++;
      const p = new Particle(pkt, route, idCounterRef.current);
      particlesRef.current.push(p);
    });

    // Cap max particles
    if (particlesRef.current.length > 200) {
      particlesRef.current = particlesRef.current.slice(-150);
    }
  }, [packets]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Draw node labels (subtle)
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      Object.entries(NODE_POSITIONS).forEach(([name, pos]) => {
        ctx.fillStyle = '#484f5866';
        ctx.fillText(name, pos.x, pos.y + 20);

        // Node dot
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#30363d';
        ctx.fill();
      });

      // Draw edge lines (very subtle)
      ctx.strokeStyle = '#21262d';
      ctx.lineWidth = 1;
      const edgePairs = [
        ['traffic-generator', 'nginx'],
        ['nginx', 'frontend'],
        ['nginx', 'backend'],
        ['backend', 'postgres'],
        ['backend', 'redis'],
      ];
      edgePairs.forEach(([a, b]) => {
        const from = NODE_POSITIONS[a];
        const to = NODE_POSITIONS[b];
        if (from && to) {
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Update & draw particles
      particlesRef.current = particlesRef.current.filter(p => p.alive);
      particlesRef.current.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [width, height]);

  // Click handler
  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (width / rect.width);
    const y = (e.clientY - rect.top) * (height / rect.height);

    // Find clicked particle (reverse order = topmost first)
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      if (p.containsPoint(x, y)) {
        if (onParticleClick) {
          onParticleClick(p.packet, { x: e.clientX, y: e.clientY });
        }
        return;
      }
    }
  }, [onParticleClick, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      className="packet-particles-canvas"
      style={{ cursor: 'crosshair' }}
    />
  );
}

export default PacketParticles;
