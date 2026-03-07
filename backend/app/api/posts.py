"""게시판 API - Phase 1 CRUD + Phase 3 XSS 보안 실습"""
import bleach
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.models.post import Post
from app.api.security import security_state

router = APIRouter()


# === Schemas ===

class PostCreate(BaseModel):
    title: str
    content: str


class PostResponse(BaseModel):
    id: int
    title: str
    content: str
    content_safe: Optional[str] = None
    author_id: int
    view_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# === Endpoints ===

@router.get("/", response_model=list[PostResponse])
async def list_posts(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """게시글 목록 조회"""
    result = await db.execute(
        select(Post)
        .where(Post.is_deleted == False)
        .order_by(Post.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post_id: int, db: AsyncSession = Depends(get_db)):
    """게시글 상세 조회 + 조회수 증가"""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.view_count += 1
    return post


@router.post("/", response_model=PostResponse, status_code=201)
async def create_post(
    post_data: PostCreate,
    db: AsyncSession = Depends(get_db),
):
    """게시글 작성 - XSS 보안 토글에 따라 sanitization 적용"""
    content_safe = bleach.clean(post_data.content, tags=[], strip=True)

    if security_state["xss_protection"]:
        title = bleach.clean(post_data.title, tags=[], strip=True)
        content = bleach.clean(post_data.content, tags=[], strip=True)
    else:
        title = post_data.title
        content = post_data.content

    post = Post(
        title=title,
        content=content,
        content_safe=content_safe,
        author_id=1,
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=204)
async def delete_post(post_id: int, db: AsyncSession = Depends(get_db)):
    """게시글 삭제 (soft delete)"""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_deleted = True
