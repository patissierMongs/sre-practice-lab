import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ServiceNode from './ServiceNode';
import AnimatedPacketEdge from './AnimatedPacketEdge';
import api from '../../api';

const nodeTypes = { serviceNode: ServiceNode };
const edgeTypes = { animatedPacket: AnimatedPacketEdge };

// 서비스별 고정 위치 (왼→오 흐름)
const POSITIONS = {
  'traffic-generator': { x: 0, y: 150 },
  'nginx': { x: 250, y: 150 },
  'frontend': { x: 500, y: 50 },
  'backend': { x: 500, y: 250 },
  'postgres': { x: 750, y: 200 },
  'redis': { x: 750, y: 300 },
  'prometheus': { x: 500, y: 420 },
  'grafana': { x: 250, y: 420 },
  'alertmanager': { x: 750, y: 420 },
};

// 패킷에서 경로(어떤 엣지를 타는지) 결정
function getPacketRoute(packet) {
  const path = packet.path || '';
  const layer = packet.layer || '';
  const status = packet.status_code || 200;
  const blocked = packet.blocked;

  const route = [];

  // 외부 → nginx
  if (layer === 'nginx') {
    route.push({ edgeKey: 'sre-traffic-generator→sre-nginx', blocked, status });
    if (!blocked) {
      if (path.startsWith('/api')) {
        route.push({ edgeKey: 'sre-nginx→sre-backend', blocked: false, status });
      } else {
        route.push({ edgeKey: 'sre-nginx→sre-frontend', blocked: false, status });
      }
    }
  }
  // 내부 (application 레이어)
  else {
    route.push({ edgeKey: 'sre-nginx→sre-backend', blocked, status });

    // DB 관련 경로
    if (path.includes('/posts') || path.includes('/users') || path.includes('/health/ready')) {
      route.push({ edgeKey: 'sre-backend→sre-postgres', blocked: false, status });
    }
  }

  return route;
}

function getPacketColor(packet) {
  if (packet.blocked) return '#ef5350';     // red - blocked
  if (packet.status_code >= 500) return '#ff9800'; // orange - server error
  if (packet.status_code >= 400) return '#ffb74d'; // light orange - client error
  return '#66bb6a'; // green - success
}

function TopologyMap({ packets, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const dotIdRef = useRef(0);
  const edgeDotsRef = useRef({});        // edgeKey → [dot, ...]
  const trafficCountRef = useRef({});    // edgeKey → count (rolling window)
  const nodeRpsRef = useRef({});         // nodeId → count
  const prevPacketLenRef = useRef(0);
  const updateTimerRef = useRef(null);

  // 토폴로지 로드
  useEffect(() => {
    api.get('/traffic/topology').then(res => {
      const data = res.data;

      const flowNodes = data.nodes.map(n => ({
        id: n.id,
        type: 'serviceNode',
        position: POSITIONS[n.name] || { x: 400, y: 300 },
        data: { ...n, reqPerSec: 0 },
      }));

      const flowEdges = data.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'animatedPacket',
        style: { stroke: '#30363d', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#30363d', width: 16, height: 16 },
        data: { activeDots: [], trafficCount: 0 },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    }).catch(() => {});
  }, [setNodes, setEdges]);

  // 패킷이 올 때마다 애니메이션 dot 추가
  useEffect(() => {
    if (!packets || packets.length === 0) return;
    if (packets.length <= prevPacketLenRef.current) {
      prevPacketLenRef.current = packets.length;
      return;
    }

    // 새로 들어온 패킷들만 처리
    const newPackets = packets.slice(prevPacketLenRef.current);
    prevPacketLenRef.current = packets.length;

    const now = Date.now();

    newPackets.forEach((pkt, idx) => {
      const route = getPacketRoute(pkt);
      const color = getPacketColor(pkt);

      route.forEach((hop, hopIdx) => {
        dotIdRef.current += 1;
        const dot = {
          id: dotIdRef.current,
          color,
          speed: 0.6 + hopIdx * 0.3,  // 뒤 hop일수록 조금 느리게
          delay: hopIdx * 0.15,         // 순차적으로 시작
          createdAt: now,
        };

        if (!edgeDotsRef.current[hop.edgeKey]) {
          edgeDotsRef.current[hop.edgeKey] = [];
        }
        edgeDotsRef.current[hop.edgeKey].push(dot);

        // 트래픽 카운터
        trafficCountRef.current[hop.edgeKey] = (trafficCountRef.current[hop.edgeKey] || 0) + 1;
      });

      // 노드별 RPS 카운트
      if (pkt.dest_service) {
        const nodeId = `sre-${pkt.dest_service}`;
        nodeRpsRef.current[nodeId] = (nodeRpsRef.current[nodeId] || 0) + 1;
      }
    });

    // 엣지 업데이트 스케줄
    if (!updateTimerRef.current) {
      updateTimerRef.current = requestAnimationFrame(() => {
        updateTimerRef.current = null;
        flushEdgeUpdates();
      });
    }
  }, [packets]);

  // dot 정리 & 엣지 데이터 업데이트
  const flushEdgeUpdates = useCallback(() => {
    const now = Date.now();

    // 1.5초 지난 dot 제거
    Object.keys(edgeDotsRef.current).forEach(key => {
      edgeDotsRef.current[key] = edgeDotsRef.current[key].filter(
        d => now - d.createdAt < 1500
      );
    });

    setEdges(prevEdges => prevEdges.map(edge => {
      const edgeKey = `${edge.source}→${edge.target}`;
      const dots = edgeDotsRef.current[edgeKey] || [];
      const count = trafficCountRef.current[edgeKey] || 0;
      const hasTraffic = dots.length > 0;

      return {
        ...edge,
        data: {
          ...edge.data,
          activeDots: dots,
          trafficCount: count > 0 ? count : edge.data?.trafficCount || 0,
        },
        style: {
          stroke: hasTraffic ? '#58a6ff' : '#30363d',
          strokeWidth: hasTraffic ? 2.5 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: hasTraffic ? '#58a6ff' : '#30363d',
          width: 16,
          height: 16,
        },
      };
    }));

    // 노드 RPS 업데이트
    setNodes(prevNodes => prevNodes.map(node => {
      const rps = nodeRpsRef.current[node.id] || 0;
      if (rps !== node.data.reqPerSec) {
        return { ...node, data: { ...node.data, reqPerSec: rps } };
      }
      return node;
    }));
  }, [setEdges, setNodes]);

  // 주기적으로 만료된 dot 정리 + 트래픽 카운터 리셋
  useEffect(() => {
    const interval = setInterval(() => {
      flushEdgeUpdates();
    }, 500);

    // 5초마다 트래픽 카운터 + RPS 리셋
    const resetInterval = setInterval(() => {
      trafficCountRef.current = {};
      nodeRpsRef.current = {};
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(resetInterval);
    };
  }, [flushEdgeUpdates]);

  const handleNodeClick = useCallback((_, node) => {
    if (onNodeClick) onNodeClick(node.data.name);
  }, [onNodeClick]);

  return (
    <div className="topology-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default TopologyMap;
