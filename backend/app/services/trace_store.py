"""Request Trace Store - records layer-by-layer processing for X-ray visualization."""
import asyncio
import time
import uuid
from collections import deque
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class TraceLayer:
    """A single layer in the request processing chain."""
    layer: str  # "nginx", "middleware", "handler", "sqlalchemy", "postgres", "redis"
    action: str  # "rate_limit_check", "xss_filter", "INSERT", etc.
    result: str  # "passed", "blocked", "sanitized", "executed", etc.
    duration_ms: float = 0.0
    detail: str = ""  # extra info like "removed <script>" or SQL query
    metadata: dict = field(default_factory=dict)  # flexible extra data


@dataclass
class RequestTrace:
    """Full trace of a request through all layers."""
    trace_id: str = ""
    timestamp: str = ""
    method: str = ""
    path: str = ""
    status_code: int = 0
    total_duration_ms: float = 0.0
    source_ip: str = ""
    layers: list[TraceLayer] = field(default_factory=list)
    attack_type: str = ""  # "xss", "sqli", "ddos", "normal", "recon"

    def to_dict(self):
        d = asdict(self)
        return d


class TraceStore:
    def __init__(self, maxlen: int = 500):
        self._traces: deque[RequestTrace] = deque(maxlen=maxlen)
        self._subscribers: list[asyncio.Queue] = []
        self._active_traces: dict[str, RequestTrace] = {}

    def begin_trace(self, trace_id: str, method: str, path: str, source_ip: str, timestamp: str) -> RequestTrace:
        """Start a new trace for a request."""
        trace = RequestTrace(
            trace_id=trace_id,
            timestamp=timestamp,
            method=method,
            path=path,
            source_ip=source_ip,
        )
        self._active_traces[trace_id] = trace
        return trace

    def add_layer(self, trace_id: str, layer: TraceLayer):
        """Add a layer record to an active trace."""
        trace = self._active_traces.get(trace_id)
        if trace:
            trace.layers.append(layer)

    async def complete_trace(self, trace_id: str, status_code: int, total_duration_ms: float):
        """Finalize a trace and broadcast to subscribers."""
        trace = self._active_traces.pop(trace_id, None)
        if not trace:
            return

        trace.status_code = status_code
        trace.total_duration_ms = total_duration_ms

        # Detect attack type from trace layers
        trace.attack_type = self._detect_attack_type(trace)

        self._traces.append(trace)

        # Broadcast
        trace_dict = trace.to_dict()
        dead = []
        for q in self._subscribers:
            try:
                q.put_nowait(trace_dict)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._subscribers.remove(q)

    def _detect_attack_type(self, trace: RequestTrace) -> str:
        """Detect attack type from trace data."""
        for layer in trace.layers:
            if "xss" in layer.action.lower() and layer.result in ("sanitized", "blocked"):
                return "xss"
            if "sql" in layer.action.lower() and "injection" in layer.detail.lower():
                return "sqli"
            if layer.action == "rate_limit_check" and layer.result == "blocked":
                return "ddos"
        return "normal"

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self._subscribers:
            self._subscribers.remove(q)

    def get_recent_traces(self, limit: int = 50) -> list[dict]:
        result = []
        for trace in reversed(self._traces):
            result.append(trace.to_dict())
            if len(result) >= limit:
                break
        result.reverse()
        return result

    def get_trace(self, trace_id: str) -> Optional[dict]:
        for trace in self._traces:
            if trace.trace_id == trace_id:
                return trace.to_dict()
        return None


# Singleton
trace_store = TraceStore()
