"""简历生成API"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.models.models import ResumeSession, ResumeProfile, JDInput, ResumeVersion
from backend.services.generator_service import generator_service

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str
    job_title: str
    jd_text: str
    company: Optional[str] = None
    keywords: list[str] = []
    seniority: Optional[str] = None
    industry: Optional[str] = None
    language: str = "zh-CN"
    tone: str = "professional"  # professional/concise/result_oriented/academic
    versions: list[str] = ["ats_friendly", "enhanced"]  # 要生成的版本类型


@router.post("/generate")
async def generate_resume(req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    """根据JD生成定制简历"""
    # 获取profile
    result = await db.execute(
        select(ResumeProfile).where(
            ResumeProfile.session_id == req.session_id,
            ResumeProfile.confirmed == True,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(400, "请先确认解析结果（profile.confirmed = true）")

    # 保存JD
    jd = JDInput(
        session_id=req.session_id,
        job_title=req.job_title,
        company=req.company,
        jd_text=req.jd_text,
        keywords=req.keywords,
        seniority=req.seniority,
        industry=req.industry,
        language=req.language,
    )
    db.add(jd)
    await db.flush()

    # 调用生成服务
    try:
        versions = await generator_service.generate(
            profile=profile.data,
            jd=jd,
            tone=req.tone,
            version_types=req.versions,
        )

        # 保存版本
        saved = []
        for i, v in enumerate(versions):
            rv = ResumeVersion(
                session_id=req.session_id,
                jd_id=jd.id,
                version_number=i + 1,
                version_type=v["type"],
                content_md=v["content_md"],
                content_html=v.get("content_html"),
                scorecard=v.get("scorecard"),
            )
            db.add(rv)
            await db.flush()
            saved.append({
                "version_id": rv.id,
                "type": rv.version_type,
                "version_number": rv.version_number,
            })

        await db.commit()
        return {"session_id": req.session_id, "jd_id": jd.id, "versions": saved}

    except Exception as e:
        raise HTTPException(500, f"生成失败: {str(e)}")
