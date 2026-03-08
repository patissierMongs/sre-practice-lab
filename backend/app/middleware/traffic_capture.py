"""트래픽 캡처 미들웨어 - 모든 HTTP 요청/응답을 패킷 저장소에 기록"""
import time
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.services.packet_store import packet_store, Packet

# 캡처 제외 경로 (무한 루프 방지)
EXCLUDED_PATHS = {"/ws/traffic", "/ws/terminal", "/api/traffic", "/metrics", "/docs", "/redoc", "/openapi.json"}


class TrafficCaptureMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # 제외 경로 체크
        path = request.url.path
        if any(path.startswith(exc) for exc in EXCLUDED_PATHS):
            return await call_next(request)

        if not packet_store.capturing:
            return await call_next(request)

        start_time = time.time()
        timestamp = datetime.now(timezone.utc).isoformat()

        # Request 정보 캡처
        source_ip = request.client.host if request.client else "unknown"
        source_port = request.client.port if request.client else 0
        method = request.method
        query = str(request.url.query) if request.url.query else ""

        # Request headers
        req_headers = dict(request.headers)

        # Request body (truncate to 1KB)
        try:
            body_bytes = await request.body()
            req_body = body_bytes[:1024].decode("utf-8", errors="replace")
        except Exception:
            req_body = ""

        # 요청 처리
        response = await call_next(request)

        # Response 정보 캡처
        elapsed = (time.time() - start_time) * 1000  # ms
        resp_headers = dict(response.headers)

        # Response body 캡처 (streaming response에서 추출)
        resp_body = ""
        resp_body_bytes = b""
        async for chunk in response.body_iterator:
            if isinstance(chunk, str):
                chunk = chunk.encode("utf-8")
            resp_body_bytes += chunk
        resp_body = resp_body_bytes[:1024].decode("utf-8", errors="replace")
        size_bytes = len(resp_body_bytes)

        # 새 Response 생성 (body를 다시 돌려줘야 함)
        new_response = Response(
            content=resp_body_bytes,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

        # 패킷 생성 및 저장
        packet = Packet(
            timestamp=timestamp,
            source_ip=source_ip,
            source_port=source_port,
            dest_service="backend",
            dest_port=8000,
            method=method,
            path=path,
            query_params=query,
            status_code=response.status_code,
            request_headers=req_headers,
            request_body=req_body,
            response_headers=resp_headers,
            response_body=resp_body,
            response_time_ms=round(elapsed, 2),
            blocked=False,
            block_reason="",
            layer="application",
            size_bytes=size_bytes,
        )
        await packet_store.add_packet(packet)

        return new_response
