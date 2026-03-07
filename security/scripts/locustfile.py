"""
DDoS 시뮬레이션 - Locust 부하 테스트 스크립트

!! 격리된 Docker 환경에서만 실행할 것 !!

사용법:
  pip install locust
  locust -f security/scripts/locustfile.py --host=http://localhost

  # headless 모드 (CLI only):
  locust -f security/scripts/locustfile.py --host=http://localhost \
    --users 50 --spawn-rate 5 --run-time 60s --headless

Locust Web UI: http://localhost:8089
"""
from locust import HttpUser, task, between


class NormalUser(HttpUser):
    """일반 사용자 트래픽 시뮬레이션"""
    wait_time = between(1, 3)

    @task(3)
    def list_posts(self):
        self.client.get("/api/posts/")

    @task(1)
    def view_post(self):
        self.client.get("/api/posts/1")

    @task(1)
    def health_check(self):
        self.client.get("/api/health")


class AggressiveUser(HttpUser):
    """DDoS 공격자 시뮬레이션 - 빠른 연속 요청

    Rate Limiting이 활성화되면 429 (Too Many Requests) 응답을 받게 됨.
    Grafana에서 요청률 급증 및 429 에러 확인 가능.
    """
    wait_time = between(0, 0.1)

    @task(5)
    def flood_posts(self):
        self.client.get("/api/posts/")

    @task(3)
    def flood_health(self):
        self.client.get("/api/health")

    @task(2)
    def flood_post_create(self):
        self.client.post("/api/posts/", json={
            "title": "Flood test",
            "content": "DDoS simulation post",
        })
