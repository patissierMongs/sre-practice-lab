"""Health check endpoints - SRE의 기본: Liveness & Readiness Probe"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from redis import asyncio as aioredis

from app.core.config import get_settings
from app.core.database import get_db

router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check():
    """Liveness probe - 앱이 살아있는지 확인"""
    return {"status": "healthy", "service": settings.APP_NAME}


@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness probe - 의존성(DB, Redis) 포함 전체 상태 확인"""
    checks = {}

    # DB check
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "connected"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"

    # Redis check
    try:
        redis = aioredis.from_url(settings.REDIS_URL)
        await redis.ping()
        checks["redis"] = "connected"
        await redis.close()
    except Exception as e:
        checks["redis"] = f"error: {str(e)}"

    all_healthy = all(v == "connected" for v in checks.values())

    return {
        "status": "ready" if all_healthy else "degraded",
        "checks": checks,
    }
