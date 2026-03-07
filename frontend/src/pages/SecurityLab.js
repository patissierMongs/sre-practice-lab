import React, { useState, useEffect } from 'react';
import api from '../api';

function SecurityLab() {
  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/security/')
      .then(r => { setSecurity(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleXSS = async () => {
    const res = await api.post('/security/toggle-xss');
    setSecurity(res.data);
  };

  const toggleRateLimit = async () => {
    const res = await api.post('/security/toggle-rate-limit');
    setSecurity(res.data);
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Security Lab</h1>

      <div className="alert alert-danger">
        모든 보안 실습은 이 격리된 Docker 환경 내에서만 수행하세요. 외부 시스템에 대한 공격은 불법입니다.
      </div>

      {/* Security Toggles */}
      <div className="card">
        <h2>보안 설정</h2>

        <div className="toggle-row">
          <div>
            <strong>XSS Protection</strong>
            <p style={{ fontSize: 13, color: '#666' }}>서버 측 입력 sanitization (bleach)</p>
          </div>
          <button
            className={`btn ${security?.xss_protection ? 'btn-success' : 'btn-danger'}`}
            onClick={toggleXSS}
          >
            {security?.xss_protection ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="toggle-row">
          <div>
            <strong>Rate Limiting</strong>
            <p style={{ fontSize: 13, color: '#666' }}>Nginx 레벨 요청 제한 (30 req/min)</p>
          </div>
          <button
            className={`btn ${security?.rate_limiting ? 'btn-success' : 'btn-danger'}`}
            onClick={toggleRateLimit}
          >
            {security?.rate_limiting ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* XSS Section */}
      <div className="card">
        <h2>XSS (Cross-Site Scripting) 실습</h2>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>실습 순서</h3>
        <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
          <li>Security Lab에서 <strong>XSS Protection OFF</strong> 확인</li>
          <li><strong>게시판 &rarr; 새 글 작성</strong>에서 XSS 페이로드 입력</li>
          <li>게시글 상세에서 <strong>Vulnerable View</strong> 클릭 &rarr; 스크립트 실행 확인</li>
          <li>Security Lab에서 <strong>XSS Protection ON</strong> 토글</li>
          <li>같은 페이로드로 새 글 작성 &rarr; sanitize 확인</li>
          <li>Safe View vs Vulnerable View 비교</li>
        </ol>

        <h3 style={{ fontSize: 15, marginTop: 16, marginBottom: 8 }}>주요 방어 기법</h3>
        <div className="code-block">
{`# 1. 서버 측: bleach로 HTML 태그 제거
import bleach
safe = bleach.clean(user_input)

# 2. 클라이언트 측: React 기본 이스케이프
# React는 JSX 내 문자열을 자동 이스케이프
# dangerouslySetInnerHTML 사용 시에만 취약

# 3. HTTP 헤더: CSP (Content-Security-Policy)
# Content-Security-Policy: default-src 'self';

# 4. 쿠키: HttpOnly 플래그
# Set-Cookie: session=abc123; HttpOnly; Secure`}
        </div>
      </div>

      {/* DDoS Section */}
      <div className="card">
        <h2>DDoS 공격 &amp; 방어 실습</h2>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>실습 순서</h3>
        <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
          <li>Grafana 대시보드에서 현재 트래픽 확인</li>
          <li>Locust를 실행하여 부하 테스트 시작</li>
          <li>Grafana에서 요청률/에러율 급증 확인</li>
          <li>Prometheus Alert 발생 확인</li>
          <li>Nginx Rate Limiting 동작 확인 (429 응답)</li>
          <li>부하 중단 후 서비스 복구 확인</li>
        </ol>

        <h3 style={{ fontSize: 15, marginTop: 16, marginBottom: 8 }}>Locust 실행 방법</h3>
        <div className="code-block">
{`# 1. Locust 설치
pip install locust

# 2. DDoS 시뮬레이션 실행
locust -f security/scripts/locustfile.py \\
  --host=http://localhost --users 100 --spawn-rate 10

# 3. Locust 웹 UI: http://localhost:8089
# 4. Grafana 실시간 모니터링: http://localhost:3001`}
        </div>

        <h3 style={{ fontSize: 15, marginTop: 16, marginBottom: 8 }}>방어 메커니즘</h3>
        <div className="code-block">
{`# Nginx Rate Limiting (이미 설정됨)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/m;
limit_req zone=api_limit burst=20 nodelay;

# Connection Limiting
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
limit_conn conn_limit 10;`}
        </div>
      </div>

      {/* Monitoring Links */}
      <div className="card">
        <h2>모니터링 도구</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="btn btn-success">
            Grafana Dashboard
          </a>
          <a href="http://localhost:9090" target="_blank" rel="noreferrer" className="btn btn-primary">
            Prometheus
          </a>
          <a href="http://localhost:9093" target="_blank" rel="noreferrer" className="btn btn-warning">
            Alertmanager
          </a>
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="btn" style={{ background: '#666', color: '#fff' }}>
            API Docs
          </a>
        </div>
      </div>
    </div>
  );
}

export default SecurityLab;
