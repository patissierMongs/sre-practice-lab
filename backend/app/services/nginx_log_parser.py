"""Nginx access.log 실시간 파서 - tail -f 방식으로 로그를 읽어 패킷 저장소에 추가"""
import asyncio
import re
from datetime import datetime, timezone

import structlog

from app.services.packet_store import packet_store, Packet

logger = structlog.get_logger()

# Nginx log format: '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" rt=$request_time'
LOG_PATTERN = re.compile(
    r'(?P<remote_addr>\S+) - (?P<remote_user>\S+) \[(?P<time_local>[^\]]+)\] '
    r'"(?P<method>\S+) (?P<path>\S+) (?P<protocol>\S+)" '
    r'(?P<status>\d+) (?P<body_bytes>\d+) '
    r'"(?P<referer>[^"]*)" "(?P<user_agent>[^"]*)"'
    r'(?: rt=(?P<request_time>[\d.]+))?'
)

NGINX_LOG_PATH = "/var/log/nginx/access.log"


def parse_nginx_time(time_str: str) -> str:
    """Nginx time_local을 ISO 8601로 변환"""
    try:
        dt = datetime.strptime(time_str, "%d/%b/%Y:%H:%M:%S %z")
        return dt.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError):
        return datetime.now(timezone.utc).isoformat()


def parse_log_line(line: str) -> Packet | None:
    """Nginx 로그 한 줄을 Packet으로 변환"""
    m = LOG_PATTERN.match(line.strip())
    if not m:
        return None

    status = int(m.group("status"))
    body_bytes = int(m.group("body_bytes"))
    rt = float(m.group("request_time")) * 1000 if m.group("request_time") else 0.0
    path = m.group("path")

    # /api/traffic 등 모니터링 경로는 제외
    if any(path.startswith(exc) for exc in ("/ws/", "/api/traffic", "/metrics")):
        return None

    blocked = status == 429 or status == 403
    block_reason = ""
    if status == 429:
        block_reason = "rate_limit"
    elif status == 403:
        block_reason = "waf_blocked"

    return Packet(
        timestamp=parse_nginx_time(m.group("time_local")),
        source_ip=m.group("remote_addr"),
        source_port=0,
        dest_service="nginx",
        dest_port=80,
        method=m.group("method"),
        path=path,
        query_params="",
        status_code=status,
        request_headers={"User-Agent": m.group("user_agent"), "Referer": m.group("referer")},
        request_body="",
        response_headers={},
        response_body="",
        response_time_ms=round(rt, 2),
        blocked=blocked,
        block_reason=block_reason,
        layer="nginx",
        size_bytes=body_bytes,
    )


async def tail_nginx_log():
    """Nginx access.log를 실시간으로 tail하며 패킷 저장소에 추가"""
    logger.info("nginx_log_parser_starting", path=NGINX_LOG_PATH)

    while True:
        try:
            proc = await asyncio.create_subprocess_exec(
                "tail", "-F", "-n", "0", NGINX_LOG_PATH,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )

            async for line_bytes in proc.stdout:
                line = line_bytes.decode("utf-8", errors="replace")
                packet = parse_log_line(line)
                if packet:
                    await packet_store.add_packet(packet)

        except FileNotFoundError:
            logger.warning("nginx_log_not_found", path=NGINX_LOG_PATH)
            await asyncio.sleep(5)
        except Exception as e:
            logger.error("nginx_log_parser_error", error=str(e))
            await asyncio.sleep(2)
