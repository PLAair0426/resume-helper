"""FastAPI应用入口"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.core.config import settings
from backend.core.database import init_db
from backend.api.routes import upload, parse, generate, export, versions, analyze, convert, knowledge
from backend.services.knowledge_service import knowledge_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    await init_db()
    settings.storage.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.storage.export_dir.mkdir(parents=True, exist_ok=True)
    # 初始化知识库（后台加载，不阻塞启动）
    try:
        await knowledge_service.initialize()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Knowledge base init deferred: {e}")
    yield
    # 关闭时（清理资源）


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(upload.router, prefix="/api/v1", tags=["upload"])
app.include_router(parse.router, prefix="/api/v1", tags=["parse"])
app.include_router(generate.router, prefix="/api/v1", tags=["generate"])
app.include_router(export.router, prefix="/api/v1", tags=["export"])
app.include_router(versions.router, prefix="/api/v1", tags=["versions"])
app.include_router(analyze.router, prefix="/api/v1", tags=["analyze"])
app.include_router(convert.router, prefix="/api/v1", tags=["convert"])
app.include_router(knowledge.router, prefix="/api/v1", tags=["knowledge"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.version}
