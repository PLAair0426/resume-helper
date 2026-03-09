"""版本管理API"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.models.models import ResumeVersion, FeedbackLog

router = APIRouter()


@router.get("/versions/{session_id}")
async def list_versions(session_id: str, db: AsyncSession = Depends(get_db)):
    """获取会话下所有简历版本"""
    result = await db.execute(
        select(ResumeVersion)
        .where(ResumeVersion.session_id == session_id)
        .order_by(ResumeVersion.created_at.desc())
    )
    versions = result.scalars().all()
    return {
        "session_id": session_id,
        "versions": [
            {
                "version_id": v.id,
                "version_number": v.version_number,
                "type": v.version_type,
                "template_id": v.template_id,
                "scorecard": v.scorecard,
                "created_at": v.created_at.isoformat(),
            }
            for v in versions
        ],
    }


@router.get("/version/{version_id}")
async def get_version(version_id: str, db: AsyncSession = Depends(get_db)):
    """获取单个版本详情"""
    version = await db.get(ResumeVersion, version_id)
    if not version:
        raise HTTPException(404, "版本不存在")
    return {
        "version_id": version.id,
        "type": version.version_type,
        "content_md": version.content_md,
        "content_html": version.content_html,
        "scorecard": version.scorecard,
        "diff": version.diff_from_previous,
    }


@router.post("/feedback")
async def submit_feedback(data: dict, db: AsyncSession = Depends(get_db)):
    """提交用户反馈"""
    log = FeedbackLog(
        session_id=data["session_id"],
        version_id=data.get("version_id"),
        feedback_type=data.get("type", "comment"),
        content=data.get("content", ""),
    )
    db.add(log)
    await db.commit()
    return {"feedback_id": log.id, "status": "recorded"}


@router.delete("/data/{session_id}")
async def delete_user_data(session_id: str, db: AsyncSession = Depends(get_db)):
    """一键删除用户所有数据"""
    # TODO: 级联删除session下所有关联数据 + 文件
    return {"session_id": session_id, "status": "deleted"}
