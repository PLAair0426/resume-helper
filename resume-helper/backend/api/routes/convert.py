"""数据模型转换端点 - ResumeData <-> ResumeProfile"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import re

router = APIRouter()


class ToProfileRequest(BaseModel):
    """Magic Resume的ResumeData → resume_profile.json"""
    resume_data: dict


class FromProfileRequest(BaseModel):
    """resume_profile.json → Magic Resume的ResumeData"""
    profile: dict
    existing_resume: Optional[dict] = None


def _strip_html(html: str) -> str:
    """去除HTML标签"""
    if not html:
        return ""
    text = re.sub(r'<[^>]+>', '', html)
    return text.strip()


def _html_to_responsibilities(details_html: str) -> list[dict]:
    """将Tiptap HTML的经历详情转为结构化responsibilities"""
    if not details_html:
        return []
    # 提取<li>中的内容
    items = re.findall(r'<li[^>]*>(.*?)</li>', details_html, re.DOTALL)
    if not items:
        # 没有列表，按段落分割
        items = [p for p in re.split(r'</?p[^>]*>', details_html) if p.strip()]
    if not items:
        items = [details_html]

    responsibilities = []
    for item in items:
        text = _strip_html(item).strip()
        if text:
            responsibilities.append({
                "category": "",
                "description": text,
                "metrics": [],
                "keywords": [],
            })
    return responsibilities


def _responsibilities_to_html(responsibilities: list[dict]) -> str:
    """将结构化responsibilities转为Tiptap HTML"""
    if not responsibilities:
        return ""
    items = []
    for r in responsibilities:
        desc = r.get("description", "")
        metrics = r.get("metrics", [])
        if metrics:
            desc += f"（{', '.join(metrics)}）"
        items.append(f"<li><p>{desc}</p></li>")
    return f"<ul>{''.join(items)}</ul>"


def _parse_date_range(date_str: str) -> tuple[str, str]:
    """解析日期范围字符串，如 '2023.06 - 2024.01' → ('2023.06', '2024.01')"""
    if not date_str:
        return ("", "")
    parts = re.split(r'\s*[-–—~至到]\s*', date_str, maxsplit=1)
    start = parts[0].strip() if len(parts) > 0 else ""
    end = parts[1].strip() if len(parts) > 1 else "至今"
    return (start, end)


def _skills_html_to_categories(skill_html: str) -> dict:
    """将技能HTML转为分类技能数组"""
    text = _strip_html(skill_html)
    if not text:
        return {}
    # 简单分割：按换行或分号
    items = re.split(r'[;\n；\r]+', text)
    return {"other": [item.strip() for item in items if item.strip()]}


def _skills_categories_to_html(skills: dict) -> str:
    """将分类技能转为HTML"""
    all_skills = []
    for category, items in skills.items():
        if isinstance(items, list):
            for item in items:
                if isinstance(item, str):
                    all_skills.append(item)
                elif isinstance(item, dict):
                    all_skills.append(f"{item.get('language', '')}: {item.get('level', '')}")
    if not all_skills:
        return ""
    items_html = "".join(f"<li><p>{s}</p></li>" for s in all_skills)
    return f"<ul>{items_html}</ul>"


@router.post("/convert/to-profile")
async def to_profile(req: ToProfileRequest):
    """将Magic Resume的ResumeData转为resume_profile.json格式"""
    try:
        rd = req.resume_data
        basic = rd.get("basic", {})

        # 教育
        education = []
        for edu in rd.get("education", []):
            education.append({
                "school": edu.get("school", ""),
                "degree_type": edu.get("degree", ""),
                "major": edu.get("major", ""),
                "start_date": edu.get("startDate", ""),
                "end_date": edu.get("endDate", ""),
                "gpa": edu.get("gpa"),
                "courses": [],
                "awards": [],
            })

        # 工作经历
        work_experience = []
        for exp in rd.get("experience", []):
            start, end = _parse_date_range(exp.get("date", ""))
            work_experience.append({
                "company": exp.get("company", ""),
                "role": exp.get("position", ""),
                "start_date": start,
                "end_date": end,
                "is_internship": False,
                "responsibilities": _html_to_responsibilities(exp.get("details", "")),
            })

        # 项目 → research
        research = []
        for proj in rd.get("projects", []):
            start, end = _parse_date_range(proj.get("date", ""))
            research.append({
                "title": proj.get("name", ""),
                "type": "项目",
                "start_date": start,
                "end_date": end,
                "description": _strip_html(proj.get("description", "")),
                "contributions": proj.get("role", ""),
            })

        # 技能
        skills = _skills_html_to_categories(rd.get("skillContent", ""))

        profile = {
            "basics": {
                "name": basic.get("name", ""),
                "phone": basic.get("phone", ""),
                "email": basic.get("email", ""),
                "degree": education[0]["degree_type"] if education else None,
                "target_role": basic.get("title", ""),
                "summary": None,
            },
            "education": education,
            "work_experience": work_experience,
            "research": research,
            "skills": skills,
            "metadata": {
                "source_format": "magic_resume",
                "version": 1,
            },
        }

        return {"status": "ok", "data": profile}
    except Exception as e:
        raise HTTPException(500, f"转换失败: {str(e)}")


@router.post("/convert/from-profile")
async def from_profile(req: FromProfileRequest):
    """将resume_profile.json转为Magic Resume的ResumeData格式"""
    try:
        p = req.profile
        basics = p.get("basics", {})

        # 基本信息
        basic = {
            "name": basics.get("name", ""),
            "title": basics.get("target_role", ""),
            "email": basics.get("email", ""),
            "phone": basics.get("phone", ""),
            "location": "",
            "birthDate": "",
            "employementStatus": "",
            "photo": "",
            "customFields": [],
            "icons": {},
            "githubKey": "",
            "githubUseName": "",
            "githubContributionsVisible": False,
        }

        # 教育
        education = []
        for edu in p.get("education", []):
            education.append({
                "id": f"edu_{len(education)}",
                "school": edu.get("school", ""),
                "major": edu.get("major", ""),
                "degree": edu.get("degree_type", ""),
                "startDate": edu.get("start_date", ""),
                "endDate": edu.get("end_date", ""),
                "gpa": edu.get("gpa", ""),
                "description": "",
                "visible": True,
            })

        # 工作经历
        experience = []
        for exp in p.get("work_experience", []):
            date_str = f"{exp.get('start_date', '')} - {exp.get('end_date', '')}"
            experience.append({
                "id": f"exp_{len(experience)}",
                "company": exp.get("company", ""),
                "position": exp.get("role", ""),
                "date": date_str,
                "details": _responsibilities_to_html(exp.get("responsibilities", [])),
                "visible": True,
            })

        # 项目
        projects = []
        for res in p.get("research", []):
            date_str = f"{res.get('start_date', '')} - {res.get('end_date', '')}"
            projects.append({
                "id": f"proj_{len(projects)}",
                "name": res.get("title", ""),
                "role": res.get("contributions", ""),
                "date": date_str,
                "description": f"<p>{res.get('description', '')}</p>",
                "visible": True,
            })

        # 技能
        skill_content = _skills_categories_to_html(p.get("skills", {}))

        result = {
            "basic": basic,
            "education": education,
            "experience": experience,
            "projects": projects,
            "skillContent": skill_content,
        }

        # 如果有现有简历，合并保留其设置
        if req.existing_resume:
            existing = req.existing_resume
            result["id"] = existing.get("id", "")
            result["title"] = existing.get("title", "")
            result["templateId"] = existing.get("templateId")
            result["menuSections"] = existing.get("menuSections", [])
            result["globalSettings"] = existing.get("globalSettings", {})
            result["customData"] = existing.get("customData", {})
            result["activeSection"] = existing.get("activeSection", "basic")
            result["draggingProjectId"] = None

        return {"status": "ok", "data": result}
    except Exception as e:
        raise HTTPException(500, f"转换失败: {str(e)}")
