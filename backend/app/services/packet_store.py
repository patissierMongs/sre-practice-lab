"""패킷 저장소 - ring buffer 기반 트래픽 데이터 관리"""
import asyncio
import time
from collections import deque
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Packet:
    id: int = 0
    timestamp: str = ""
    source_ip: str = ""
    source_port: int = 0
    dest_service: str = ""
    dest_port: int = 0
    method: str = ""
    path: str = ""
    query_params: str = ""
    status_code: int = 0
    request_headers: dict = field(default_factory=dict)
    request_body: str = ""
    response_headers: dict = field(default_factory=dict)
    response_body: str = ""
    response_time_ms: float = 0.0
    blocked: bool = False
    block_reason: str = ""
    layer: str = "application"  # "nginx" or "application"
    size_bytes: int = 0

    def to_dict(self):
        return asdict(self)


class PacketStore:
    def __init__(self, maxlen: int = 2000):
        self._packets: deque[Packet] = deque(maxlen=maxlen)
        self._counter = 0
        self._subscribers: list[asyncio.Queue] = []
        self._capturing = True
        self._lock = asyncio.Lock()
        # 통계용
        self._stats_window: deque[float] = deque(maxlen=300)  # 최근 5분 타임스탬프
        self._blocked_count = 0
        self._passed_count = 0
        self._total_response_time = 0.0

    @property
    def capturing(self) -> bool:
        return self._capturing

    def toggle_capture(self) -> bool:
        self._capturing = not self._capturing
        return self._capturing

    async def add_packet(self, packet: Packet):
        if not self._capturing:
            return

        async with self._lock:
            self._counter += 1
            packet.id = self._counter

        now = time.time()
        self._stats_window.append(now)

        if packet.blocked:
            self._blocked_count += 1
        else:
            self._passed_count += 1
        self._total_response_time += packet.response_time_ms

        self._packets.append(packet)

        # broadcast to WebSocket subscribers
        packet_dict = packet.to_dict()
        dead = []
        for q in self._subscribers:
            try:
                q.put_nowait(packet_dict)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._subscribers.remove(q)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self._subscribers:
            self._subscribers.remove(q)

    def get_packets(
        self,
        method: Optional[str] = None,
        status_min: Optional[int] = None,
        status_max: Optional[int] = None,
        path: Optional[str] = None,
        limit: int = 200,
    ) -> list[dict]:
        result = []
        for p in reversed(self._packets):
            if method and p.method != method.upper():
                continue
            if status_min and p.status_code < status_min:
                continue
            if status_max and p.status_code > status_max:
                continue
            if path and path.lower() not in p.path.lower():
                continue
            result.append(p.to_dict())
            if len(result) >= limit:
                break
        result.reverse()
        return result

    def get_packet(self, packet_id: int) -> Optional[dict]:
        for p in self._packets:
            if p.id == packet_id:
                return p.to_dict()
        return None

    def get_stats(self) -> dict:
        now = time.time()
        # 최근 1초 내 요청 수 계산
        recent = sum(1 for t in self._stats_window if now - t < 1.0)
        total = self._passed_count + self._blocked_count
        avg_rt = (self._total_response_time / total) if total > 0 else 0
        error_count = sum(1 for p in self._packets if p.status_code >= 500)

        return {
            "capturing": self._capturing,
            "total_packets": total,
            "passed": self._passed_count,
            "blocked": self._blocked_count,
            "requests_per_second": recent,
            "avg_response_time_ms": round(avg_rt, 2),
            "error_rate": round((error_count / total * 100) if total > 0 else 0, 2),
            "buffer_size": len(self._packets),
        }


# Singleton
packet_store = PacketStore()
