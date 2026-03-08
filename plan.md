# SRE Network Traffic Visualizer - 최종 구현 계획

## 개요
실시간 네트워크 트래픽 시각화 학습 도구.
Wireshark 스타일 패킷 인스펙터 + 인터랙티브 서비스 토폴로지 + DDoS 시뮬레이션.

## 결정 사항
- **DDoS 시뮬레이터**: 별도 `traffic-generator` 컨테이너
- **캡처 범위**: Nginx 로그 + Backend 미들웨어 양쪽
- **시각화**: ReactFlow + SVG dot 애니메이션
- **토폴로지**: Docker API (docker.sock 마운트)
- **UI 레이아웃**: 좌우 분할 (왼쪽: 토폴로지, 오른쪽: 패킷리스트/상세)
- **구현 범위**: 전체 10단계 한번에

---

## 아키텍처

```
[traffic-generator] ──→ [Nginx :80] ──→ [Backend :8000] ──→ [PostgreSQL :5432]
  (DDoS 시뮬레이션)         │ │                │                  [Redis :6379]
                    (access.log)        (미들웨어 캡처)
                           │                  │
                           ▼                  ▼
                    [Backend: Traffic Collector] ←── docker.sock ──→ [Docker API]
                           │
                      (WebSocket)
                           ▼
                    [React Frontend]
                    ┌─────────────────────────────────────────────┐
                    │ [컨트롤바] [DDoS 컨트롤] [실시간 통계 바]     │
                    ├─────────────────────┬───────────────────────┤
                    │  Topology Map       │  Packet List          │
                    │  (ReactFlow)        │  (Wireshark식 테이블)   │
                    │  ● 초록=통과         │  색상코딩 + 필터       │
                    │  ● 빨강=차단         ├───────────────────────┤
                    │  네트워크 세그먼트    │  Packet Detail        │
                    │  포트 정보           │  (트리뷰, 헤더/바디)    │
                    └─────────────────────┴───────────────────────┘
```

---

## Step 1: 패킷 저장소 + 캡처 미들웨어

### `backend/app/services/packet_store.py`
- `collections.deque(maxlen=2000)` 기반 ring buffer
- 패킷 데이터 구조:
  ```python
  {
    "id": int,
    "timestamp": str,          # ISO 8601
    "source_ip": str,
    "source_port": int,
    "dest_service": str,       # "nginx", "backend"
    "dest_port": int,
    "method": str,
    "path": str,
    "status_code": int,
    "request_headers": dict,
    "request_body": str,       # truncated 1KB
    "response_headers": dict,
    "response_body": str,      # truncated 1KB
    "response_time_ms": float,
    "blocked": bool,           # Nginx 429 등
    "block_reason": str,       # "rate_limit", "waf" 등
    "layer": str,              # "nginx" or "application"
    "size_bytes": int
  }
  ```
- 통계 계산 메서드: `get_stats()` → req/s, 통과율, 차단율, 평균 응답시간
- WebSocket 구독자 목록 관리 → 새 패킷 도착 시 broadcast

### `backend/app/middleware/traffic_capture.py`
- FastAPI 미들웨어로 모든 요청/응답 캡처
- `/ws/`, `/api/traffic/` 경로는 캡처 제외 (무한 루프 방지)
- 캡처 ON/OFF 토글 가능
- 캡처한 패킷을 packet_store에 추가 + WebSocket broadcast

---

## Step 2: Nginx 로그 파서

### `backend/app/services/nginx_log_parser.py`
- Nginx access.log를 `asyncio` 기반으로 tail -f 방식 실시간 파싱
- 로그 포맷 파싱: `$remote_addr`, `$request`, `$status`, `$request_time` 등
- status 429 → `blocked: true, block_reason: "rate_limit"`
- 파싱된 패킷을 packet_store에 추가
- startup 이벤트에서 백그라운드 task로 시작

### docker-compose 변경
- nginx 로그를 named volume으로 공유:
  ```yaml
  nginx:
    volumes:
      - nginx-logs:/var/log/nginx
  backend:
    volumes:
      - nginx-logs:/var/log/nginx:ro
  ```

---

## Step 3: Traffic REST API + WebSocket

### `backend/app/api/traffic.py`
- `GET /api/traffic/status` - 캡처 상태 + 요약 통계
- `POST /api/traffic/capture/toggle` - 캡처 ON/OFF
- `GET /api/traffic/packets` - 패킷 목록 (query: method, status_min, status_max, path, limit)
- `GET /api/traffic/packets/{id}` - 패킷 상세
- `GET /api/traffic/topology` - Docker 기반 토폴로지
- `GET /api/traffic/stats` - 실시간 통계 (req/s, 통과, 차단, 평균응답시간)
- `POST /api/traffic/simulate/start` - DDoS 시작 (type, rps, concurrency, duration)
- `POST /api/traffic/simulate/stop` - DDoS 중지
- `GET /api/traffic/simulate/status` - 시뮬레이션 상태
- `WS /ws/traffic` - 실시간 패킷 스트리밍

### `backend/app/main.py` 수정
- traffic 라우터 등록
- WebSocket 엔드포인트 등록
- startup에서 nginx 로그 파서 백그라운드 task 시작
- CORS에 WebSocket 허용

---

## Step 4: Docker API 토폴로지

### `backend/app/services/topology.py`
- `docker` Python 패키지 사용
- docker.sock에서 컨테이너 목록 조회
- 수집 정보:
  - 서비스명 (container name에서 `sre-` prefix 제거)
  - 상태 (running/stopped/restarting)
  - 포트 매핑 (host:container)
  - 네트워크 (이름, IP, 서브넷)
  - 이미지 이름
- 서비스 간 연결 관계 추론:
  - 환경변수에서 다른 서비스 참조 감지 (DATABASE_URL → postgres)
  - depends_on은 compose에서만 보이므로 환경변수 + 알려진 패턴으로 추론
- 응답 형태: `{ nodes: [...], edges: [...], networks: [...] }`

### docker-compose 변경
```yaml
backend:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

### requirements.txt 추가
```
docker==7.0.0
websockets==12.0
```

---

## Step 5: traffic-generator 컨테이너

### `traffic-generator/app.py` (FastAPI)
- `POST /start` - 시뮬레이션 시작
  - params: `type` (flood/slowloris/burst), `rps`, `concurrency`, `duration_sec`
  - asyncio tasks로 요청 생성
- `POST /stop` - 시뮬레이션 중지
- `GET /status` - 상태 (running, type, total_sent, elapsed)

### `traffic-generator/Dockerfile`
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
```

### `traffic-generator/requirements.txt`
```
fastapi==0.109.2
uvicorn[standard]==0.27.1
httpx==0.26.0
```

### 시뮬레이션 로직
- **HTTP Flood**: `asyncio.gather`로 N개 동시 요청, 초당 M개 속도 제한
- **Slowloris**: httpx로 연결 후 헤더를 1바이트씩 천천히 전송
- **Burst**: 100개 동시 요청 → 5초 대기 → 반복

### docker-compose 추가
```yaml
traffic-generator:
  build: ./traffic-generator
  container_name: sre-traffic-generator
  ports:
    - "8001:8001"
  environment:
    - TARGET_URL=http://nginx:80
  depends_on:
    - nginx
  networks:
    - app-network
  restart: unless-stopped
```

---

## Step 6: Frontend - reactflow 설치 + NetworkMonitor 페이지

### 패키지 설치
```bash
cd frontend && npm install reactflow
```

### `frontend/src/pages/NetworkMonitor.js`
- 좌우 분할 레이아웃 (CSS Grid 또는 Flexbox)
- 왼쪽 (45%): TopologyMap
- 오른쪽 (55%): 상단 PacketList + 하단 PacketDetail
- 상단 고정 바: TrafficStats + DDoSControl
- WebSocket 연결 관리 (useTrafficWebSocket 훅)
- 패킷 상태 관리 (useState + useRef로 성능 최적화)

### `frontend/src/components/network/useTrafficWebSocket.js`
- WebSocket 연결/재연결 로직
- 받은 패킷을 state에 추가
- 통계 업데이트
- 연결 상태 표시 (connected/disconnected/reconnecting)

---

## Step 7: TopologyMap + ServiceNode

### `frontend/src/components/network/TopologyMap.js`
- ReactFlow 기반 그래프
- `/api/traffic/topology`에서 노드/엣지 데이터 로드
- 자동 레이아웃: 왼→오 흐름 (dagre 없이 수동 좌표 계산)
- 네트워크 세그먼트를 ReactFlow Background로 표시
- 엣지에 SVG animated circle 오버레이:
  - `<circle>` + `<animateMotion>` (SVG SMIL) 또는 CSS animation
  - 새 패킷마다 해당 경로에 점 하나 생성 → 이동 → 소멸
  - 통과=초록, 차단=빨강 (Nginx 노드에서 X 이펙트)

### `frontend/src/components/network/ServiceNode.js`
- 커스텀 ReactFlow 노드
- 표시: 서비스명, 포트(들), 상태 indicator, req/s 카운터
- 색상: running=초록 테두리, stopped=빨강, restarting=주황
- 클릭 → 해당 서비스 관련 패킷만 필터

---

## Step 8: PacketList + PacketDetail

### `frontend/src/components/network/PacketList.js`
- 고정 헤더 테이블: No | Time | Source | Dest | Method | Path | Status | Size | Duration
- 행 색상 코딩:
  - 2xx: `#e8f5e9` (연초록)
  - 3xx: `#e3f2fd` (연파랑)
  - 4xx: `#fff3e0` (연주황), 429: `#f3e5f5` (연보라)
  - 5xx: `#ffebee` (연빨강)
  - blocked: `#fce4ec` (핑크) + 🚫 아이콘
- 자동 스크롤 (토글 버튼)
- 필터 바: method 드롭다운, status 입력, path 검색
- 가상 스크롤링 (패킷 많을 때 성능)
- 행 클릭 → PacketDetail 활성화

### `frontend/src/components/network/PacketDetail.js`
- 접기/펼치기 트리뷰
  ```
  ▼ General
    Source: 172.28.0.5:43210 → nginx:80
    Timestamp: 2024-03-08T14:30:00.123Z
    Layer: nginx / application
    Blocked: No
  ▼ Request
    Method: POST
    Path: /api/posts
    ▶ Headers (7개)
      Content-Type: application/json
      User-Agent: httpx/0.26.0
      ...
    ▶ Body
      {"title": "test", "content": "hello"}
  ▼ Response
    Status: 201 Created
    ▶ Headers (5개)
    ▶ Body (truncated)
  ▼ Timing
    Response Time: 23ms
  ```
- Raw JSON 토글 버튼

---

## Step 9: DDoSControl + TrafficStats

### `frontend/src/components/network/DDoSControl.js`
- 컨트롤 패널 (접기 가능):
  - 공격 타입: 드롭다운 (HTTP Flood / Slowloris / Burst)
  - 초당 요청: 슬라이더 (1-100)
  - 동시 연결: 슬라이더 (1-50)
  - 지속 시간: 입력 (초)
  - [시작] 빨간 버튼 / [중지] 버튼
- 실행 중 표시: 전송수, 경과시간, 애니메이션 indicator
- 경고 배너: "이 기능은 학습 목적으로만 사용하세요"

### `frontend/src/components/network/TrafficStats.js`
- 상단 가로 바 형태
- 지표:
  - 🟢 캡처 상태 (ON/OFF + 토글)
  - req/s (실시간 숫자)
  - Total: N packets
  - Passed: N (초록) / Blocked: N (빨강)
  - Avg Response: Nms
  - Error Rate: N%

---

## Step 10: 통합 & 스타일링

### `frontend/src/App.js`
- `/network` 라우트 추가
- Navbar에 "Network Monitor" 링크

### `frontend/src/App.css` 추가 스타일
- `.network-monitor` 다크 테마 (#0d1117 배경, #c9d1d9 텍스트)
- 좌우 분할 레이아웃 CSS
- 패킷 행 색상
- SVG 애니메이션 keyframes
- 트리뷰 스타일
- 반응형 조절

### `docker-compose.yml` 최종 수정
- traffic-generator 서비스 추가
- backend: docker.sock + nginx-logs 볼륨
- nginx-logs named volume 추가

### `backend/requirements.txt` 추가
- `docker==7.0.0`
- `websockets==12.0`
- `aiofiles==23.2.1`

---

## 파일 생성/수정 목록

### 새 파일 (Backend)
1. `backend/app/services/packet_store.py`
2. `backend/app/middleware/traffic_capture.py`
3. `backend/app/services/nginx_log_parser.py`
4. `backend/app/api/traffic.py`
5. `backend/app/services/topology.py`

### 새 파일 (traffic-generator)
6. `traffic-generator/app.py`
7. `traffic-generator/requirements.txt`
8. `traffic-generator/Dockerfile`

### 새 파일 (Frontend)
9. `frontend/src/pages/NetworkMonitor.js`
10. `frontend/src/components/network/useTrafficWebSocket.js`
11. `frontend/src/components/network/TopologyMap.js`
12. `frontend/src/components/network/ServiceNode.js`
13. `frontend/src/components/network/PacketList.js`
14. `frontend/src/components/network/PacketDetail.js`
15. `frontend/src/components/network/DDoSControl.js`
16. `frontend/src/components/network/TrafficStats.js`

### 수정 파일
17. `backend/app/main.py` - 라우터/미들웨어/startup 추가
18. `backend/requirements.txt` - docker, websockets, aiofiles
19. `frontend/package.json` - reactflow 추가
20. `frontend/src/App.js` - 라우트 추가
21. `frontend/src/App.css` - 네트워크 모니터 스타일
22. `docker-compose.yml` - traffic-generator, 볼륨 추가
