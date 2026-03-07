import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function Home() {
  const [health, setHealth] = useState(null);
  const [security, setSecurity] = useState(null);

  useEffect(() => {
    api.get('/health').then(r => setHealth(r.data)).catch(() => {});
    api.get('/security/').then(r => setSecurity(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>SRE Practice Lab</h1>
      <p style={{ marginBottom: 20, color: '#666' }}>
        서버 &amp; 네트워크 보안 실습 프로젝트
      </p>

      <div className="grid">
        <div className="card">
          <h2>서비스 상태</h2>
          <p>Backend: {health
            ? <span className="status-on">Healthy</span>
            : <span className="status-off">Checking...</span>}
          </p>
          <p style={{ marginTop: 8 }}>
            XSS Protection: {security?.xss_protection
              ? <span className="tag tag-protected">ON</span>
              : <span className="tag tag-vulnerable">OFF</span>}
          </p>
        </div>

        <div className="card">
          <h2>Quick Links</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/posts" className="btn btn-primary">게시판</Link>
            <Link to="/security" className="btn btn-warning">Security Lab</Link>
            <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="btn btn-success">
              Grafana Dashboard
            </a>
          </div>
        </div>

        <div className="card">
          <h2>Architecture</h2>
          <div className="code-block">
{`Client -> Nginx (Reverse Proxy)
         |
  React <-> FastAPI
              |
     PostgreSQL + Redis

Prometheus -> Grafana`}
          </div>
        </div>

        <div className="card">
          <h2>실습 Phase</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ padding: '4px 0' }}>Phase 1: 인프라 구축</li>
            <li style={{ padding: '4px 0' }}>Phase 2: 모니터링</li>
            <li style={{ padding: '4px 0' }}>Phase 3: XSS/DDoS 보안 실습</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Home;
