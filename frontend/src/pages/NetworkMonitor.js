import React, { useState, useRef, useCallback } from 'react';
import TopologyMap from '../components/network/TopologyMap';
import PacketList from '../components/network/PacketList';
import PacketDetail from '../components/network/PacketDetail';
import DDoSControl from '../components/network/DDoSControl';
import TrafficStats from '../components/network/TrafficStats';
import WebTerminal from '../components/network/WebTerminal';
import { useTrafficWebSocket } from '../components/network/useTrafficWebSocket';
import api from '../api';

function NetworkMonitor() {
  const { packets, connected, clearPackets } = useTrafficWebSocket();
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [capturing, setCapturing] = useState(true);
  const [filter, setFilter] = useState({ method: '', path: '', statusMin: '', statusMax: '' });
  const [activeTab, setActiveTab] = useState('packets'); // 'packets' or 'terminal'
  const [terminalMode, setTerminalMode] = useState(false);
  const commandRef = useRef(null);

  const handleToggleCapture = useCallback(async () => {
    try {
      const res = await api.post('/traffic/capture/toggle');
      setCapturing(res.data.capturing);
    } catch (e) {
      console.error('Toggle capture failed:', e);
    }
  }, []);

  const handleSendCommand = useCallback((cmd) => {
    if (commandRef.current) {
      commandRef.current(cmd);
      setActiveTab('terminal');
    }
  }, []);

  const handleNodeClick = useCallback((serviceName) => {
    setFilter(prev => ({ ...prev, path: '', method: '' }));
    // 해당 서비스의 패킷만 보이도록 간접 필터
  }, []);

  return (
    <div className="network-monitor">
      {/* 상단 통계 바 */}
      <TrafficStats
        packets={packets}
        capturing={capturing}
        onToggleCapture={handleToggleCapture}
      />

      {/* 메인 레이아웃: 좌우 분할 */}
      <div className="nm-main">
        {/* 왼쪽: 토폴로지 + DDoS 컨트롤 */}
        <div className="nm-left">
          <div className="nm-topology">
            <div className="panel-header">
              <h3>Service Topology</h3>
              <div className="ws-status">
                <span className={`ws-dot ${connected ? 'connected' : ''}`} />
                {connected ? 'Live' : 'Disconnected'}
              </div>
            </div>
            <TopologyMap packets={packets} onNodeClick={handleNodeClick} />
          </div>

          <DDoSControl
            onSendCommand={handleSendCommand}
            terminalMode={terminalMode}
          />
        </div>

        {/* 오른쪽: 패킷 리스트/상세 + 터미널 (탭) */}
        <div className="nm-right">
          {/* 탭 헤더 */}
          <div className="nm-tabs">
            <button
              className={`nm-tab ${activeTab === 'packets' ? 'active' : ''}`}
              onClick={() => setActiveTab('packets')}
            >
              📊 Packet Analysis
            </button>
            <button
              className={`nm-tab ${activeTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setActiveTab('terminal')}
            >
              ⌨️ Terminal
            </button>

            {activeTab === 'packets' && (
              <div className="tab-actions">
                <button className="filter-btn" onClick={clearPackets} title="Clear packets">
                  🗑️ Clear
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

          {/* 패킷 분석 탭 */}
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

          {/* 터미널 탭 */}
          {activeTab === 'terminal' && (
            <div className="nm-terminal-panel">
              <WebTerminal onCommandGenerated={commandRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NetworkMonitor;
