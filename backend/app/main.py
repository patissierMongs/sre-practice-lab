import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import get_settings
from app.core.database import engine, Base, async_session
from app.api.health import router as health_router
from app.api.posts import router as posts_router
from app.api.security import router as security_router

# Import models so Base.metadata knows about all tables
from app.models.post import Post  # noqa: F401
from app.models.user import User  # noqa: F401

settings = get_settings()

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

app = FastAPI(
    title=settings.APP_NAME,
    description="SRE Practice Lab - 서버 & 네트워크 보안 실습",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost", "http://localhost:80"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Instrumentator().instrument(app).expose(app)

app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(posts_router, prefix="/api/posts", tags=["Posts"])
app.include_router(security_router, prefix="/api/security", tags=["Security"])


@app.on_event("startup")
async def startup():
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create default user if not exists
    from sqlalchemy import select
    import bcrypt

    async with async_session() as session:
        result = await session.execute(select(User).where(User.username == "admin"))
        if not result.scalar_one_or_none():
            hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
            user = User(
                username="admin",
                email="admin@srelab.local",
                hashed_password=hashed,
                is_admin=True,
            )
            session.add(user)
            await session.commit()
            logger.info("default_user_created", username="admin")

    logger.info("application_startup", environment=settings.ENVIRONMENT)


@app.on_event("shutdown")
async def shutdown():
    logger.info("application_shutdown")
