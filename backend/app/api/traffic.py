"""Traffic monitoring API + WebSocket + Terminal WebSocket"""
import asyncio
import json
import pty
import os
import select
import struct
import fcntl
import termios
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel

from app.services.packet_store import packet_store
from app.services.topology import get_topology

logger = structlog.get_logger()
router = APIRouter()

# ─── DDoS 시뮬레이션 상태 ───
_simulation_task: Optional[asyncio.Task] = None
_simulation_status = {"running": False, "type": "", "total_sent": 0, "total_blocked": 0}

# ─── 터미널 세션 관리 ───
_terminal_sessions: dict[str, dict] = {}


# ═══════════════════════════════════
# REST API
# ═══════════════════════════════════

class SimulationRequest(BaseModel):
    type: str = "flood"  # flood, slowloris, burst
    rps: int = 10
    concurrency: int = 5
    duration_sec: int = 30


@router.get("/status")
async def get_status():
    stats = packet_store.get_stats()
    stats["simulation"] = _simulation_status
    return stats


@router.post("/capture/toggle")
async def toggle_capture():
    capturing = packet_store.toggle_capture()
    return {"capturing": capturing}


@router.get("/packets")
async def get_packets(
    method: Optional[str] = Query(None),
    status_min: Optional[int] = Query(None),
    status_max: Optional[int] = Query(None),
    path: Optional[str] = Query(None),
    limit: int = Query(200, le=2000),
):
    return packet_store.get_packets(method, status_min, status_max, path, limit)


@router.get("/packets/{packet_id}")
async def get_packet(packet_id: int):
    p = packet_store.get_packet(packet_id)
    if not p:
        return {"error": "not found"}
    return p


@router.get("/topology")
async def topology():
    return await get_topology()


@router.get("/stats")
async def get_stats():
    return packet_store.get_stats()


# ─── DDoS 시뮬레이션 ───

@router.post("/simulate/start")
async def simulate_start(req: SimulationRequest):
    global _simulation_task
    if _simulation_status["running"]:
        return {"error": "simulation already running"}

    _simulation_status.update({"running": True, "type": req.type, "total_sent": 0, "total_blocked": 0})

    # traffic-generator 서비스에 요청
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                "http://sre-traffic-generator:8001/start",
                json={"type": req.type, "rps": req.rps, "concurrency": req.concurrency, "duration_sec": req.duration_sec},
            )
            if resp.status_code == 200:
                _simulation_task = asyncio.create_task(_poll_simulation_status())
                return {"status": "started", "config": req.model_dump()}
            else:
                _simulation_status["running"] = False
                return {"error": f"traffic-generator returned {resp.status_code}"}
    except Exception as e:
        _simulation_status["running"] = False
        return {"error": f"Cannot reach traffic-generator: {str(e)}"}


@router.post("/simulate/stop")
async def simulate_stop():
    global _simulation_task
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post("http://sre-traffic-generator:8001/stop")
    except Exception:
        pass

    _simulation_status["running"] = False
    if _simulation_task:
        _simulation_task.cancel()
        _simulation_task = None
    return {"status": "stopped"}


@router.get("/simulate/status")
async def simulate_status():
    return _simulation_status


async def _poll_simulation_status():
    """주기적으로 traffic-generator의 상태를 폴링"""
    while _simulation_status["running"]:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                resp = await client.get("http://sre-traffic-generator:8001/status")
                if resp.status_code == 200:
                    data = resp.json()
                    _simulation_status["total_sent"] = data.get("total_sent", 0)
                    _simulation_status["total_blocked"] = data.get("total_blocked", 0)
                    if not data.get("running", False):
                        _simulation_status["running"] = False
                        break
        except Exception:
            pass
        await asyncio.sleep(1)


# ═══════════════════════════════════
# WebSocket - 실시간 트래픽 스트리밍
# ═══════════════════════════════════

@router.websocket("/ws/traffic")
async def ws_traffic(websocket: WebSocket):
    await websocket.accept()
    queue = packet_store.subscribe()
    logger.info("ws_traffic_connected")

    try:
        while True:
            packet_dict = await queue.get()
            await websocket.send_json(packet_dict)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("ws_traffic_error", error=str(e))
    finally:
        packet_store.unsubscribe(queue)
        logger.info("ws_traffic_disconnected")


# ═══════════════════════════════════
# WebSocket - 웹 터미널 (PTY)
# ═══════════════════════════════════

@router.websocket("/ws/terminal")
async def ws_terminal(websocket: WebSocket):
    await websocket.accept()
    logger.info("ws_terminal_connected")

    # PTY 생성
    master_fd, slave_fd = pty.openpty()

    pid = os.fork()
    if pid == 0:
        # 자식 프로세스: 셸 실행
        os.close(master_fd)
        os.setsid()
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.close(slave_fd)
        os.execvp("/bin/bash", ["/bin/bash", "--login"])

    # 부모 프로세스
    os.close(slave_fd)

    # non-blocking 설정
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    async def read_pty():
        """PTY 출력을 WebSocket으로 전송"""
        loop = asyncio.get_event_loop()
        try:
            while True:
                await asyncio.sleep(0.02)
                try:
                    data = os.read(master_fd, 4096)
                    if data:
                        await websocket.send_json({"type": "output", "data": data.decode("utf-8", errors="replace")})
                except BlockingIOError:
                    continue
                except OSError:
                    break
        except Exception:
            pass

    read_task = asyncio.create_task(read_pty())

    try:
        while True:
            msg = await websocket.receive_json()

            if msg.get("type") == "input":
                # 사용자 키 입력
                os.write(master_fd, msg["data"].encode("utf-8"))

            elif msg.get("type") == "resize":
                # 터미널 크기 변경
                cols = msg.get("cols", 80)
                rows = msg.get("rows", 24)
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)

            elif msg.get("type") == "command":
                # 바이패스 모드: 명령어를 자동으로 터미널에 입력
                cmd = msg["data"]
                os.write(master_fd, (cmd + "\n").encode("utf-8"))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("ws_terminal_error", error=str(e))
    finally:
        read_task.cancel()
        os.close(master_fd)
        try:
            os.kill(pid, 9)
            os.waitpid(pid, 0)
        except Exception:
            pass
        logger.info("ws_terminal_disconnected")
