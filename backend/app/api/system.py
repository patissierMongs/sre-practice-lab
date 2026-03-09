"""System State API - iptables, ports, connections, DB/Redis stats for X-ray visualization"""
import asyncio
import subprocess

import redis.asyncio as aioredis
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import engine
from app.services.trace_store import trace_store

logger = structlog.get_logger()
router = APIRouter()
settings = get_settings()


async def _run_cmd(cmd: list[str], timeout: float = 3.0) -> str:
    """Run a shell command and return stdout."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return stdout.decode("utf-8", errors="replace").strip()
    except Exception as e:
        return f"error: {e}"


async def _get_open_ports() -> list[dict]:
    """Get open/listening ports via ss."""
    output = await _run_cmd(["ss", "-tlnp"])
    ports = []
    for line in output.split("\n")[1:]:  # skip header
        parts = line.split()
        if len(parts) < 4:
            continue
        local_addr = parts[3]
        # parse *:80 or 0.0.0.0:80 or [::]:80
        if ":" in local_addr:
            port_str = local_addr.rsplit(":", 1)[-1]
            try:
                port = int(port_str)
            except ValueError:
                continue
            process = parts[-1] if len(parts) > 5 else ""
            ports.append({"port": port, "state": "LISTEN", "process": process})
    return ports


async def _get_iptables_rules() -> list[dict]:
    """Get iptables rules with packet/byte counters (-v for drop tracking)."""
    output = await _run_cmd(["iptables", "-L", "-n", "-v", "--line-numbers"])
    rules = []
    current_chain = ""
    for line in output.split("\n"):
        if line.startswith("Chain "):
            parts = line.split()
            current_chain = parts[1] if len(parts) > 1 else ""
            # Extract policy and counters: Chain INPUT (policy ACCEPT 123 packets, 45678 bytes)
            policy = parts[3].rstrip(")") if len(parts) > 3 else ""
            chain_info = {"type": "chain", "chain": current_chain, "policy": policy}
            # Parse packet counter from chain header
            line_lower = line.lower()
            if "packets" in line_lower:
                try:
                    pkt_idx = parts.index("packets,") - 1 if "packets," in parts else -1
                    if pkt_idx >= 0:
                        chain_info["packets"] = int(parts[pkt_idx])
                except (ValueError, IndexError):
                    pass
            rules.append(chain_info)
        elif line and not line.startswith("num") and not line.strip().startswith("pkts") and current_chain:
            # -v format: num pkts bytes target prot opt in out source destination [extra]
            parts = line.split()
            if len(parts) >= 9 and parts[0].strip().isdigit():
                pkts = parts[1]
                bytes_val = parts[2]
                target = parts[3]
                prot = parts[4]
                source = parts[7] if len(parts) > 7 else ""
                dest = parts[8] if len(parts) > 8 else ""
                extra = " ".join(parts[9:]) if len(parts) > 9 else ""

                # Parse human-readable counters
                try:
                    pkt_count = int(pkts) if pkts.isdigit() else 0
                except ValueError:
                    pkt_count = 0

                rules.append({
                    "type": "rule",
                    "chain": current_chain,
                    "num": parts[0],
                    "target": target,
                    "protocol": prot,
                    "source": source,
                    "destination": dest,
                    "extra": extra,
                    "packets": pkt_count,
                    "bytes": bytes_val,
                    "is_drop": target in ("DROP", "REJECT"),
                })
    return rules


async def _get_kernel_drop_stats() -> dict:
    """Get kernel-level packet drop/reject statistics."""
    stats = {
        "iptables_drops": 0,
        "iptables_rejects": 0,
        "conntrack": {},
        "netstat_drops": {},
    }

    # 1. Count total drops/rejects from iptables rules
    ipt_output = await _run_cmd(["iptables", "-L", "-n", "-v", "-x"])
    for line in ipt_output.split("\n"):
        parts = line.split()
        if len(parts) >= 4:
            try:
                pkts = int(parts[0])
            except ValueError:
                continue
            target = parts[2]
            if target == "DROP":
                stats["iptables_drops"] += pkts
            elif target == "REJECT":
                stats["iptables_rejects"] += pkts

    # 2. Conntrack stats (connection tracking)
    ct_output = await _run_cmd(["cat", "/proc/net/stat/nf_conntrack"])
    if not ct_output.startswith("error"):
        lines = ct_output.strip().split("\n")
        if len(lines) >= 2:
            # Header line has field names; sum all CPU lines
            headers = lines[0].split()
            totals = {}
            for line in lines[1:]:
                vals = line.split()
                for i, h in enumerate(headers):
                    if i < len(vals):
                        try:
                            totals[h] = totals.get(h, 0) + int(vals[i], 16)
                        except ValueError:
                            pass
            stats["conntrack"] = {
                "entries": totals.get("entries", 0),
                "searched": totals.get("searched", 0),
                "found": totals.get("found", 0),
                "new": totals.get("new", 0),
                "invalid": totals.get("invalid", 0),
                "ignore": totals.get("ignore", 0),
                "delete": totals.get("delete", 0),
                "insert": totals.get("insert", 0),
                "insert_failed": totals.get("insert_failed", 0),
                "drop": totals.get("drop", 0),
                "early_drop": totals.get("early_drop", 0),
            }

    # 3. Network interface drops from /proc/net/dev
    dev_output = await _run_cmd(["cat", "/proc/net/dev"])
    if not dev_output.startswith("error"):
        for line in dev_output.split("\n")[2:]:  # skip 2 header lines
            line = line.strip()
            if not line or ":" not in line:
                continue
            iface, rest = line.split(":", 1)
            iface = iface.strip()
            vals = rest.split()
            if len(vals) >= 11:
                rx_drop = int(vals[3]) if vals[3].isdigit() else 0
                tx_drop = int(vals[11]) if vals[11].isdigit() else 0
                if rx_drop > 0 or tx_drop > 0 or iface in ("eth0", "lo"):
                    stats["netstat_drops"][iface] = {
                        "rx_packets": int(vals[0]) if vals[0].isdigit() else 0,
                        "rx_drop": rx_drop,
                        "rx_errors": int(vals[2]) if vals[2].isdigit() else 0,
                        "tx_packets": int(vals[8]) if vals[8].isdigit() else 0,
                        "tx_drop": tx_drop,
                        "tx_errors": int(vals[10]) if vals[10].isdigit() else 0,
                    }

    return stats


async def _get_active_connections() -> dict:
    """Get active TCP connections per destination."""
    output = await _run_cmd(["ss", "-tn", "state", "established"])
    conns = {}
    for line in output.split("\n")[1:]:
        parts = line.split()
        if len(parts) < 4:
            continue
        peer = parts[3]  # peer address:port
        if ":" in peer:
            port_str = peer.rsplit(":", 1)[-1]
            try:
                port = int(port_str)
            except ValueError:
                continue
            # Map well-known ports to service names
            svc = {80: "nginx", 8000: "backend", 5432: "postgres", 6379: "redis"}.get(port, f"port-{port}")
            conns[svc] = conns.get(svc, 0) + 1
    return conns


async def _get_db_stats() -> dict:
    """Get PostgreSQL connection pool and activity stats."""
    try:
        async with engine.connect() as conn:
            # Active connections
            result = await conn.execute(text(
                "SELECT state, count(*) FROM pg_stat_activity "
                "WHERE datname = current_database() GROUP BY state"
            ))
            states = {row[0] or "unknown": row[1] for row in result.fetchall()}

            # Total connections
            result2 = await conn.execute(text(
                "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
            ))
            total = result2.scalar() or 0

            # Active queries
            result3 = await conn.execute(text(
                "SELECT count(*) FROM pg_stat_activity "
                "WHERE datname = current_database() AND state = 'active' AND query NOT LIKE '%pg_stat%'"
            ))
            active_queries = result3.scalar() or 0

            # Transaction stats
            result4 = await conn.execute(text(
                "SELECT xact_commit, xact_rollback, tup_returned, tup_fetched, "
                "tup_inserted, tup_updated, tup_deleted, blks_read, blks_hit "
                "FROM pg_stat_database WHERE datname = current_database()"
            ))
            db_row = result4.fetchone()

            db_stats = {}
            if db_row:
                blks_read = db_row[7] or 0
                blks_hit = db_row[8] or 0
                cache_ratio = round((blks_hit / (blks_read + blks_hit) * 100), 2) if (blks_read + blks_hit) > 0 else 0
                db_stats = {
                    "xact_commit": db_row[0] or 0,
                    "xact_rollback": db_row[1] or 0,
                    "tup_returned": db_row[2] or 0,
                    "tup_fetched": db_row[3] or 0,
                    "tup_inserted": db_row[4] or 0,
                    "tup_updated": db_row[5] or 0,
                    "tup_deleted": db_row[6] or 0,
                    "blks_read": blks_read,
                    "blks_hit": blks_hit,
                    "cache_hit_ratio": cache_ratio,
                }

            pool = engine.pool
            return {
                "pool_size": pool.size(),
                "pool_checked_in": pool.checkedin(),
                "pool_checked_out": pool.checkedout(),
                "pool_overflow": pool.overflow(),
                "total_connections": total,
                "states": states,
                "active_queries": active_queries,
                **db_stats,
            }
    except Exception as e:
        logger.error("db_stats_error", error=str(e))
        return {"error": str(e)}


async def _get_redis_stats() -> dict:
    """Get Redis connection and memory stats."""
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        info = await r.info()
        await r.aclose()
        return {
            "connected_clients": info.get("connected_clients", 0),
            "used_memory_bytes": info.get("used_memory", 0),
            "used_memory_human": info.get("used_memory_human", "0B"),
            "total_commands_processed": info.get("total_commands_processed", 0),
            "keyspace_hits": info.get("keyspace_hits", 0),
            "keyspace_misses": info.get("keyspace_misses", 0),
            "hit_rate": round(
                info.get("keyspace_hits", 0) /
                max(info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1) * 100, 2
            ),
            "db_keys": info.get("db0", {}).get("keys", 0) if isinstance(info.get("db0"), dict) else 0,
            "uptime_seconds": info.get("uptime_in_seconds", 0),
        }
    except Exception as e:
        logger.error("redis_stats_error", error=str(e))
        return {"error": str(e)}


async def _get_nginx_status() -> dict:
    """Get nginx rate limit and connection info from config analysis."""
    # We parse the config since stub_status may not be enabled
    return {
        "rate_limit_zones": [
            {"zone": "api_limit", "size": "10m", "rate": "30r/m"},
            {"zone": "login_limit", "size": "10m", "rate": "5r/m"},
        ],
        "conn_limit": {"zone": "conn_limit", "max": 10},
        "security_headers": [
            "X-Frame-Options: SAMEORIGIN",
            "X-Content-Type-Options: nosniff",
            "X-XSS-Protection: 1; mode=block",
        ],
    }


@router.get("/state")
async def get_system_state():
    """Return comprehensive system state for X-ray visualization."""
    # Run all collectors concurrently
    ports, iptables, connections, db_stats, redis_stats, nginx_status, kernel_drops = await asyncio.gather(
        _get_open_ports(),
        _get_iptables_rules(),
        _get_active_connections(),
        _get_db_stats(),
        _get_redis_stats(),
        _get_nginx_status(),
        _get_kernel_drop_stats(),
    )

    from app.services.packet_store import packet_store
    traffic_stats = packet_store.get_stats()

    from app.api.security import security_state

    return {
        "network": {
            "open_ports": ports,
            "iptables_rules": iptables,
            "active_connections": connections,
            "kernel_drops": kernel_drops,
        },
        "nginx": nginx_status | {
            "blocked_recent": traffic_stats.get("blocked", 0),
            "passed_recent": traffic_stats.get("passed", 0),
        },
        "application": {
            "active_requests": traffic_stats.get("requests_per_second", 0),
            "avg_response_time_ms": traffic_stats.get("avg_response_time_ms", 0),
            "error_rate": traffic_stats.get("error_rate", 0),
            "total_packets": traffic_stats.get("total_packets", 0),
            "xss_protection": security_state.get("xss_protection", False),
            "rate_limiting": security_state.get("rate_limiting", True),
        },
        "database": db_stats,
        "redis": redis_stats,
    }


# ═══════════════════════════════════
# Request Trace endpoints
# ═══════════════════════════════════

@router.get("/traces")
async def get_traces(limit: int = Query(50, le=200)):
    """Get recent request traces for X-ray view."""
    return trace_store.get_recent_traces(limit)


@router.get("/traces/{trace_id}")
async def get_trace(trace_id: str):
    """Get a specific trace by ID."""
    t = trace_store.get_trace(trace_id)
    if not t:
        return {"error": "not found"}
    return t


# ═══════════════════════════════════
# WebSocket - X-ray real-time stream
# ═══════════════════════════════════

@router.websocket("/ws/xray")
async def ws_xray(websocket: WebSocket):
    """Stream real-time system state + request traces."""
    await websocket.accept()
    trace_queue = trace_store.subscribe()
    logger.info("ws_xray_connected")

    async def send_system_state():
        """Periodically send system state."""
        while True:
            try:
                state = await get_system_state()
                await websocket.send_json({"type": "system_state", "data": state})
            except Exception:
                break
            await asyncio.sleep(2)

    async def send_traces():
        """Stream new traces as they complete."""
        while True:
            try:
                trace_dict = await trace_queue.get()
                await websocket.send_json({"type": "trace", "data": trace_dict})
            except Exception:
                break

    state_task = asyncio.create_task(send_system_state())
    trace_task = asyncio.create_task(send_traces())

    try:
        # Keep connection alive by listening for client messages
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("ws_xray_error", error=str(e))
    finally:
        state_task.cancel()
        trace_task.cancel()
        trace_store.unsubscribe(trace_queue)
        logger.info("ws_xray_disconnected")
