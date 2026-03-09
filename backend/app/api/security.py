"""Security settings API - defense controls for Blue Team"""
import asyncio
import re

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# In-memory security state (실습용 - 재시작 시 초기화)
security_state = {
    "xss_protection": False,  # 기본: OFF (취약 모드로 시작)
    "rate_limiting": True,
}


class SecurityStatus(BaseModel):
    xss_protection: bool
    rate_limiting: bool


class IptablesRule(BaseModel):
    chain: str = "INPUT"
    protocol: str = "tcp"
    source: str = ""
    dport: str = ""
    target: str = "DROP"


class IptablesResponse(BaseModel):
    success: bool
    message: str
    rules: list = []


async def _run_cmd(cmd: list[str], timeout: float = 5.0) -> tuple[int, str]:
    """Run shell command, return (returncode, output)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        output = stdout.decode("utf-8", errors="replace").strip()
        if proc.returncode != 0:
            output = stderr.decode("utf-8", errors="replace").strip() or output
        return proc.returncode, output
    except Exception as e:
        return -1, str(e)


@router.get("/", response_model=SecurityStatus)
async def get_security_status():
    """현재 보안 설정 상태 조회"""
    return security_state


@router.post("/toggle-xss", response_model=SecurityStatus)
async def toggle_xss():
    """XSS 보호 ON/OFF 토글"""
    security_state["xss_protection"] = not security_state["xss_protection"]
    return security_state


@router.post("/toggle-rate-limit", response_model=SecurityStatus)
async def toggle_rate_limit():
    """Rate Limiting ON/OFF 토글"""
    security_state["rate_limiting"] = not security_state["rate_limiting"]
    return security_state


# ═══════════════════════════════════
# iptables firewall rule management
# ═══════════════════════════════════

@router.get("/iptables")
async def get_iptables_rules():
    """Get current iptables rules."""
    rc, output = await _run_cmd(["iptables", "-L", "-n", "-v", "--line-numbers"])
    if rc != 0:
        return {"success": False, "message": output, "rules": []}

    rules = []
    current_chain = ""
    for line in output.split("\n"):
        if line.startswith("Chain "):
            parts = line.split()
            current_chain = parts[1] if len(parts) > 1 else ""
        elif line and not line.startswith("num") and current_chain:
            parts = line.split()
            if len(parts) >= 9 and parts[0].strip().isdigit():
                rules.append({
                    "num": parts[0],
                    "chain": current_chain,
                    "packets": parts[1],
                    "bytes": parts[2],
                    "target": parts[3],
                    "protocol": parts[4],
                    "source": parts[7] if len(parts) > 7 else "",
                    "destination": parts[8] if len(parts) > 8 else "",
                    "extra": " ".join(parts[9:]) if len(parts) > 9 else "",
                })

    return {"success": True, "rules": rules}


@router.post("/iptables/add")
async def add_iptables_rule(rule: IptablesRule):
    """Add an iptables rule."""
    # Validate inputs to prevent injection
    if not re.match(r'^[A-Z]+$', rule.chain):
        return {"success": False, "message": "Invalid chain name"}
    if not re.match(r'^[a-z]+$', rule.protocol):
        return {"success": False, "message": "Invalid protocol"}
    if rule.target not in ("DROP", "REJECT", "ACCEPT", "LOG"):
        return {"success": False, "message": "Invalid target"}
    if rule.dport and not re.match(r'^\d+$', rule.dport):
        return {"success": False, "message": "Invalid port number"}
    if rule.source and not re.match(r'^[\d./]+$', rule.source):
        return {"success": False, "message": "Invalid source address"}

    cmd = ["iptables", "-A", rule.chain, "-p", rule.protocol]
    if rule.source:
        cmd.extend(["-s", rule.source])
    if rule.dport:
        cmd.extend(["--dport", rule.dport])
    cmd.extend(["-j", rule.target])

    rc, output = await _run_cmd(cmd)
    if rc != 0:
        return {"success": False, "message": output}
    return {"success": True, "message": f"Rule added: {' '.join(cmd)}"}


@router.post("/iptables/delete")
async def delete_iptables_rule(chain: str = "INPUT", num: str = "1"):
    """Delete an iptables rule by number."""
    if not re.match(r'^[A-Z]+$', chain):
        return {"success": False, "message": "Invalid chain"}
    if not re.match(r'^\d+$', num):
        return {"success": False, "message": "Invalid rule number"}

    rc, output = await _run_cmd(["iptables", "-D", chain, num])
    if rc != 0:
        return {"success": False, "message": output}
    return {"success": True, "message": f"Deleted rule {num} from {chain}"}


@router.post("/iptables/flush")
async def flush_iptables():
    """Flush all iptables rules (reset to default ACCEPT)."""
    rc, output = await _run_cmd(["iptables", "-F"])
    if rc != 0:
        return {"success": False, "message": output}
    return {"success": True, "message": "All rules flushed"}
