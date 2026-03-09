"""Agent编排器 - 基于LangGraph的多Agent工作流"""
import logging
from typing import TypedDict, Optional, Annotated
from operator import add

logger = logging.getLogger(__name__)


class ResumeState(TypedDict):
    """Agent共享状态"""
    session_id: str
    status: str  # parsing/parsed/confirming/generating/auditing/optimizing/exporting/done
    source_path: str
    source_format: str

    # Parser输出
    raw_text: Optional[str]
    profile: Optional[dict]
    extraction_confidence: float
    missing_fields: list[str]
    open_questions: list[str]
    profile_confirmed: bool

    # JD输入
    jd_text: Optional[str]
    job_title: Optional[str]
    jd_analysis: Optional[dict]

    # 生成输出
    keyword_coverage: Optional[dict]
    versions: list[dict]  # [{type, content_md, scorecard}]
    ats_scorecard: Optional[dict]

    # 反馈
    feedback: list[str]

    # 错误
    errors: Annotated[list[str], add]


async def parse_node(state: ResumeState) -> dict:
    """Parser Agent节点"""
    from backend.services.parser_service import parser_service

    try:
        result = await parser_service.parse(state["source_path"], state["source_format"])
        return {
            "status": "parsed",
            "raw_text": result.get("raw_text"),
            "profile": result["profile"],
            "extraction_confidence": result["confidence"],
            "missing_fields": result.get("missing_fields", []),
            "open_questions": result.get("open_questions", []),
        }
    except Exception as e:
        return {"errors": [f"解析失败: {str(e)}"], "status": "error"}


async def analyze_jd_node(state: ResumeState) -> dict:
    """JD分析节点"""
    from backend.services.keyword_service import keyword_service

    jd_analysis = await keyword_service.analyze_jd(state["jd_text"])
    coverage = keyword_service.calculate_coverage(state["profile"], jd_analysis)

    return {
        "jd_analysis": jd_analysis,
        "keyword_coverage": coverage,
        "status": "jd_analyzed",
    }


async def generate_node(state: ResumeState) -> dict:
    """Generator Agent节点"""
    from backend.services.generator_service import generator_service

    class MockJD:
        def __init__(self, s):
            self.jd_text = s.get("jd_text", "")
            self.job_title = s.get("job_title", "")
            self.company = None
            self.keywords = []
            self.language = "zh-CN"

    jd = MockJD(state)
    versions = await generator_service.generate(
        profile=state["profile"],
        jd=jd,
        version_types=["ats_friendly", "enhanced"],
    )

    return {"versions": versions, "status": "generated"}


async def ats_audit_node(state: ResumeState) -> dict:
    """ATS Auditor Agent节点"""
    from backend.services.llm_service import llm_service

    # 对每个版本进行ATS审计
    for version in state.get("versions", []):
        system_prompt = """你是ATS审计专家。检查以下简历内容的ATS友好性：
1. 是否使用标准分区标题
2. 是否有表格/图片/多栏等ATS不友好元素
3. 关键词是否自然融入
4. 日期格式是否统一
5. 联系方式是否在正文区域

输出JSON: {"format_risk": "low/medium/high", "issues": [], "score": 0.0-1.0}"""

        result = await llm_service.complete_json(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": version.get("content_md", "")},
            ],
            json_schema={},
        )
        version["ats_audit"] = result["parsed"]

    return {"versions": state["versions"], "status": "audited"}


def should_regenerate(state: ResumeState) -> str:
    """质量门控：决定是否需要重新生成"""
    versions = state.get("versions", [])
    for v in versions:
        audit = v.get("ats_audit", {})
        if audit.get("score", 1.0) < 0.6:
            return "regenerate"
    return "proceed"


def needs_confirmation(state: ResumeState) -> str:
    """检查是否需要人类确认"""
    if state.get("extraction_confidence", 0) < 0.7:
        return "needs_confirmation"
    if state.get("open_questions"):
        return "needs_confirmation"
    return "auto_confirm"


# LangGraph工作流构建（延迟导入，避免循环依赖）
def build_workflow():
    """构建完整的Agent工作流"""
    try:
        from langgraph.graph import StateGraph, END

        workflow = StateGraph(ResumeState)

        # 添加节点
        workflow.add_node("parse", parse_node)
        workflow.add_node("analyze_jd", analyze_jd_node)
        workflow.add_node("generate", generate_node)
        workflow.add_node("ats_audit", ats_audit_node)

        # 设置入口
        workflow.set_entry_point("parse")

        # 添加边
        workflow.add_conditional_edges(
            "parse",
            needs_confirmation,
            {
                "needs_confirmation": END,  # 暂停等待人类确认
                "auto_confirm": "analyze_jd",
            },
        )
        workflow.add_edge("analyze_jd", "generate")
        workflow.add_edge("generate", "ats_audit")
        workflow.add_conditional_edges(
            "ats_audit",
            should_regenerate,
            {
                "regenerate": "generate",
                "proceed": END,
            },
        )

        return workflow.compile()

    except ImportError:
        logger.warning("LangGraph not installed, workflow not available")
        return None
