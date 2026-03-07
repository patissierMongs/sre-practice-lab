# 🛡️ SRE Practice Lab

서버 & 네트워크 보안 실습 프로젝트 — DevOps/SRE 엔지니어 역량 강화를 위한 핸즈온 랩

## 🎯 프로젝트 목표

- **인프라 구축**: Docker/K8s 기반 웹 서비스 아키텍처 설계 및 운영
- **모니터링**: Prometheus + Grafana 기반 옵저버빌리티 구축
- **보안 실습**: XSS, DDoS 공격/방어를 직접 체험
- **IaC**: Terraform으로 클라우드 인프라 코드화
- **SRE 프랙티스**: SLI/SLO, Incident Response, Chaos Engineering

## 🏗️ 아키텍처

```
Client → Nginx (Reverse Proxy + WAF + Rate Limit)
              ↓
    ┌─────────┴─────────┐
    React Frontend    FastAPI Backend
                          ↓
                  PostgreSQL + Redis

   Prometheus → Grafana → Alertmanager
```

## 🚀 Quick Start

```bash
# 전체 서비스 빌드 & 시작
docker compose up -d --build

# 로그 확인
docker compose logs -f

# 서비스 상태 확인
docker compose ps

# 종료
docker compose down
```

## 📍 서비스 엔드포인트

| 서비스 | URL | 비고 |
|--------|-----|------|
| **Nginx (메인 진입점)** | http://localhost:8080 | 프론트엔드 + API 프록시 |
| Frontend (직접) | http://localhost:3002 | API 프록시 미지원 |
| Backend API | http://localhost:8000 | 직접 접근 |
| API Docs | http://localhost:8000/docs | Swagger UI |
| Prometheus | http://localhost:9090 | 메트릭 수집 |
| Grafana | http://localhost:3001 | admin / admin |
| Alertmanager | http://localhost:9093 | 알림 관리 |

> **Nginx(`:8080`)를 통해 접속하는 것을 권장합니다.** 프론트엔드와 API가 모두 프록시됩니다.

## 🔬 실습 가이드

### XSS 공격/방어
1. Security Lab에서 **XSS Protection OFF** 확인
2. 게시판 → 새 글 작성에서 XSS 페이로드 입력 (예: `<img src=x onerror="alert('XSS')">`)
3. 게시글 상세에서 **Vulnerable View** 클릭 → 스크립트 실행 확인
4. Security Lab에서 **XSS Protection ON** 토글
5. 같은 페이로드로 새 글 작성 → bleach sanitize 확인
6. Safe View vs Vulnerable View 비교

### DDoS 시뮬레이션
```bash
# Locust 설치 & 실행
pip install locust
locust -f security/scripts/locustfile.py --host=http://localhost:8080
# Locust UI: http://localhost:8089
# Grafana에서 실시간 트래픽 모니터링
```

## 📋 로드맵

자세한 학습 로드맵은 [ROADMAP.md](./ROADMAP.md) 참고

| Phase | 주제 | 기간 |
|-------|------|------|
| 1 | 기반 인프라 구축 | Week 1-2 |
| 2 | 모니터링 & 옵저버빌리티 | Week 3-4 |
| 3 | 보안 실습 (XSS, DDoS) | Week 5-7 |
| 4 | Kubernetes & IaC | Week 8-10 |
| 5 | 클라우드 & 실전 SRE | Week 11-12 |

## ⚠️ 주의사항

모든 보안 공격 실습은 **본 프로젝트의 격리된 Docker 환경 내에서만** 수행합니다. 외부 시스템에 대한 공격은 불법입니다.

## 🛠️ 기술 스택

Python (FastAPI) · React · PostgreSQL · Redis · Nginx · Docker · Kubernetes · Terraform · Prometheus · Grafana
