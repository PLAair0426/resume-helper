"""关键词分析与优化服务"""
import json
import logging
from typing import Optional

from backend.services.llm_service import llm_service

logger = logging.getLogger(__name__)

# 关键词权重定义（来自PDF方案）
KEYWORD_WEIGHTS = {
    "must_have": 5,
    "title_level": 4,
    "core": 3,
    "evidence": 2,
    "nice_to_have": 1,
}


class KeywordService:
    """JD关键词分析与简历匹配优化"""

    async def analyze_jd(self, jd_text: str, user_keywords: list[str] = None, api_key: str = None, provider: str = None, model: str = None, api_endpoint: str = None) -> dict:
        """
        分析JD，提取分层关键词。

        Returns:
            {
                "must_have": [{"keyword": str, "weight": 5}],
                "core": [...],
                "nice_to_have": [...],
                "title_level": [...],
                "evidence": [...],
            }
        """
        system_prompt = """你是关键词分析专家。从JD中提取关键词并分层：

1. must_have（权重5）：JD中明确要求的硬性条件（如"必须有X经验"、"要求X学历"）
2. title_level（权重4）：职位名称、职级相关词
3. core（权重3）：核心技能、关键职责描述中的能力词
4. evidence（权重2）：证据词（指标类型、规模描述、结果导向词）
5. nice_to_have（权重1）：加分项、优先考虑项

对每个关键词，同时给出同义词/缩写变体。

输出JSON格式：
{
  "must_have": [{"keyword": "Python", "variants": ["python", "Python3"], "weight": 5}],
  "title_level": [...],
  "core": [...],
  "evidence": [...],
  "nice_to_have": [...]
}"""

        user_msg = f"JD原文：\n{jd_text}"
        if user_keywords:
            user_msg += f"\n\n用户指定关键词：{', '.join(user_keywords)}"

        result = await llm_service.complete_json(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            json_schema={},
            temperature=0.1,
            api_key=api_key,
            provider=provider,
            model=model,
            api_endpoint=api_endpoint,
        )

        return result["parsed"]

    def calculate_coverage(self, profile: dict, jd_analysis: dict) -> dict:
        """
        计算关键词覆盖度。

        Returns:
            {
                "overall": float,
                "by_category": {"must_have": float, ...},
                "matched": [{"keyword": str, "found_in": str}],
                "gaps": [{"keyword": str, "category": str, "weight": int}],
            }
        """
        # 将profile转为可搜索的文本
        profile_text = json.dumps(profile, ensure_ascii=False).lower()

        matched = []
        gaps = []
        total_weight = 0
        matched_weight = 0
        by_category = {}

        for category, weight in KEYWORD_WEIGHTS.items():
            keywords = jd_analysis.get(category, [])
            cat_total = 0
            cat_matched = 0

            for kw_item in keywords:
                keyword = kw_item.get("keyword", "") if isinstance(kw_item, dict) else str(kw_item)
                variants = kw_item.get("variants", [keyword]) if isinstance(kw_item, dict) else [keyword]
                kw_weight = kw_item.get("weight", weight) if isinstance(kw_item, dict) else weight

                total_weight += kw_weight
                cat_total += kw_weight

                # 检查关键词或其变体是否出现在profile中
                found = False
                for variant in [keyword] + variants:
                    if variant.lower() in profile_text:
                        found = True
                        break

                if found:
                    matched_weight += kw_weight
                    cat_matched += kw_weight
                    matched.append({"keyword": keyword, "category": category, "weight": kw_weight})
                else:
                    gaps.append({"keyword": keyword, "category": category, "weight": kw_weight})

            by_category[category] = cat_matched / cat_total if cat_total > 0 else 0

        overall = matched_weight / total_weight if total_weight > 0 else 0

        return {
            "overall": round(overall, 3),
            "by_category": {k: round(v, 3) for k, v in by_category.items()},
            "matched": matched,
            "gaps": gaps,
        }


# 全局单例
keyword_service = KeywordService()
