"""DDoS 시뮬레이션용 트래픽 생성기"""
import asyncio
import os
import time

import httpx
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="SRE Traffic Generator")

TARGET_URL = os.getenv("TARGET_URL", "http://nginx:80")

# 시뮬레이션 상태
_state = {
    "running": False,
    "type": "",
    "total_sent": 0,
    "total_blocked": 0,
    "total_passed": 0,
    "start_time": 0,
    "elapsed_sec": 0,
}
_stop_event = asyncio.Event()
_task = None


class StartRequest(BaseModel):
    type: str = "flood"
    rps: int = 10
    concurrency: int = 5
    duration_sec: int = 30


# ─── 시뮬레이션 타입별 로직 ───

async def _flood(target: str, rps: int, concurrency: int, duration: int):
    """HTTP Flood - 대량 GET/POST 요청"""
    interval = 1.0 / max(rps, 1)
    end_time = time.time() + duration
    paths = ["/api/health", "/api/posts", "/api/security/", "/"]

    async with httpx.AsyncClient(timeout=5) as client:
        while not _stop_event.is_set() and time.time() < end_time:
            tasks = []
            for i in range(concurrency):
                path = paths[_state["total_sent"] % len(paths)]
                tasks.append(_send_request(client, "GET", f"{target}{path}"))
            await asyncio.gather(*tasks, return_exceptions=True)
            await asyncio.sleep(interval)


async def _slowloris(target: str, concurrency: int, duration: int, **_):
    """Slowloris - 느린 연결 유지"""
    end_time = time.time() + duration

    async def slow_conn():
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                while not _stop_event.is_set() and time.time() < end_time:
                    _state["total_sent"] += 1
                    try:
                        resp = await client.get(
                            f"{target}/api/health",
                            headers={"X-Slowloris": "a" * 100},
                        )
                        if resp.status_code == 429:
                            _state["total_blocked"] += 1
                        else:
                            _state["total_passed"] += 1
                    except Exception:
                        _state["total_blocked"] += 1
                    await asyncio.sleep(2)
        except Exception:
            pass

    tasks = [slow_conn() for _ in range(concurrency)]
    await asyncio.gather(*tasks, return_exceptions=True)


async def _burst(target: str, concurrency: int, duration: int, **_):
    """Burst - 짧은 시간에 폭발적 요청 후 대기 반복"""
    end_time = time.time() + duration

    async with httpx.AsyncClient(timeout=5) as client:
        while not _stop_event.is_set() and time.time() < end_time:
            # 폭발적 요청
            tasks = [_send_request(client, "GET", f"{target}/api/health") for _ in range(concurrency * 10)]
            await asyncio.gather(*tasks, return_exceptions=True)
            # 대기
            for _ in range(50):
                if _stop_event.is_set():
                    return
                await asyncio.sleep(0.1)


async def _send_request(client: httpx.AsyncClient, method: str, url: str):
    """단일 요청 전송 및 통계 업데이트"""
    _state["total_sent"] += 1
    try:
        resp = await client.request(method, url)
        if resp.status_code == 429:
            _state["total_blocked"] += 1
        else:
            _state["total_passed"] += 1
    except Exception:
        _state["total_blocked"] += 1


async def _run_simulation(req: StartRequest):
    """시뮬레이션 메인 루프"""
    _state.update({
        "running": True,
        "type": req.type,
        "total_sent": 0,
        "total_blocked": 0,
        "total_passed": 0,
        "start_time": time.time(),
    })
    _stop_event.clear()

    try:
        if req.type == "flood":
            await _flood(TARGET_URL, req.rps, req.concurrency, req.duration_sec)
        elif req.type == "slowloris":
            await _slowloris(TARGET_URL, req.concurrency, req.duration_sec)
        elif req.type == "burst":
            await _burst(TARGET_URL, req.concurrency, req.duration_sec)
    except asyncio.CancelledError:
        pass
    finally:
        _state["running"] = False
        _state["elapsed_sec"] = round(time.time() - _state["start_time"], 1)


# ─── API ───

@app.post("/start")
async def start(req: StartRequest):
    global _task
    if _state["running"]:
        return {"error": "already running"}
    _task = asyncio.create_task(_run_simulation(req))
    return {"status": "started", "config": req.model_dump()}


@app.post("/stop")
async def stop():
    global _task
    _stop_event.set()
    if _task:
        _task.cancel()
        _task = None
    _state["running"] = False
    return {"status": "stopped"}


@app.get("/status")
async def status():
    if _state["running"]:
        _state["elapsed_sec"] = round(time.time() - _state["start_time"], 1)
    return _state


@app.get("/health")
async def health():
    return {"status": "ok"}
