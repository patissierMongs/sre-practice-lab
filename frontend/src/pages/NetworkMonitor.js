import React, { useState, useRef, useCallback } from 'react';
import TopologyMap from '../components/network/TopologyMap';
import PacketList from '../components/network/PacketList';
import PacketDetail from '../components/network/PacketDetail';
import DDoSControl from '../components/network/DDoSControl';
import TrafficStats from '../components/network/TrafficStats';
import WebTerminal from '../components/network/WebTerminal';
import LayerDiagram from '../components/network/LayerDiagram';
import RequestXray from '../components/network/RequestXray';
import PacketParticles from '../components/network/PacketParticles';
import ParticleInspector from '../components/network/ParticleInspector';
import { useTrafficWebSocket } from '../components/network/useTrafficWebSocket';
import { useXrayWebSocket } from '../components/network/useXrayWebSocket';
import api from '../api';

function NetworkMonitor() {
  const { packets, connected, clearPackets } = useTrafficWebSocket();
  const { systemState, traces, connected: xrayConnected, clearTraces } = useXrayWebSocket();
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [inspectedPacket, setInspectedPacket] = useState(null);
  const [inspectPos, setInspectPos] = useState({ x: 0, y: 0 });
  const [capturing, setCapturing] = useState(true);
  const [filter, setFilter] = useState({ method: '', path: '', statusMin: '', statusMax: '' });
  const [activeTab, setActiveTab] = useState('xray');
  const [topoView, setTopoView] = useState('particles'); // 'particles' or 'graph'
  const [terminalMode, setTerminalMode] = useState(false);
  const redCommandRef = useRef(null);
  const blueCommandRef = useRef(null);

  const handleToggleCapture = useCallback(async () => {
    try {
      const res = await api.post('/traffic/capture/toggle');
      setCapturing(res.data.capturing);
    } catch (e) {
      console.error('Toggle capture failed:', e);
    }
  }, []);

  const handleSendCommand = useCallback((cmd) => {
    // Send attack commands to Red Team terminal
    if (redCommandRef.current) {
      redCommandRef.current(cmd);
      setActiveTab('terminal');
    }
  }, []);

  const handleNodeClick = useCallback((serviceName) => {
    setFilter(prev => ({ ...prev, path: '', method: '' }));
  }, []);

  const handleParticleClick = useCallback((packet, pos) => {
    setInspectedPacket(packet);
    setInspectPos(pos);
  }, []);

  return (
    <div className="network-monitor">
      <TrafficStats
        packets={packets}
        capturing={capturing}
        onToggleCapture={handleToggleCapture}
      />

      <div className="nm-main">
        {/* Left: Topology + Attack Control */}
        <div className="nm-left">
          <div className="nm-topology">
            <div className="panel-header">
              <h3>Service Topology</h3>
              <div className="topo-view-toggle">
                <button
                  className={`topo-btn ${topoView === 'particles' ? 'active' : ''}`}
                  onClick={() => setTopoView('particles')}
                  title="Particle view"
                >
                  Particles
                </button>
                <button
                  className={`topo-btn ${topoView === 'graph' ? 'active' : ''}`}
                  onClick={() => setTopoView('graph')}
                  title="Graph view"
                >
                  Graph
                </button>
              </div>
              <div className="ws-status">
                <span className={`ws-dot ${connected ? 'connected' : ''}`} />
                {connected ? 'Live' : 'Disconnected'}
              </div>
            </div>
            {topoView === 'graph' ? (
              <TopologyMap packets={packets} onNodeClick={handleNodeClick} />
            ) : (
              <PacketParticles
                packets={packets}
                onParticleClick={handleParticleClick}
              />
            )}
          </div>

          <DDoSControl
            onSendCommand={handleSendCommand}
            terminalMode={terminalMode}
          />
        </div>

        {/* Right: Packets / Terminal (tabs) */}
        <div className="nm-right">
          <div className="nm-tabs">
            <button
              className={`nm-tab nm-tab-xray ${activeTab === 'xray' ? 'active' : ''}`}
              onClick={() => setActiveTab('xray')}
            >
              System X-ray
            </button>
            <button
              className={`nm-tab ${activeTab === 'packets' ? 'active' : ''}`}
              onClick={() => setActiveTab('packets')}
            >
              Packet Analysis
            </button>
            <button
              className={`nm-tab ${activeTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setActiveTab('terminal')}
            >
              Red / Blue Terminal
            </button>

            {activeTab === 'xray' && (
              <div className="tab-actions">
                <div className="ws-status">
                  <span className={`ws-dot ${xrayConnected ? 'connected' : ''}`} />
                  {xrayConnected ? 'Live' : 'Disconnected'}
                </div>
                <button className="filter-btn" onClick={clearTraces} title="Clear traces">
                  Clear
                </button>
                <span className="packet-count">{traces.length} traces</span>
              </div>
            )}

            {activeTab === 'packets' && (
              <div className="tab-actions">
                <button className="filter-btn" onClick={clearPackets} title="Clear packets">
                  Clear
                </button>
                <span className="packet-count">{packets.length} packets</span>
              </div>
            )}

            {activeTab === 'terminal' && (
              <div className="tab-actions">
                <label className="mode-toggle">
                  <input
                    type="checkbox"
                    checked={terminalMode}
                    onChange={e => setTerminalMode(e.target.checked)}
                  />
                  <span>Terminal Mode</span>
                </label>
              </div>
            )}
          </div>

          {activeTab === 'xray' && (
            <div className="nm-xray-panel">
              <div className="nm-xray-left">
                <LayerDiagram systemState={systemState} />
              </div>
              <div className="nm-xray-right">
                <RequestXray traces={traces} />
              </div>
            </div>
          )}

          {activeTab === 'packets' && (
            <div className="nm-packets-panel">
              <div className="nm-packet-list">
                <PacketList
                  packets={packets}
                  selectedPacket={selectedPacket}
                  onSelectPacket={setSelectedPacket}
                  filter={filter}
                  onFilterChange={setFilter}
                />
              </div>
              <div className="nm-packet-detail">
                <PacketDetail packet={selectedPacket} />
              </div>
            </div>
          )}

          {activeTab === 'terminal' && (
            <div className="nm-terminal-panel dual-terminal">
              <div className="terminal-pane red-pane">
                <WebTerminal team="red" onCommandGenerated={redCommandRef} />
              </div>
              <div className="terminal-divider" />
              <div className="terminal-pane blue-pane">
                <WebTerminal team="blue" onCommandGenerated={blueCommandRef} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Particle Inspector Popup */}
      {inspectedPacket && (
        <ParticleInspector
          packet={inspectedPacket}
          position={inspectPos}
          onClose={() => setInspectedPacket(null)}
        />
      )}
    </div>
  );
}

export default NetworkMonitor;
