"""트래픽 캡처 미들웨어 - 모든 HTTP 요청/응답을 패킷 저장소에 기록 + X-ray 트레이싱"""
import re
import time
import uuid
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.services.packet_store import packet_store, Packet
from app.services.trace_store import trace_store, TraceLayer

# 캡처 제외 경로 (무한 루프 방지)
EXCLUDED_PATHS = {"/ws/traffic", "/ws/terminal", "/api/traffic", "/api/system", "/metrics", "/docs", "/redoc", "/openapi.json"}

# XSS 패턴 감지
XSS_PATTERNS = [
    re.compile(r'<script[^>]*>', re.IGNORECASE),
    re.compile(r'javascript:', re.IGNORECASE),
    re.compile(r'on\w+\s*=', re.IGNORECASE),
    re.compile(r'<iframe', re.IGNORECASE),
    re.compile(r'<img[^>]+onerror', re.IGNORECASE),
]

# SQL Injection 패턴 감지
SQLI_PATTERNS = [
    re.compile(r"('\s*(OR|AND)\s+['\d])", re.IGNORECASE),
    re.compile(r'(UNION\s+SELECT)', re.IGNORECASE),
    re.compile(r'(DROP\s+TABLE)', re.IGNORECASE),
    re.compile(r'(;\s*DELETE\s+FROM)', re.IGNORECASE),
    re.compile(r"(--\s*$)", re.IGNORECASE),
]


def _detect_xss(body: str) -> tuple[bool, str]:
    for pattern in XSS_PATTERNS:
        match = pattern.search(body)
        if match:
            return True, match.group()
    return False, ""


def _detect_sqli(body: str, query: str) -> tuple[bool, str]:
    text_to_check = f"{body} {query}"
    for pattern in SQLI_PATTERNS:
        match = pattern.search(text_to_check)
        if match:
            return True, match.group()
    return False, ""


class TrafficCaptureMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if any(path.startswith(exc) for exc in EXCLUDED_PATHS):
            return await call_next(request)

        if not packet_store.capturing:
            return await call_next(request)

        start_time = time.time()
        timestamp = datetime.now(timezone.utc).isoformat()

        source_ip = request.client.host if request.client else "unknown"
        source_port = request.client.port if request.client else 0
        method = request.method
        query = str(request.url.query) if request.url.query else ""
        req_headers = dict(request.headers)

        try:
            body_bytes = await request.body()
            req_body = body_bytes[:1024].decode("utf-8", errors="replace")
        except Exception:
            req_body = ""

        # ═══ X-ray Trace 시작 ═══
        trace_id = str(uuid.uuid4())[:8]
        trace_store.begin_trace(trace_id, method, path, source_ip, timestamp)

        # Layer: Nginx proxy (already passed)
        trace_store.add_layer(trace_id, TraceLayer(
            layer="nginx", action="proxy_pass", result="forwarded",
            duration_ms=0.1, detail=f"→ backend:8000{path}",
            metadata={"rate_limit_zone": "api_limit", "rate": "30r/m", "burst": 20},
        ))

        # Layer: XSS filter
        xss_t = time.time()
        has_xss, xss_match = _detect_xss(req_body)
        from app.api.security import security_state
        xss_on = security_state.get("xss_protection", False)
        if has_xss:
            xss_result = "sanitized" if xss_on else "passed_vulnerable"
            xss_detail = f"Pattern: {xss_match}" + (" → sanitized" if xss_on else " → PASSED (protection OFF)")
        else:
            xss_result = "clean"
            xss_detail = "No XSS patterns"
        trace_store.add_layer(trace_id, TraceLayer(
            layer="middleware", action="xss_filter", result=xss_result,
            duration_ms=round((time.time() - xss_t) * 1000, 3), detail=xss_detail,
            metadata={"protection_enabled": xss_on, "pattern_found": has_xss},
        ))

        # Layer: SQLi check
        sqli_t = time.time()
        has_sqli, sqli_match = _detect_sqli(req_body, query)
        trace_store.add_layer(trace_id, TraceLayer(
            layer="middleware", action="sqli_check",
            result="detected" if has_sqli else "clean",
            duration_ms=round((time.time() - sqli_t) * 1000, 3),
            detail=f"Pattern: {sqli_match}" if has_sqli else "No SQLi patterns",
            metadata={"pattern_found": has_sqli, "orm_parameterized": True},
        ))

        # 요청 처리
        handler_start = time.time()
        response = await call_next(request)
        handler_ms = (time.time() - handler_start) * 1000

        # Layer: Handler
        trace_store.add_layer(trace_id, TraceLayer(
            layer="handler", action=f"{method} {path}",
            result=f"HTTP {response.status_code}",
            duration_ms=round(handler_ms, 3), detail="FastAPI route handler",
            metadata={"status_code": response.status_code},
        ))

        # Layer: Database (heuristic - if path involves DB)
        if any(p in path for p in ["/posts", "/users", "/health/ready"]):
            op = {"GET": "SELECT", "POST": "INSERT", "PUT": "UPDATE", "DELETE": "DELETE"}.get(method, "SELECT")
            table = "posts" if "posts" in path else "users"
            trace_store.add_layer(trace_id, TraceLayer(
                layer="database", action=op,
                result="committed" if response.status_code < 400 else "error",
                duration_ms=round(handler_ms * 0.4, 3),
                detail=f"{op} on {table} via SQLAlchemy",
                metadata={"table": table, "operation": op},
            ))

        # Layer: Rate limit (if 429)
        if response.status_code == 429:
            trace_store.add_layer(trace_id, TraceLayer(
                layer="nginx", action="rate_limit_check", result="blocked",
                duration_ms=0.1, detail="429 Too Many Requests",
                metadata={"zone": "api_limit", "limit": "30r/m"},
            ))

        # Response body 캡처
        elapsed = (time.time() - start_time) * 1000
        resp_headers = dict(response.headers)
        resp_body_bytes = b""
        async for chunk in response.body_iterator:
            if isinstance(chunk, str):
                chunk = chunk.encode("utf-8")
            resp_body_bytes += chunk
        resp_body = resp_body_bytes[:1024].decode("utf-8", errors="replace")
        size_bytes = len(resp_body_bytes)

        new_response = Response(
            content=resp_body_bytes,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

        packet = Packet(
            timestamp=timestamp, source_ip=source_ip, source_port=source_port,
            dest_service="backend", dest_port=8000, method=method, path=path,
            query_params=query, status_code=response.status_code,
            request_headers=req_headers, request_body=req_body,
            response_headers=resp_headers, response_body=resp_body,
            response_time_ms=round(elapsed, 2),
            blocked=response.status_code == 429,
            block_reason="rate_limit" if response.status_code == 429 else "",
            layer="application", size_bytes=size_bytes,
        )
        await packet_store.add_packet(packet)

        # ═══ X-ray Trace 완료 ═══
        await trace_store.complete_trace(trace_id, response.status_code, round(elapsed, 2))

        return new_response
