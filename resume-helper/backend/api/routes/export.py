"""导出API"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.models.models import ResumeVersion
from backend.services.export_service import export_service

router = APIRouter()


class ExportRequest(BaseModel):
    version_id: str
    format: str = "pdf"  # pdf/docx/md/txt
    template_id: Optional[str] = "A"  # A/B/C/D/E


@router.post("/export")
async def export_resume(req: ExportRequest, db: AsyncSession = Depends(get_db)):
    """导出简历文件"""
    version = await db.get(ResumeVersion, req.version_id)
    if not version:
        raise HTTPException(404, "版本不存在")

    try:
        file_path = await export_service.export(
            version=version,
            format=req.format,
            template_id=req.template_id,
        )
        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type="application/octet-stream",
        )
    except Exception as e:
        raise HTTPException(500, f"导出失败: {str(e)}")
