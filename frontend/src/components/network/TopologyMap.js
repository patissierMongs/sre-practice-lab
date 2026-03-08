import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ServiceNode from './ServiceNode';
import api from '../../api';

const nodeTypes = { serviceNode: ServiceNode };

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

function TopologyMap({ packets, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [animDots, setAnimDots] = useState([]);
  const dotIdRef = useRef(0);

  // 토폴로지 로드
  useEffect(() => {
    api.get('/traffic/topology').then(res => {
      const data = res.data;

      const flowNodes = data.nodes.map(n => ({
        id: n.id,
        type: 'serviceNode',
        position: POSITIONS[n.name] || { x: 400, y: 300 },
        data: {
          ...n,
          reqPerSec: 0,
        },
      }));

      const flowEdges = data.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#555', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#555' },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    }).catch(() => {
      // fallback: 빈 토폴로지
    });
  }, [setNodes, setEdges]);

  // 패킷 애니메이션
  useEffect(() => {
    if (!packets || packets.length === 0) return;
    const latest = packets[packets.length - 1];
    if (!latest) return;

    // 패킷 경로 결정
    let source, target;
    if (latest.layer === 'nginx') {
      source = 'sre-traffic-generator';
      target = 'sre-nginx';
    } else {
      source = 'sre-nginx';
      target = 'sre-backend';
    }

    dotIdRef.current += 1;
    const dot = {
      id: dotIdRef.current,
      source,
      target,
      blocked: latest.blocked,
      timestamp: Date.now(),
    };

    setAnimDots(prev => [...prev.slice(-30), dot]);

    // 2초 후 제거
    setTimeout(() => {
      setAnimDots(prev => prev.filter(d => d.id !== dot.id));
    }, 2000);
  }, [packets]);

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
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/* SVG 애니메이션 오버레이 */}
      <svg className="packet-anim-overlay">
        {animDots.map(dot => (
          <circle
            key={dot.id}
            r="4"
            fill={dot.blocked ? '#ff4444' : '#00c853'}
            className="packet-dot"
          >
            <animate
              attributeName="cx"
              from="20%"
              to="80%"
              dur="0.8s"
              fill="freeze"
            />
            <animate
              attributeName="cy"
              from="50%"
              to="50%"
              dur="0.8s"
              fill="freeze"
            />
          </circle>
        ))}
      </svg>
    </div>
  );
}

export default TopologyMap;
