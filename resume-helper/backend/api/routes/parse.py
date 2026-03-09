"""Resume parsing API."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.models.models import ResumeProfile, ResumeSession
from backend.services.parser_service import parser_service

router = APIRouter()


def _raise_parse_http_error(exc: Exception) -> None:
    """Map common LLM/config failures to actionable HTTP status codes."""
    detail = str(exc).strip() or exc.__class__.__name__
    lowered = detail.lower()

    if "no api key available" in lowered or "missing api key" in lowered:
        raise HTTPException(400, f"Parse failed: missing API key. {detail}") from exc

    auth_markers = (
        "invalid_api_key",
        "incorrect api key",
        "authentication",
        "unauthorized",
        "status_code=401",
        "code=401",
    )
    if any(marker in lowered for marker in auth_markers):
        raise HTTPException(401, f"Parse failed: invalid API key or unauthorized. {detail}") from exc

    if "all llm providers failed" in lowered:
        raise HTTPException(502, f"Parse failed: all configured providers failed. {detail}") from exc

    raise HTTPException(500, f"Parse failed: {detail}") from exc


class ParseOptions(BaseModel):
    api_key: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    api_endpoint: Optional[str] = None


@router.post("/parse/{session_id}")
async def parse_resume(
    session_id: str,
    options: ParseOptions | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Parse uploaded resume file into structured profile data."""
    session = await db.get(ResumeSession, session_id)
    if not session:
        raise HTTPException(404, "会话不存在")
    if session.status not in ("created", "parsed"):
        raise HTTPException(400, f"当前状态不可解析: {session.status}")

    session.status = "parsing"
    await db.commit()

    try:
        result = await parser_service.parse(
            session.source_path,
            session.source_format,
            api_key=options.api_key if options else None,
            provider=options.provider if options else None,
            model=options.model if options else None,
            api_endpoint=options.api_endpoint if options else None,
        )

        profile = ResumeProfile(
            session_id=session_id,
            data=result["profile"],
            extraction_confidence=result["confidence"],
            missing_fields=result.get("missing_fields", []),
            open_questions=result.get("open_questions", []),
        )
        db.add(profile)
        session.status = "parsed"
        await db.commit()

        return {
            "session_id": session_id,
            "profile_id": profile.id,
            "profile": result["profile"],
            "confidence": result["confidence"],
            "missing_fields": result.get("missing_fields", []),
            "open_questions": result.get("open_questions", []),
            "status": "parsed",
        }
    except Exception as exc:
        session.status = "created"
        await db.commit()
        _raise_parse_http_error(exc)


@router.get("/parse/{session_id}")
async def get_parse_result(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get existing parse result by session id."""
    result = await db.execute(
        select(ResumeProfile).where(ResumeProfile.session_id == session_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "解析结果不存在")

    return {
        "profile_id": profile.id,
        "profile": profile.data,
        "confidence": profile.extraction_confidence,
        "missing_fields": profile.missing_fields,
        "open_questions": profile.open_questions,
        "confirmed": profile.confirmed,
    }


@router.put("/profile/{profile_id}")
async def update_profile(
    profile_id: str, data: dict, db: AsyncSession = Depends(get_db)
):
    """Update parsed profile and confirmation state."""
    profile = await db.get(ResumeProfile, profile_id)
    if not profile:
        raise HTTPException(404, "Profile不存在")

    profile.data = data.get("profile", profile.data)
    profile.confirmed = data.get("confirmed", profile.confirmed)
    await db.commit()

    return {
        "profile_id": profile.id,
        "status": "updated",
        "confirmed": profile.confirmed,
    }
