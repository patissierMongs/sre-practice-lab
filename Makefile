.PHONY: up down build logs ps clean

# === 기본 명령어 ===
up:
	docker-compose up -d

up-build:
	docker-compose up -d --build

down:
	docker-compose down

down-clean:
	docker-compose down -v --remove-orphans

build:
	docker-compose build

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

ps:
	docker-compose ps

# === 개별 서비스 ===
restart-backend:
	docker-compose restart backend

restart-nginx:
	docker-compose restart nginx

# === DB ===
db-shell:
	docker-compose exec postgres psql -U sreuser -d srelab

db-migrate:
	docker-compose exec backend alembic upgrade head

db-migration:
	docker-compose exec backend alembic revision --autogenerate -m "$(msg)"

# === 모니터링 ===
prom:
	@echo "Prometheus: http://localhost:9090"

grafana:
	@echo "Grafana: http://localhost:3001 (admin/admin)"

# === 보안 실습 (Phase 3) ===
attack-xss:
	@echo "XSS 공격 스크립트는 security/scripts/ 참고"

attack-ddos:
	@echo "DDoS 시뮬레이션은 Locust를 사용합니다"
	@echo "locust -f security/scripts/locustfile.py --host=http://localhost"

# === 정리 ===
clean:
	docker-compose down -v --remove-orphans
	docker system prune -f
