"""无状态分析端点 - 供前端实时调用，不需要session"""
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.services.keyword_service import keyword_service
from backend.services.llm_service import llm_service
from backend.services.knowledge_service import knowledge_service

router = APIRouter()


def _raise_agent_http_error(prefix: str, exc: Exception) -> None:
    """Map common LLM/config failures to actionable HTTP status codes."""
    detail = str(exc).strip() or exc.__class__.__name__
    lowered = detail.lower()

    if "no api key available" in lowered or "missing api key" in lowered:
        raise HTTPException(400, f"{prefix}: missing API key. {detail}") from exc

    auth_markers = (
        "invalid_api_key",
        "incorrect api key",
        "authentication",
        "unauthorized",
        "status_code=401",
        "code=401",
    )
    if any(marker in lowered for marker in auth_markers):
        raise HTTPException(401, f"{prefix}: invalid API key or unauthorized. {detail}") from exc

    if "all llm providers failed" in lowered:
        raise HTTPException(502, f"{prefix}: all configured providers failed. {detail}") from exc

    raise HTTPException(500, f"{prefix}: {detail}") from exc


class LLMCredentials(BaseModel):
    """前端传入的LLM凭证"""
    api_key: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    api_endpoint: Optional[str] = None


class JDAnalyzeRequest(LLMCredentials):
    jd_text: str
    keywords: list[str] = []


class CoverageRequest(BaseModel):
    profile: dict
    jd_analysis: dict


class ATSAuditRequest(LLMCredentials):
    resume_content: str
    format_type: str = "markdown"


class OptimizeRequest(LLMCredentials):
    profile: dict
    jd_text: str
    job_title: str
    keywords: list[str] = []
    tone: str = "professional"
    language: str = "zh-CN"


class AutoFillRequest(LLMCredentials):
    resume_text: str
    target_template: Optional[str] = None
    tone: str = "professional"
    language: str = "zh-CN"


@router.post("/analyze/jd")
async def analyze_jd(req: JDAnalyzeRequest):
    """分析JD，返回分层关键词"""
    try:
        result = await keyword_service.analyze_jd(
            req.jd_text,
            req.keywords,
            api_key=req.api_key,
            provider=req.provider,
            model=req.model,
            api_endpoint=req.api_endpoint,
        )
        return {"status": "ok", "data": result}
    except Exception as e:
        _raise_agent_http_error("JD analysis failed", e)


@router.post("/analyze/coverage")
async def analyze_coverage(req: CoverageRequest):
    """计算关键词覆盖度（纯计算，不调LLM）"""
    try:
        result = keyword_service.calculate_coverage(req.profile, req.jd_analysis)
        return {"status": "ok", "data": result}
    except Exception as e:
        raise HTTPException(500, f"Coverage calculation failed: {str(e)}") from e


@router.post("/analyze/ats")
async def ats_audit(req: ATSAuditRequest):
    """ATS格式审计（RAG增强）"""
    try:
        # RAG: 检索相关ATS规则和写作指南
        rag_rules = knowledge_service.query_ats_rules("ATS格式审计 简历规范", n_results=3)
        rag_guides = knowledge_service.query_writing_guides("bullet结构 量化指标", n_results=2)
        rag_context = ""
        if rag_rules:
            rag_context += "\n\n## 参考ATS规则\n" + "\n".join(r["text"] for r in rag_rules)
        if rag_guides:
            rag_context += "\n\n## 参考写作指南\n" + "\n".join(r["text"] for r in rag_guides)

        system_prompt = f"""你是ATS（Applicant Tracking System）审计专家。分析简历内容，评估其ATS兼容性。

检查维度：
1. structure（结构）：是否有标准分区标题、逻辑清晰
2. keywords（关键词）：关键词是否自然融入、有无堆砌
3. formatting（格式）：是否单栏、无表格/图片/文本框、日期统一
4. evidence（证据）：bullet是否有量化指标、动词开头
{rag_context}

输出JSON格式：
{{
  "overall_score": 0.0-1.0,
  "format_risk": "low/medium/high",
  "dimensions": {{
    "structure": {{"score": 0.0-1.0, "issues": ["问题描述"]}},
    "keywords": {{"score": 0.0-1.0, "issues": []}},
    "formatting": {{"score": 0.0-1.0, "issues": []}},
    "evidence": {{"score": 0.0-1.0, "suggestions": ["改进建议"]}}
  }},
  "rewrite_suggestions": [
    {{"original": "原文", "suggested": "建议", "reason": "原因"}}
  ]
}}"""

        result = await llm_service.complete_json(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"简历内容（{req.format_type}格式）：\n\n{req.resume_content}"},
            ],
            json_schema={},
            api_key=req.api_key,
            provider=req.provider,
            model=req.model,
            api_endpoint=req.api_endpoint,
        )
        return {"status": "ok", "data": result["parsed"]}
    except Exception as e:
        _raise_agent_http_error("ATS audit failed", e)


@router.post("/optimize/content")
async def optimize_content(req: OptimizeRequest):
    """基于JD优化简历内容（RAG增强）"""
    try:
        # 先分析JD
        jd_analysis = await keyword_service.analyze_jd(
            req.jd_text, req.keywords,
            api_key=req.api_key, provider=req.provider,
            model=req.model, api_endpoint=req.api_endpoint,
        )
        coverage = keyword_service.calculate_coverage(req.profile, jd_analysis)

        # RAG: 检索行业词表和动词推荐
        rag_terms = knowledge_service.query_industry_terms(req.job_title, n_results=3)
        rag_verbs = knowledge_service.query_action_verbs(req.job_title, n_results=3)
        rag_guides = knowledge_service.query_writing_guides("bullet结构 量化", n_results=2)
        rag_context = ""
        if rag_terms:
            rag_context += "\n\n## 行业能力词参考\n" + "\n".join(r["text"] for r in rag_terms)
        if rag_verbs:
            rag_context += "\n\n## 推荐动词\n" + "\n".join(r["text"] for r in rag_verbs)
        if rag_guides:
            rag_context += "\n\n## 写作指南\n" + "\n".join(r["text"] for r in rag_guides)

        system_prompt = f"""你是简历优化专家。根据JD关键词分析和覆盖度报告，优化简历内容。

严格约束：
1. 保留原始简历全部内容，不可删减
2. 在不改变事实的前提下优化表述
3. 将缺失的JD关键词自然融入相关经历中
4. Bullet结构：动词开头 + 行为对象 + 方法/工具 + 可量化结果
5. 缺失数据用[待补充]标记，绝不捏造
6. 关键词落点优先级：技能表 > 经历bullet > 项目描述
{rag_context}

输出JSON格式：
{{
  "optimized_profile": {{ ... 优化后的profile，结构与输入相同 }},
  "changes": [
    {{"section": "位置", "original": "原文", "modified": "修改后", "reason": "原因"}}
  ],
  "new_coverage": 0.0-1.0
}}"""

        profile_str = json.dumps(req.profile, ensure_ascii=False, indent=2)
        user_prompt = f"""## 候选人Profile
{profile_str}

## 目标岗位：{req.job_title}
## JD原文
{req.jd_text}

## 关键词分析
{json.dumps(jd_analysis, ensure_ascii=False)}

## 当前覆盖度
{json.dumps(coverage, ensure_ascii=False)}

## 语气：{req.tone}
## 语言：{req.language}"""

        result = await llm_service.complete_json(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            json_schema={},
            api_key=req.api_key,
            provider=req.provider,
            model=req.model,
            api_endpoint=req.api_endpoint,
        )
        return {"status": "ok", "data": result["parsed"]}
    except Exception as e:
        _raise_agent_http_error("Content optimization failed", e)

@router.post("/autofill/text")
async def autofill_from_text(req: AutoFillRequest):
    """Paste full resume text, polish it, and convert into resume_profile."""
    if not req.resume_text.strip():
        raise HTTPException(400, "resume_text is required")

    try:
        template_hint = req.target_template or "keep-current-template"
        system_prompt = f"""You are an expert resume editor and structured parser.
Your task:
1. Read the user's full resume text.
2. Polish language for professionalism and impact.
3. Convert to a structured resume profile JSON.

Hard constraints:
- Never fabricate facts, dates, numbers, companies, schools, titles, or metrics.
- Keep all factual content from the source text.
- If key data is missing, keep field empty/null and add clear follow-up questions.
- Keep wording concise and ATS-friendly.
- Dates should be normalized when possible, prefer YYYY.MM format.
- Output must be valid JSON only.

Output JSON shape:
{{
  "optimized_profile": {{
    "basics": {{
      "name": "string",
      "phone": "string|null",
      "email": "string|null",
      "degree": "string|null",
      "graduation_year": "number|null",
      "target_role": "string|null",
      "summary": "string|null"
    }},
    "education": [
      {{
        "school": "string",
        "degree_type": "string",
        "major": "string",
        "start_date": "string",
        "end_date": "string",
        "courses": ["string"],
        "awards": ["string"],
        "gpa": "string|null"
      }}
    ],
    "work_experience": [
      {{
        "company": "string",
        "role": "string",
        "start_date": "string",
        "end_date": "string",
        "is_internship": false,
        "responsibilities": [
          {{
            "category": "string",
            "description": "string",
            "metrics": ["string"],
            "keywords": ["string"]
          }}
        ]
      }}
    ],
    "research": [
      {{
        "title": "string",
        "type": "string",
        "start_date": "string",
        "end_date": "string",
        "description": "string",
        "contributions": "string",
        "publications": [
          {{
            "title": "string",
            "venue": "string",
            "status": "string"
          }}
        ]
      }}
    ],
    "skills": {{
      "data_analysis": ["string"],
      "visualization": ["string"],
      "programming": ["string"],
      "ai_tools": ["string"],
      "design": ["string"],
      "media": ["string"],
      "languages": [{{"language": "string", "level": "string"}}],
      "other": ["string"]
    }},
    "metadata": {{
      "source_format": "txt",
      "version": 1,
      "open_questions": ["string"]
    }}
  }},
  "open_questions": ["string"],
  "polish_summary": "string"
}}

Context:
- target_template: {template_hint}
- tone: {req.tone}
- language: {req.language}
"""

        user_prompt = f"""Full resume text:
{req.resume_text}
"""

        result = await llm_service.complete_json(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            json_schema={},
            api_key=req.api_key,
            provider=req.provider,
            model=req.model,
            api_endpoint=req.api_endpoint,
        )

        parsed = result.get("parsed", {})
        optimized_profile = (
            parsed.get("optimized_profile") if isinstance(parsed, dict) else None
        )
        if not isinstance(optimized_profile, dict):
            raise ValueError("LLM response missing optimized_profile")

        # Ensure minimal shape for frontend conversion.
        optimized_profile.setdefault("basics", {})
        optimized_profile.setdefault("education", [])
        optimized_profile.setdefault("work_experience", [])
        optimized_profile.setdefault("research", [])
        optimized_profile.setdefault("skills", {})
        optimized_profile.setdefault("metadata", {})

        response_data = {
            "optimized_profile": optimized_profile,
            "open_questions": parsed.get("open_questions")
            or optimized_profile.get("metadata", {}).get("open_questions", []),
            "polish_summary": parsed.get("polish_summary", ""),
        }
        return {"status": "ok", "data": response_data}
    except Exception as e:
        _raise_agent_http_error("Autofill failed", e)
