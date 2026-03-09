"""简历生成服务 - 按岗位生成定制简历"""
import json
import logging
from typing import Optional

from backend.services.llm_service import llm_service
from backend.services.keyword_service import keyword_service

logger = logging.getLogger(__name__)


class GeneratorService:
    """根据profile + JD生成多版本简历"""

    async def generate(
        self,
        profile: dict,
        jd,  # JDInput model instance
        tone: str = "professional",
        version_types: list[str] = None,
    ) -> list[dict]:
        """
        生成多版本简历。

        Returns:
            [{"type": str, "content_md": str, "content_html": str, "scorecard": dict}]
        """
        if version_types is None:
            version_types = ["ats_friendly", "enhanced"]

        # 1. 分析JD关键词
        jd_analysis = await keyword_service.analyze_jd(jd.jd_text, jd.keywords)

        # 2. 计算当前覆盖度
        coverage = keyword_service.calculate_coverage(profile, jd_analysis)

        results = []
        for vtype in version_types:
            content = await self._generate_version(
                profile=profile,
                jd=jd,
                jd_analysis=jd_analysis,
                coverage=coverage,
                version_type=vtype,
                tone=tone,
            )
            results.append(content)

        return results

    async def _generate_version(
        self, profile, jd, jd_analysis, coverage, version_type, tone
    ) -> dict:
        """生成单个版本"""
        system_prompts = {
            "ats_friendly": self._ats_system_prompt(),
            "enhanced": self._enhanced_system_prompt(),
            "concise": self._concise_system_prompt(),
            "bilingual": self._bilingual_system_prompt(),
        }

        system_prompt = system_prompts.get(version_type, self._ats_system_prompt())

        profile_str = json.dumps(profile, ensure_ascii=False, indent=2)
        jd_text = jd.jd_text
        keywords_str = json.dumps(jd_analysis, ensure_ascii=False)
        coverage_str = json.dumps(coverage, ensure_ascii=False)

        user_prompt = f"""请根据以下信息生成{version_type}版简历：

## 候选人Profile
{profile_str}

## 目标岗位
- 职位：{jd.job_title}
- 公司：{jd.company or '未指定'}
- 语气：{tone}
- 语言：{jd.language}

## JD原文
{jd_text}

## 关键词分析
{keywords_str}

## 当前覆盖度
{coverage_str}

请输出JSON格式：
{{"content_md": "Markdown格式简历", "keyword_coverage": {{}}, "suggestions": []}}"""

        result = await llm_service.complete_json(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            json_schema={},
            temperature=0.3,
        )

        parsed = result["parsed"]
        return {
            "type": version_type,
            "content_md": parsed.get("content_md", ""),
            "content_html": None,  # 后续由模板引擎渲染
            "scorecard": {
                "keyword_coverage": parsed.get("keyword_coverage", {}),
                "suggestions": parsed.get("suggestions", []),
            },
        }

    def _ats_system_prompt(self) -> str:
        return """你是 Targeted Resume Writer（ATS友好版）。

严格约束：
1. 输出格式：单栏Markdown，使用标准分区标题（教育经历/工作经历/项目经历/技能）
2. 禁止：表格、图片、多栏布局、页眉页脚、文本框
3. 绝不捏造任何经历或指标；缺少指标时用[待补充]标记
4. 关键词自然融入summary/skills/experience，不堆砌
5. Bullet结构：动词开头 + 行为对象 + 方法/工具 + 可量化结果
6. 保留原始简历的全部内容，只可优化表述，不可删减
7. 缩写与全称并列（如 MBA / Master of Business Administration）"""

    def _enhanced_system_prompt(self) -> str:
        return """你是 Resume Content Enhancer（内容强化版）。

严格约束：
1. 保留原始简历全部内容
2. 在不改变事实的前提下，优化表述使其更有影响力
3. 为缺少量化指标的bullet建议补充方向（用[建议补充: ...]标记）
4. 关键词证据化：将JD关键词落到具体的职责/成果/工具栈上
5. 绝不捏造，缺失信息进入suggestions列表"""

    def _concise_system_prompt(self) -> str:
        return """你是 Resume Conciser（精简版）。

严格约束：
1. 将简历精简到一页A4纸的篇幅
2. 保留最核心的经历和成果
3. 优先保留与目标岗位最相关的内容
4. 每段经历保留2-3个最有影响力的bullet
5. 绝不捏造"""

    def _bilingual_system_prompt(self) -> str:
        return """你是 Bilingual Resume Writer（中英双语版）。

严格约束：
1. 输出中英双语简历，中文在前英文在后
2. 保持专有名词、技术栈、公司名不翻译
3. 英文部分使用地道的商务英语
4. 保留原始简历全部内容
5. 绝不捏造"""


# 全局单例
generator_service = GeneratorService()
