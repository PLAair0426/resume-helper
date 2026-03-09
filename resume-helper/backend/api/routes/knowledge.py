"""知识库检索API"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.services.knowledge_service import knowledge_service

router = APIRouter()


class KnowledgeQueryRequest(BaseModel):
    query: str
    collection: Optional[str] = None  # ats_rules/action_verbs/industry_terms/writing_guides
    n_results: int = 5


@router.post("/knowledge/query")
async def query_knowledge(req: KnowledgeQueryRequest):
    """检索知识库"""
    try:
        results = await knowledge_service.query(
            query=req.query,
            collection_name=req.collection,
            n_results=req.n_results,
        )
        return {"status": "ok", "data": results}
    except Exception as e:
        raise HTTPException(500, f"知识库检索失败: {str(e)}")


@router.get("/knowledge/stats")
async def knowledge_stats():
    """获取知识库统计信息"""
    return {"status": "ok", "data": knowledge_service.get_stats()}


@router.post("/knowledge/init")
async def init_knowledge():
    """手动触发知识库初始化"""
    try:
        await knowledge_service.initialize()
        return {"status": "ok", "data": knowledge_service.get_stats()}
    except Exception as e:
        raise HTTPException(500, f"知识库初始化失败: {str(e)}")
