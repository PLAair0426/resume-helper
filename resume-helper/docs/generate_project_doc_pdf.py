from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


@dataclass
class Section:
    title: str
    note_lines: list[str]
    rel_path: str
    start_line: int
    end_line: int


REPO_ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = REPO_ROOT / "docs"
ASSETS_DIR = DOCS_DIR / "project_explain_assets"
OUTPUT_PDF = DOCS_DIR / "项目说明_分步骤截图.pdf"


def pick_font(size: int, mono: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if mono:
        candidates = [
            Path("C:/Windows/Fonts/consola.ttf"),
            Path("C:/Windows/Fonts/CascadiaMono.ttf"),
            Path("C:/Windows/Fonts/DejaVuSansMono.ttf"),
        ]
    else:
        candidates = [
            Path("C:/Windows/Fonts/msyh.ttc"),
            Path("C:/Windows/Fonts/msyhbd.ttc"),
            Path("C:/Windows/Fonts/simhei.ttf"),
            Path("C:/Windows/Fonts/arial.ttf"),
        ]

    for font_path in candidates:
        if font_path.exists():
            try:
                return ImageFont.truetype(str(font_path), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def read_file_lines(path: Path) -> list[str]:
    for enc in ("utf-8", "utf-8-sig", "gb18030"):
        try:
            return path.read_text(encoding=enc).splitlines()
        except UnicodeDecodeError:
            continue
    return path.read_text(errors="ignore").splitlines()


def wrap_by_chars(text: str, max_chars: int) -> list[str]:
    if not text:
        return [""]
    out: list[str] = []
    current = ""
    for ch in text:
        if ch == "\t":
            ch = "    "
        current += ch
        if len(current) >= max_chars:
            out.append(current)
            current = ""
    if current or not out:
        out.append(current)
    return out


def _line_height(font: ImageFont.ImageFont) -> int:
    left, top, right, bottom = font.getbbox("Hg")
    return max(1, bottom - top + 6)


def render_code_image(section: Section, target_width: int = 2100) -> Image.Image:
    file_path = REPO_ROOT / section.rel_path
    lines = read_file_lines(file_path)
    start = max(1, section.start_line)
    end = min(len(lines), section.end_line)

    code_font = pick_font(22, mono=True)
    line_height = _line_height(code_font)
    max_chars = 118

    rendered: list[str] = []
    for idx in range(start, end + 1):
        raw = lines[idx - 1].replace("\t", "    ")
        chunks = wrap_by_chars(raw, max_chars)
        for i, chunk in enumerate(chunks):
            if i == 0:
                rendered.append(f"{idx:>4}: {chunk}")
            else:
                rendered.append("      " + chunk)

    if not rendered:
        rendered = ["(empty snippet)"]

    padding = 36
    height = padding * 2 + line_height * len(rendered)
    img = Image.new("RGB", (target_width, height), color="#111827")
    draw = ImageDraw.Draw(img)

    y = padding
    for line in rendered:
        draw.text((padding, y), line, fill="#E5E7EB", font=code_font)
        y += line_height

    return img


def wrap_by_pixels(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split(" ")
    if len(words) <= 1:
        chars: list[str] = []
        current = ""
        for ch in text:
            trial = current + ch
            width = draw.textbbox((0, 0), trial, font=font)[2]
            if width <= max_width:
                current = trial
            else:
                if current:
                    chars.append(current)
                current = ch
        if current:
            chars.append(current)
        return chars or [text]

    lines: list[str] = []
    current = ""
    for word in words:
        trial = word if not current else f"{current} {word}"
        width = draw.textbbox((0, 0), trial, font=font)[2]
        if width <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [text]


def fit_image(img: Image.Image, max_width: int, max_height: int) -> Image.Image:
    w, h = img.size
    scale = min(max_width / w, max_height / h, 1.0)
    if scale >= 1.0:
        return img
    return img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)


def render_page(section: Section, code_img: Image.Image, page_no: int, total_pages: int) -> Image.Image:
    page_w, page_h = 2480, 3508  # A4 @ 300dpi
    margin = 120

    title_font = pick_font(56, mono=False)
    body_font = pick_font(30, mono=False)
    small_font = pick_font(24, mono=False)

    page = Image.new("RGB", (page_w, page_h), "#F9FAFB")
    draw = ImageDraw.Draw(page)

    y = margin
    draw.text((margin, y), section.title, fill="#111827", font=title_font)
    y += _line_height(title_font) + 20

    draw.text(
        (margin, y),
        f"代码位置: {section.rel_path}:{section.start_line}-{section.end_line}",
        fill="#374151",
        font=body_font,
    )
    y += _line_height(body_font) + 18

    for line in section.note_lines:
        wrapped = wrap_by_pixels(draw, line, body_font, page_w - margin * 2 - 24)
        for wline in wrapped:
            draw.text((margin + 24, y), f"• {wline}", fill="#1F2937", font=body_font)
            y += _line_height(body_font)
        y += 6

    y += 12
    draw.rectangle((margin, y, page_w - margin, page_h - margin - 80), outline="#D1D5DB", width=3)

    available_w = page_w - margin * 2 - 30
    available_h = page_h - y - margin - 110
    fitted = fit_image(code_img, available_w, available_h)
    x = (page_w - fitted.size[0]) // 2
    image_y = y + 15
    page.paste(fitted, (x, image_y))

    footer = f"第 {page_no} / {total_pages} 页"
    fw = draw.textbbox((0, 0), footer, font=small_font)[2]
    draw.text((page_w - margin - fw, page_h - margin), footer, fill="#6B7280", font=small_font)

    return page


def save_images(images: Iterable[Image.Image], out_path: Path) -> None:
    pages = list(images)
    if not pages:
        raise RuntimeError("No pages generated")
    first, rest = pages[0], pages[1:]
    first.save(str(out_path), save_all=True, append_images=rest, resolution=300)


def main() -> None:
    sections = [
        Section(
            title="1. AI 配置页：读取本地配置并自动回填",
            note_lines=[
                "该段负责从 /api/local-config 读取当前服务商配置，并将 API Key、模型、Endpoint 回填到界面。",
                "如果本地没有可用 Key，会显示明确错误提示，避免误用空配置发起解析。",
            ],
            rel_path="frontend/src/app/app/dashboard/ai/page.tsx",
            start_line=95,
            end_line=150,
        ),
        Section(
            title="2. 导入面板：解析重试与 401 立刻停止",
            note_lines=[
                "该段最多重试 5 次，选择置信度最高的解析结果。",
                "一旦识别到 invalid api key / unauthorized，会立即停止重试并提示用户更新对应服务商 API Key。",
            ],
            rel_path="frontend/src/components/agent/ResumeImportPanel.tsx",
            start_line=173,
            end_line=223,
        ),
        Section(
            title="3. 本地配置路由：不同服务商的环境变量别名",
            note_lines=[
                "该段定义各 Provider 的 API Key / Base URL / Model 别名映射。",
                "仅 OpenAI/Codex 允许泛化别名，降低错误读取其它服务商配置的风险。",
            ],
            rel_path="frontend/src/routes/api/local-config.ts",
            start_line=45,
            end_line=75,
        ),
        Section(
            title="4. 本地配置路由：防止跨服务商凭证泄漏",
            note_lines=[
                "该段按 provider 候选读取 TOML 配置；读取 auth.json 时仅在 provider=codex 才使用。",
                "目的是避免把 codex 认证信息错误注入 OpenAI 等其它服务商导致鉴权失败。",
            ],
            rel_path="frontend/src/routes/api/local-config.ts",
            start_line=296,
            end_line=356,
        ),
        Section(
            title="5. 后端解析：置信度重计算规则",
            note_lines=[
                "该段按姓名/联系方式/教育/工作/项目/技能完整度计算综合分数。",
                "当结构完整且非 fallback 解析时，直接返回 100%（1.0）。",
            ],
            rel_path="backend/services/parser_service.py",
            start_line=1086,
            end_line=1133,
        ),
        Section(
            title="6. 后端解析：输出最终 confidence/missing_fields",
            note_lines=[
                "该段把重算后的 confidence 写回 metadata，并在 API 返回体中输出 profile/confidence/missing_fields/open_questions。",
                "前端导入页据此展示置信度并决定是否继续人工补充。",
            ],
            rel_path="backend/services/parser_service.py",
            start_line=1413,
            end_line=1433,
        ),
        Section(
            title="7. 前端映射：先清理 AI 临时分组并重建菜单",
            note_lines=[
                "该段先删除历史 AI 自动分组，避免重复模块残留。",
                "只按模板标准模块（basic/skills/experience/projects/education）恢复菜单并排序。",
            ],
            rel_path="frontend/src/lib/profileConverter.ts",
            start_line=1695,
            end_line=1771,
        ),
        Section(
            title="8. 前端映射：工作经历字段精确落位",
            note_lines=[
                "该段把 work_experience 映射到 company/position/date/details，确保时间与职责进入对应输入框。",
                "职责统一转成 HTML 列表，避免所有文本堆到单个字段。",
            ],
            rel_path="frontend/src/lib/profileConverter.ts",
            start_line=2055,
            end_line=2130,
        ),
        Section(
            title="9. 前端映射：项目与经历纠偏、去除无效补充项",
            note_lines=[
                "该段将误判为项目的经历回迁并去重，删除空的补充项。",
                "最终只保留真实项目数据，避免“多出不该有模块”或内容堆叠。",
            ],
            rel_path="frontend/src/lib/profileConverter.ts",
            start_line=2131,
            end_line=2189,
        ),
    ]

    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    pages: list[Image.Image] = []
    total = len(sections)
    for idx, section in enumerate(sections, start=1):
        code = render_code_image(section)
        code.save(ASSETS_DIR / f"part_{idx:02d}.png")
        page = render_page(section, code, idx, total)
        page.save(ASSETS_DIR / f"page_{idx:02d}.png")
        pages.append(page.convert("RGB"))

    save_images(pages, OUTPUT_PDF)
    print(f"Generated PDF: {OUTPUT_PDF}")
    print(f"Assets dir: {ASSETS_DIR}")


if __name__ == "__main__":
    main()
