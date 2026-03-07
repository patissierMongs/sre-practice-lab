# 🛡️ SRE Practice Lab — 서버 & 네트워크 보안 실습 프로젝트

> **목표**: DevOps/SRE 엔지니어로서 필요한 인프라 구축, 모니터링, 보안 대응 역량을 실습을 통해 체득한다.

---

## 📋 전체 로드맵

### Phase 1: 기반 인프라 구축 (Week 1-2)
**목표**: Docker 기반으로 웹 서비스의 기본 아키텍처를 구축한다.

| 실습 항목 | 세부 내용 | 핵심 학습 |
|-----------|----------|-----------|
| FastAPI 백엔드 구축 | REST API, DB 연동, 인증 | API 설계, SQLAlchemy, JWT |
| React 프론트엔드 구축 | 게시판 UI, 대시보드 | SPA 구조, API 통신 |
| Docker Compose 구성 | 멀티 컨테이너 오케스트레이션 | 네트워크, 볼륨, 환경변수 |
| PostgreSQL + Redis | 영속 데이터 + 캐시/세션 | DB 설계, 캐싱 전략 |
| Nginx 리버스 프록시 | SSL, 로드밸런싱, Rate Limit | L7 프록시, TLS 설정 |

**결과물**: `docker-compose up` 한 번으로 전체 서비스가 구동되는 환경

---

### Phase 2: 모니터링 & 옵저버빌리티 (Week 3-4)
**목표**: SRE의 핵심인 모니터링/알림 시스템을 구축한다.

| 실습 항목 | 세부 내용 | 핵심 학습 |
|-----------|----------|-----------|
| Prometheus 메트릭 수집 | 애플리케이션/인프라 메트릭 | PromQL, 메트릭 설계 |
| Grafana 대시보드 | 시각화, 알림 설정 | SLI/SLO 대시보드 |
| ELK Stack (선택) | 로그 수집/분석 | 구조화 로깅, 로그 파이프라인 |
| Alertmanager | 알림 라우팅, 에스컬레이션 | 온콜 시뮬레이션 |
| Health Check API | Liveness/Readiness 프로브 | 서비스 상태 관리 |

**결과물**: 실시간 모니터링 대시보드 + 알림 파이프라인

---

### Phase 3: 보안 실습 — 공격 & 방어 (Week 5-7)
**목표**: 웹 보안 취약점을 직접 공격하고 방어 체계를 구축한다.

#### 3-1. XSS (Cross-Site Scripting) 실습
| 단계 | 내용 |
|------|------|
| 취약한 게시판 구현 | 입력 검증 없는 게시판 (의도적 취약점) |
| Stored XSS 공격 | 악성 스크립트 삽입 → 쿠키 탈취 시뮬레이션 |
| Reflected XSS 공격 | URL 파라미터를 통한 스크립트 실행 |
| 방어 구현 | CSP 헤더, 입력 sanitization, HttpOnly 쿠키 |
| WAF 설정 | ModSecurity/Nginx 기반 WAF 규칙 작성 |

#### 3-2. DDoS 공격 & 방어 실습
| 단계 | 내용 |
|------|------|
| 부하 테스트 도구 | Locust/k6로 트래픽 생성 |
| SYN Flood 시뮬레이션 | hping3로 L4 공격 (격리 환경) |
| HTTP Flood 시뮬레이션 | 대량 HTTP 요청 생성 |
| Rate Limiting 구현 | Nginx + 애플리케이션 레벨 제한 |
| 모니터링 연동 | 공격 탐지 → 알림 → 자동 차단 파이프라인 |

#### 3-3. 추가 보안 실습 (선택)
- SQL Injection 공격 & 방어
- CSRF 공격 & 방어
- 컨테이너 보안 스캐닝 (Trivy)
- 시크릿 관리 (Vault)

**결과물**: 공격/방어 시나리오별 보고서 + 자동 방어 파이프라인

---

### Phase 4: Kubernetes & IaC (Week 8-10)
**목표**: 컨테이너 오케스트레이션과 인프라 코드화를 실습한다.

| 실습 항목 | 세부 내용 | 핵심 학습 |
|-----------|----------|-----------|
| K8s 배포 | Deployment, Service, Ingress | Pod 라이프사이클, 스케줄링 |
| Helm Charts | 패키지 매니저로 배포 관리 | 템플릿, values 관리 |
| HPA/VPA | 오토스케일링 설정 | 리소스 관리, 스케일링 전략 |
| Terraform | AWS/GCP 인프라 프로비저닝 | IaC 패턴, State 관리 |
| ArgoCD (선택) | GitOps 기반 배포 | CI/CD 파이프라인 |

**결과물**: K8s 매니페스트 + Terraform 모듈 + GitOps 파이프라인

---

### Phase 5: 클라우드 & 실전 SRE (Week 11-12)
**목표**: 클라우드 환경에서 SRE 프랙티스를 적용한다.

| 실습 항목 | 세부 내용 |
|-----------|----------|
| AWS Free Tier 활용 | EC2, RDS, CloudWatch, ALB |
| Chaos Engineering | Chaos Monkey / LitmusChaos로 장애 주입 |
| Incident Response | 장애 시나리오 → 대응 → 포스트모템 작성 |
| SLI/SLO 정의 | 서비스 레벨 목표 수립 및 모니터링 |
| Runbook 작성 | 운영 매뉴얼 문서화 |

**결과물**: SRE 포트폴리오 완성

---

## 🏗️ 아키텍처 개요

```
[Client] → [Nginx (Reverse Proxy + WAF)]
                    ↓
        ┌──────────┴──────────┐
        ↓                     ↓
  [React Frontend]     [FastAPI Backend]
                              ↓
                    ┌────────┴────────┐
                    ↓                 ↓
              [PostgreSQL]        [Redis]

        ── Monitoring Layer ──
  [Prometheus] → [Grafana] → [Alertmanager]
  [Loki/ELK]  → [Grafana]
```

---

## 🔧 기술 스택 요약

| 영역 | 기술 | 선택 이유 |
|------|------|----------|
| Backend | Python + FastAPI | SRE 자동화 언어, 비동기 지원, 메트릭 연동 용이 |
| Frontend | React + TypeScript | 대시보드 구축, 타입 안정성 |
| DB | PostgreSQL + Redis | 실무 표준, 캐싱 전략 학습 |
| 프록시 | Nginx | Rate Limit, WAF, SSL, 리버스 프록시 |
| 컨테이너 | Docker + Docker Compose | 환경 재현성, 격리된 실습 |
| 오케스트레이션 | Kubernetes (minikube/kind) | SRE 필수 기술 |
| IaC | Terraform | 클라우드 인프라 관리 |
| 모니터링 | Prometheus + Grafana | SRE 업계 표준 |
| 로깅 | Loki or ELK | 로그 파이프라인 |
| 부하 테스트 | Locust / k6 | Python 기반 / 현대적 도구 |
| CI/CD | GitHub Actions | 자동화 파이프라인 |

---

## 📁 디렉토리 구조

```
NetworkPractice/
├── backend/                 # FastAPI 백엔드
│   ├── app/
│   │   ├── api/            # API 라우터
│   │   ├── core/           # 설정, 보안
│   │   ├── models/         # DB 모델
│   │   ├── services/       # 비즈니스 로직
│   │   └── middleware/     # 미들웨어 (로깅, 보안)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                # React 프론트엔드
│   ├── src/
│   └── Dockerfile
├── monitoring/              # 모니터링 설정
│   ├── prometheus/         # Prometheus 설정
│   ├── grafana/            # Grafana 대시보드
│   └── alertmanager/       # 알림 설정
├── security/                # 보안 실습
│   ├── scripts/            # 공격/방어 스크립트
│   └── reports/            # 실습 보고서
├── infra/                   # 인프라 코드
│   ├── docker/             # Docker 관련
│   ├── k8s/                # Kubernetes 매니페스트
│   └── terraform/          # Terraform 모듈
├── docs/                    # 학습 문서
├── scripts/                 # 유틸리티 스크립트
├── .github/workflows/       # CI/CD
├── docker-compose.yml       # 로컬 개발 환경
├── docker-compose.prod.yml  # 프로덕션 환경
├── Makefile                 # 편의 명령어
└── README.md
```

---

## ⚠️ 보안 실습 주의사항

1. **모든 공격 실습은 반드시 자신의 격리된 환경에서만** 수행한다
2. 외부 서비스나 타인의 시스템에 대한 공격은 **불법**이다
3. Docker 네트워크를 활용하여 격리된 실습 환경을 구성한다
4. 실습 결과는 학습 목적으로만 기록하고, 실제 공격 도구를 공개 레포에 포함하지 않는다
