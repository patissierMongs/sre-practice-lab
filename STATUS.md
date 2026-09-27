# 구현 현황 / Implementation Status

> 이 문서는 코드를 직접 대조해 작성했습니다. README·커밋 메시지·기존 주석의 주장은 근거로 삼지 않고, 실제 소스에서 확인된 것만 적었습니다.
> This document was written by cross-checking the source directly. Claims in the README, commit messages, or existing comments were not taken as evidence — only what the code actually does is recorded here.
>
> 기준 시각 / As of: 2026-09-27

---

## 최종 목표 / Final Goal

DevOps/SRE 실습을 위해, 하나의 Docker Compose 스택 안에서 다음을 **눈으로 확인하며** 익히는 것이 목표입니다.
The goal is one Docker Compose stack where a learner can **see and practice**:

1. 웹 서비스 인프라 구축 (backend/frontend/proxy/DB/cache)
   Building a web service stack (backend / frontend / proxy / DB / cache).
2. 옵저버빌리티 (metrics → dashboard → alerting)
   Observability (metrics → dashboard → alerting).
3. 공격/방어 보안 실습 (XSS, DDoS, rate limit, iptables)
   Offensive/defensive security practice (XSS, DDoS, rate limit, iptables).
4. 요청이 커널부터 애플리케이션까지 지나는 경로의 실시간 시각화
   Real-time visualization of a request's path from kernel to application.
5. (로드맵) Kubernetes · Terraform · 클라우드 · Chaos Engineering
   (Roadmap) Kubernetes, Terraform, cloud, chaos engineering.

현재는 **1~3을 실습 가능한 수준까지, 4를 중심 기능으로** 구현했고, **5는 착수 전**입니다.
Today, **items 1–3 are usable for practice, item 4 is the flagship feature, and item 5 has not been started.**

---

## 요약 / Summary

| Phase | 상태 / Status |
| --- | --- |
| Phase 1 — 인프라 / Infrastructure | 대부분 구현 / Mostly implemented |
| Phase 2 — 모니터링 / Monitoring | 대부분 구현 / Mostly implemented |
| Phase 3 — 보안 / Security | 부분 구현 / Partial |
| Phase 4 — K8s / IaC | 미착수 / Not started |
| Phase 5 — 클라우드 / SRE 프랙티스 / Cloud & SRE practices | 미착수 / Not started |
| 확장 기능 — Network Traffic Visualizer | 구현 완료 / Implemented (핵심 기능 / flagship) |

범례 / Legend: ✅ 구현 / Implemented · 🟡 부분 / Partial · ❌ 미구현 / Not implemented

---

## Phase 1 — 인프라 / Infrastructure

| 항목 / Item | 상태 | 근거 / Evidence |
| --- | --- | --- |
| FastAPI REST CRUD | 🟡 | 게시글 목록/조회/생성/소프트삭제 동작. 인증 의존성 없음, `author_id=1` 하드코딩 (`backend/app/api/posts.py:86`). alembic 설치돼 있으나 마이그레이션 폴더 없음 — 테이블은 `create_all`로 생성 (`main.py:65`) |
| React 프론트엔드 / React frontend | ✅ | 게시판·Security Lab·Network Monitor 페이지 (`frontend/src/App.js`). TypeScript는 아님 — 모두 `.js` |
| Docker Compose | ✅ | 9개 서비스, `172.28.0.0/16` 브리지 네트워크, postgres/redis 헬스체크 (`docker-compose.yml`). `docker-compose.prod.yml`은 없음 |
| PostgreSQL | ✅ | asyncpg 연동 (`core/database.py`) |
| Redis | 🟡 | readiness 체크와 X-ray 통계용 `INFO` 조회에만 사용. 캐시·세션 용도 없음 (`health.py:34`, `system.py:347`) |
| Nginx 리버스 프록시 / reverse proxy | ✅ | 프론트·API 프록시 (`infra/docker/nginx/conf.d/default.conf`) |
| Nginx Rate Limit | 🟡 | `/api/`에 30r/m + 연결 10개 제한 (`nginx.conf:25-27`). UI 폴링도 함께 제한됨 |
| JWT 인증 / JWT auth | ❌ | `python-jose` 설치돼 있으나 어디서도 import하지 않음. 로그인/토큰 엔드포인트 없음. 시작 시 `admin/admin123` 시드 유저만 생성 (`main.py:71-83`) |
| Nginx SSL / TLS | ❌ | compose가 `443:443`을 매핑하지만 리스너는 `listen 80`뿐, 인증서·`ssl_*` 지시어 없음 (`default.conf:10`) |
| Nginx 로드밸런싱 / load balancing | ❌ | 각 upstream이 단일 서버 (`default.conf:1-7`) |

---

## Phase 2 — 모니터링 / Monitoring

| 항목 / Item | 상태 | 근거 / Evidence |
| --- | --- | --- |
| Prometheus 메트릭 / metrics | ✅ | `Instrumentator().instrument(app).expose(app)`로 `/metrics` 제공 (`main.py:52`) |
| Prometheus 스크레이프 타깃 / scrape targets | 🟡 | 실제 타깃은 `backend`와 `prometheus` 2개. nginx/postgres/redis exporter 잡은 주석 처리 (`prometheus.yml:25-38`) |
| Grafana 대시보드 / dashboard | 🟡 | 데이터소스·대시보드 프로비저닝 완료, 패널 7개 (`sre-overview.json`). "In-Progress Requests" 패널은 기본 설정에서 나오지 않는 메트릭을 써서 비어 있음. SLO 패널·Grafana 알림 없음 |
| Alertmanager | 🟡 | 규칙 4종(ServiceDown, HighErrorRate, HighLatency, SuspiciousTraffic)과 심각도 라우팅 존재. 그러나 두 receiver 모두 `webhook_configs: []` — 실제 알림은 전송되지 않음 (`alertmanager.yml:19,22`) |
| Health check (liveness/readiness) | ✅ | `/api/health` liveness, `/api/health/ready`가 DB·Redis 확인 (`health.py:14,20`) |
| ELK / Loki | ❌ | 서비스·설정 없음. 로깅은 structlog JSON을 stdout으로 |

---

## Phase 3 — 보안 / Security

| 항목 / Item | 상태 | 근거 / Evidence |
| --- | --- | --- |
| 취약 게시판 / vulnerable board | ✅ | 보호 OFF 시 원본 HTML 저장, `dangerouslySetInnerHTML`로 렌더 (`posts.py:75-80`, `PostDetail.js:59`) |
| Stored XSS | ✅ | 위와 동일 경로. 페이로드 예시 `security/scripts/xss_payloads.py` |
| XSS 토글 → bleach | ✅ | `security_state["xss_protection"]`(기본 OFF)를 읽어 `bleach.clean` 적용. `content_safe`는 항상 정제 (`posts.py:71-73`) |
| 보안 헤더 / security headers | ✅ | X-Frame-Options, nosniff, X-XSS-Protection, Referrer-Policy (`nginx.conf:30-33`) |
| Locust 부하 테스트 / load test | ✅ | NormalUser/AggressiveUser (`security/scripts/locustfile.py`), 호스트에서 실행 |
| HTTP Flood | ✅ | traffic-generator가 flood/slowloris/burst를 `nginx:80`에 실행 (`traffic-generator/app.py:37-96`) |
| Reflected XSS | ❌ | 쿼리 파라미터를 반사하는 엔드포인트/페이지 없음 |
| CSP / HttpOnly 쿠키 | ❌ | CSP 헤더 주석 처리 (`nginx.conf:36`), 쿠키를 설정하는 코드 없음 |
| WAF / ModSecurity | ❌ | WAF 규칙 없음. 로그 파서가 403을 "waf_blocked"로 라벨링하지만 403을 만드는 곳이 없음 (`nginx_log_parser.py:53`) |
| Rate Limit 토글 / toggle | 🟡 | `toggle-rate-limit`은 dict 값만 뒤집음. Nginx나 앱 동작은 바뀌지 않음 (`security.py:67`) |
| 앱 레벨 rate limit / app-level | ❌ | `ENABLE_RATE_LIMIT`, `RATE_LIMIT_PER_MINUTE`가 어디서도 읽히지 않음 |
| SYN Flood (hping3) | 🟡 | 백엔드 이미지에 hping3 포함, 프리셋이 명령 텍스트만 생성. 탐지는 백엔드 컨테이너 `ss` 기반이라 nginx의 SYN-RECV를 볼 수 없음 (`system.py:212`) |
| 탐지 → 알림 → 자동 차단 / detect→alert→block | 🟡 | 정규식 탐지 + Prometheus 규칙은 있으나 알림은 나가지 않고, 자동 차단은 없음. iptables 규칙은 수동 추가만 |
| SQL Injection | 🟡 | 정규식 탐지만 존재. 취약한 raw-SQL 엔드포인트 없음, `/api/posts`에 `search` 파라미터 없음(프리셋은 `?search=` 호출) (`traffic_capture.py:28-34`) |
| CSRF / Trivy / Vault | ❌ | 미구현. 시크릿은 compose에 하드코딩 |
| iptables API | 🟡 | 입력 검증과 함께 실제 `iptables` 명령을 호출하지만, 백엔드 컨테이너에 `NET_ADMIN` 권한이 없어 배포 상태에서는 실패 (`security.py:78,121-151`) |

---

## Phase 4 / 5 — K8s · IaC · 클라우드 / Cloud

- ❌ Kubernetes, Helm, HPA/VPA: `infra/k8s/`에 `.gitkeep`만 존재 / only `.gitkeep`.
- ❌ Terraform, ArgoCD: `infra/terraform/`에 `.gitkeep`만 존재 / only `.gitkeep`.
- ❌ 클라우드(AWS), Chaos Engineering, Incident Response, SLI/SLO, Runbook: 미착수 / not started.
- ❌ CI/CD (GitHub Actions): `.github/` 디렉토리 없음 / no `.github/` directory.

---

## 확장 기능 — Network Traffic Visualizer

`plan.md`의 10단계는 모두 구현되었으며, 현재 프로젝트의 핵심 기능입니다.
All 10 steps in `plan.md` are implemented; this is the project's flagship feature.

- ✅ **패킷 저장소 / 캡처 미들웨어** — `deque(maxlen=2000)` 링버퍼 + 모든 요청/응답 캡처.
- ✅ **Nginx 로그 파서** — 공유 볼륨의 `access.log`를 `tail -F`로 파싱, 429를 blocked로 표시.
- ✅ **Traffic REST API + WebSocket** — 패킷 스트리밍, docker.sock 기반 토폴로지(정적 fallback 포함).
- ✅ **토폴로지 Simulation** (`PacketParticles.js`) — Canvas로 그린 Packet-Tracer 스타일. 실제 패킷을 봉투 애니메이션으로, 드롭 잔해·SYN 파형·포트스캔 물결을 표시.
- ✅ **토폴로지 Graph** (`TopologyMap.js`) — ReactFlow 노드/엣지, 엣지 위 패킷 도트 애니메이션.
- ✅ **패킷 리스트/상세** (`PacketList.js`, `PacketDetail.js`) — 상태코드 색상, 필터, 헤더/바디 트리(1KB 절단).
- ✅ **System X-ray** (`system.py /state`, `/ws/xray`) — 2초마다 `ss`, `iptables`, conntrack, dev 통계, `pg_stat_*`, Redis `INFO`, 풀 카운터를 푸시. 일부 지표(nginx 트레이스 계층, DB 타이밍)는 합성값.
- ✅ **TCP 테이블** (`TcpTable.js`) — 백엔드 컨테이너 `ss -tan` 상태별 집계.
- ✅ **이벤트 타임라인** (`EventTimeline.js`) — 트레이스와 상태 변화를 attack/detection/defense/recovery 이벤트로 상관.
- ✅ **Red/Blue 웹 터미널** (`WebTerminal.js`) — 백엔드 컨테이너 내부의 실제 PTY bash, xterm.js. **인증 없음, root 실행** (로컬 실습 전용).
- ✅ **DDoS Control / Defense Lab** (`DDoSControl.js`, `DefenseLab.js`) — 공격 프리셋, XSS/rate-limit 토글, iptables 규칙 프리셋.
- ✅ **traffic-generator** (`traffic-generator/app.py`) — `:8001` FastAPI, httpx로 flood/slowloris/burst.

두 가지 유의점 / Two notes:
- WebSocket 경로는 `/api/traffic/ws/traffic`이며, 프론트는 Nginx의 `/api/`에 Upgrade 헤더가 없어 `ws://<host>:8000`으로 직접 접속합니다 (`useTrafficWebSocket.js:3`).
  The WebSocket lives at `/api/traffic/ws/traffic`; the frontend connects directly to `ws://<host>:8000` because Nginx `/api/` has no Upgrade headers.

---

## 알려진 격차 / Known Gaps

- UI 토글 중 **Rate Limit 토글은 실제 동작을 바꾸지 않습니다** (표시값만 변경).
  The **Rate Limit toggle does not change real behaviour** (display only).
- **iptables API / 브라우저 터미널은 인증이 없고 root로 실행**됩니다. 로컬에서만 사용하세요.
  The **iptables API and browser terminals are unauthenticated and run as root**. Local use only.
- 백엔드는 `uvicorn --reload` + 소스 바인드 마운트, 즉 **개발 모드**로 실행됩니다.
  The backend runs `uvicorn --reload` with a source bind mount — i.e. **development mode**.
- Alertmanager는 규칙이 있어도 **receiver가 비어 있어 알림이 발송되지 않습니다.**
  Alertmanager has rules but **empty receivers, so no notification is sent.**
- 백엔드 이미지의 Red/Blue 셸 프로필(`redteam.sh`/`blueteam.sh`)의 alias 정의가 컨테이너 셸에서 깨져, 터미널 시작 시 `alias: ... not found` 메시지가 출력됩니다.
  The Red/Blue shell profiles' alias definitions break in the container shell, printing `alias: ... not found` at terminal start.
