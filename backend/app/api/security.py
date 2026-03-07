"""Security settings API - Phase 3 보안 실습 토글"""
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
