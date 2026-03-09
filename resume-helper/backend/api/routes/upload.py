"""文件上传API"""
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.core.database import get_db
from backend.models.models import ResumeSession

router = APIRouter()


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """上传简历文件（PDF/DOCX/TXT）"""
    # 校验文件扩展名
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.storage.allowed_extensions:
        raise HTTPException(400, f"不支持的文件格式: {ext}，支持: {settings.storage.allowed_extensions}")

    # 校验文件大小
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.storage.max_file_size_mb:
        raise HTTPException(400, f"文件过大: {size_mb:.1f}MB，限制: {settings.storage.max_file_size_mb}MB")

    # 创建会话
    session = ResumeSession(
        source_filename=file.filename,
        source_format=ext.lstrip("."),
        source_path="",  # 稍后更新
        status="created",
    )
    db.add(session)
    await db.flush()

    # 保存文件
    upload_dir = settings.storage.upload_dir / session.id
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename
    with open(file_path, "wb") as f:
        f.write(content)

    session.source_path = str(file_path)
    await db.commit()

    return {
        "session_id": session.id,
        "filename": file.filename,
        "format": session.source_format,
        "size_mb": round(size_mb, 2),
        "status": "created",
        "message": "文件上传成功，请调用 /api/v1/parse/{session_id} 开始解析",
    }
