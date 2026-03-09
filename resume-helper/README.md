# Resume Helper

`Resume Helper` 是一个面向简历生成与优化场景的 AI 应用，提供从简历导入、结构化解析、岗位 JD 分析、ATS 审核、关键词覆盖评估，到多版本生成和多格式导出的完整工作流。

项目采用前后端分离架构：

- 后端：`FastAPI` + `LangGraph` + `LiteLLM` + `SQLAlchemy`
- 前端：`TanStack Start` + `React` + `TypeScript` + `Zustand`
- 存储：默认 `SQLite`，可切换其他数据库
- 导出：支持 `PDF`、`DOCX`、`Markdown`、`TXT`

---

## 1. 项目能力

### 核心功能

- 简历上传与解析：支持 `PDF`、`DOCX`、`DOC`、`TXT`、`MD`
- 结构化抽取：将原始简历文本转换为统一的 Profile 数据
- JD 分析：提取岗位关键词、层级需求与岗位语义信息
- 关键词覆盖率分析：比较简历内容与 JD 的匹配程度
- ATS 审核：评估格式风险、关键词命中与 ATS 友好度
- 内容优化：根据 JD 与已有简历内容生成优化建议
- 自动补全：根据上下文自动补充简历段落或字段
- 多版本生成：支持 ATS 版、增强版等多种简历版本
- 多格式导出：导出为 `PDF`、`DOCX`、`Markdown`、`TXT`
- 知识库增强：内置 ATS 规则、动作动词、模板与写作指南

### 当前实现中的关键约束

- 默认单文件大小限制为 `10MB`
- 默认允许上传扩展名：`.pdf`、`.docx`、`.doc`、`.txt`、`.md`
- OCR 依赖在代码中为“可选能力”，当前默认安装流程未启用 `pytesseract`
- PDF 导出依赖 `Playwright` 的 Chromium 浏览器

---

## 2. 技术架构

### 后端

- `FastAPI`：对外提供 REST API
- `LangGraph`：组织多阶段 Agent 工作流
- `LiteLLM`：统一接入多个大模型提供方
- `SQLAlchemy asyncio`：管理会话、简历 Profile、JD、版本与反馈
- `pdfplumber` / `python-docx`：文档解析
- `Playwright` / `python-docx`：导出 PDF 与 DOCX

### 前端

- `TanStack Start`：应用框架与路由
- `React 18` + `TypeScript`
- `Zustand`：状态管理
- `TipTap`：富文本编辑
- `Tailwind CSS` + `HeroUI` + `Radix UI`

### 典型流程

```text
上传简历
  -> 解析原始文本
  -> 提取结构化 Profile
  -> 录入 / 分析 JD
  -> 生成候选版本
  -> ATS 审核
  -> 导出 PDF / DOCX / Markdown / TXT
```

`backend/agents/orchestrator.py` 中的编排逻辑已经实现了 `parse -> analyze_jd -> generate -> ats_audit` 的主流程，并带有“是否需要人工确认”和“是否需要重新生成”的判断分支。

---

## 3. 目录结构

```text
resume-helper/
├─ backend/                  # FastAPI 后端
│  ├─ api/routes/            # API 路由
│  ├─ agents/                # LangGraph 工作流编排
│  ├─ core/                  # 配置与数据库
│  ├─ models/                # SQLAlchemy 数据模型
│  ├─ services/              # 业务服务层
│  ├─ main.py                # FastAPI 入口
│  └─ requirements.txt       # Python 依赖
├─ frontend/                 # TanStack Start 前端
│  ├─ src/routes/            # 页面与前端 API 代理
│  ├─ src/components/        # UI 组件
│  ├─ src/store/             # Zustand 状态管理
│  ├─ src/lib/               # 工具函数
│  ├─ vite.config.ts         # Vite 配置
│  └─ server.mjs             # 生产环境前端服务入口
├─ constitution/             # Agent 约束与 schema
├─ knowledge/                # 内置知识库
│  ├─ ats_rules/
│  ├─ action_verbs/
│  ├─ industry_terms/
│  ├─ templates/
│  └─ writing_guides/
├─ docs/                     # 补充文档与项目说明
├─ uploads/                  # 上传文件目录
├─ exports/                  # 导出产物目录
├─ state/                    # 状态与版本相关数据
├─ package.json              # 项目级 Node 脚本
├─ start.bat                 # Windows 一键启动
├─ start.sh                  # Linux / macOS 一键启动
└─ docker-compose.yml        # Docker Compose 配置
```

### 知识库内容

当前仓库内的 `knowledge/` 目录包含以下类型的数据：

- ATS 规则
- 动作动词词库
- 通用行业术语
- 5 个 HTML 模板
- 1 份写作风格指南

---

## 4. 运行环境要求

### 必需

- `Python 3.10+`
- `Node.js 18+`
- `npm 9+`

### 推荐

- Windows 10/11、macOS 或 Linux
- 可用的大模型 API Key：
  - `OpenAI`
  - `Anthropic`
  - `DeepSeek`

### 仅在导出 PDF 时建议安装

```bash
python -m playwright install chromium
```

---

## 5. 安装步骤

以下步骤默认在 `resume-helper/` 目录中执行。

### 5.1 安装后端依赖

```bash
pip install -r backend/requirements.txt
```

如果你使用虚拟环境，推荐先创建并激活：

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Linux / macOS:

```bash
source .venv/bin/activate
```

### 5.2 安装前端依赖

```bash
npm install
cd frontend && npm install
cd ..
```

说明：

- `resume-helper/package.json` 负责管理项目级脚本
- `frontend/package.json` 负责前端应用自身依赖

---

## 6. 环境变量配置

项目后端配置由 `backend/core/config.py` 读取。推荐在 `resume-helper/` 根目录创建 `.env` 文件，并参考 `backend/.env.example` 填写内容。

### 最小示例

```env
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=

LLM_DEFAULT_PROVIDER=openai
LLM_OPENAI_MODEL=gpt-4o
LLM_ANTHROPIC_MODEL=claude-sonnet-4-20250514
LLM_DEEPSEEK_MODEL=deepseek-chat

DATABASE_URL=sqlite+aiosqlite:///./resume_agent.db

STORAGE_UPLOAD_DIR=./uploads
STORAGE_EXPORT_DIR=./exports

PRIVACY_ANONYMIZE_LLM_INPUT=true
PRIVACY_UPLOAD_TTL_DAYS=7

CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","http://localhost:3000","http://127.0.0.1:3000"]
```

### 常用变量说明

| 变量名 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `LLM_DEFAULT_PROVIDER` | 默认模型提供方 |
| `LLM_OPENAI_MODEL` | OpenAI 默认模型 |
| `LLM_ANTHROPIC_MODEL` | Anthropic 默认模型 |
| `LLM_DEEPSEEK_MODEL` | DeepSeek 默认模型 |
| `DATABASE_URL` | 数据库连接字符串 |
| `STORAGE_UPLOAD_DIR` | 上传目录 |
| `STORAGE_EXPORT_DIR` | 导出目录 |
| `PRIVACY_ANONYMIZE_LLM_INPUT` | 是否匿名化传给 LLM 的输入 |
| `PRIVACY_UPLOAD_TTL_DAYS` | 上传文件保留天数 |
| `CORS_ORIGINS` | 允许跨域访问的前端地址 |

### 前端连接后端

前端代理默认使用：

```env
VITE_AGENT_API_URL=http://localhost:8000
```

如果后端地址变化，可在前端运行环境中覆盖该变量。

---

## 7. 启动方式

### 7.1 开发模式：同时启动前后端

在 `resume-helper/` 目录执行：

```bash
npm run dev
```

这条命令会并发执行：

- `npm run dev:backend`
- `npm run dev:frontend`

### 对应的实际命令

后端：

```bash
python -m uvicorn backend.main:app --reload --reload-dir backend --port 8000
```

前端：

```bash
cd frontend
npm run dev
```

### 访问地址

- 前端开发地址：`http://localhost:5173`
- 后端 API：`http://localhost:8000`
- Swagger 文档：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/health`

### 7.2 分别启动前后端

### 只启动后端

```bash
npm run dev:backend
```

### 只启动前端

```bash
npm run dev:frontend
```

### 7.3 Windows 一键启动

在 `resume-helper/` 目录执行：

```bash
.\start.bat
```

该脚本会：

- 检查 `Python` 与 `Node.js`
- 检查并安装缺失依赖
- 分别在两个新窗口中启动后端与前端

### 7.4 Linux / macOS 一键启动

```bash
chmod +x start.sh
./start.sh
```

### 7.5 从仓库最外层目录启动

如果你当前位于上一级工作区根目录（也就是包含外层 `package.json` 的目录），也可以直接运行：

```bash
npm run dev
```

外层脚本会自动切换到本项目目录再执行启动命令。

---

## 8. 生产环境运行

### 8.1 构建前端

```bash
npm run build
```

### 8.2 启动生产服务

```bash
npm run start
```

默认情况下：

- 后端启动在 `8000`
- 前端生产服务由 `frontend/server.mjs` 启动，默认端口为 `3000`

### 8.3 Docker Compose

```bash
docker-compose up -d
```

当前 `docker-compose.yml` 中：

- 后端映射端口：`8000:8000`
- 前端映射端口：`3000:3000`
- PostgreSQL 映射端口：`5432:5432`

---

## 9. API 概览

所有业务接口默认挂载在 `/api/v1` 下。

### 文件与简历解析

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/upload` | 上传简历文件 |
| `POST` | `/parse/{session_id}` | 解析指定会话的简历 |
| `GET` | `/parse/{session_id}` | 获取解析结果 |
| `PUT` | `/profile/{profile_id}` | 更新结构化简历 Profile |

### JD / ATS / 优化

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/analyze/jd` | 分析岗位 JD |
| `POST` | `/analyze/coverage` | 计算关键词覆盖率 |
| `POST` | `/analyze/ats` | 执行 ATS 审核 |
| `POST` | `/optimize/content` | 优化简历内容 |
| `POST` | `/autofill/text` | 自动补全文本 |

### 生成与导出

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/generate` | 生成简历版本 |
| `POST` | `/export` | 导出文件 |
| `POST` | `/convert/to-profile` | 将文本转换为标准 Profile |
| `POST` | `/convert/from-profile` | 从 Profile 还原文本内容 |

### 知识库

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/knowledge/query` | 查询知识库 |
| `GET` | `/knowledge/stats` | 查看知识库统计 |
| `POST` | `/knowledge/init` | 手动初始化知识库 |

### 版本与反馈

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/versions/{session_id}` | 获取某会话下的所有版本 |
| `GET` | `/version/{version_id}` | 获取单个版本详情 |
| `POST` | `/feedback` | 提交用户反馈 |
| `DELETE` | `/data/{session_id}` | 删除会话相关数据 |

### 健康检查

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 返回服务状态与版本号 |

---

## 10. 数据模型

后端当前的核心数据实体包括：

- `ResumeSession`：一次简历处理会话
- `ResumeProfile`：结构化后的简历数据
- `JDInput`：职位描述输入
- `ResumeVersion`：生成出的简历版本
- `FeedbackLog`：用户反馈日志

默认数据库为 SQLite，常见数据库文件名为：

```text
resume_agent.db
```

---

## 11. 导出说明

### 支持格式

- `PDF`
- `DOCX`
- `Markdown`
- `TXT`

### PDF 导出前提

如果遇到 PDF 导出失败，优先检查：

1. 是否已安装 `playwright`
2. 是否已执行 `python -m playwright install chromium`
3. 运行机器是否允许拉起 Chromium

### DOCX 导出说明

DOCX 导出使用 `python-docx` 生成，适合 ATS 友好版本导出。

---

## 12. 开发脚本

### 项目级脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同时启动前后端开发服务 |
| `npm run dev:backend` | 仅启动后端开发服务 |
| `npm run dev:frontend` | 仅启动前端开发服务 |
| `npm run build` | 构建前端产物 |
| `npm run start` | 启动生产环境服务 |

### 关于测试

当前仓库中：

- `backend` 侧保留了 `pytest` 执行入口
- `tests/` 目录当前未提交实际测试文件
- `frontend/package.json` 当前未定义正式的 `test` 脚本

因此，如果你要补充自动化测试，建议优先从以下两部分开始：

- 后端 API 的 `pytest` 集成测试
- 前端页面与组件的单元测试 / E2E 测试

---

## 13. 手动验收建议

启动项目后，可按下面顺序做一次手动验证：

1. 打开 `http://localhost:5173`
2. 确认首页或工作台页面可正常访问
3. 打开 `http://localhost:8000/health`
4. 打开 `http://localhost:8000/docs`
5. 上传一份测试简历
6. 触发解析并检查 Profile 是否生成
7. 输入一段 JD，执行分析与覆盖率计算
8. 生成一个简历版本
9. 测试导出 `Markdown` / `DOCX` / `PDF`

---

## 14. 常见问题

### 1）`python` 或 `node` 找不到

请先确认以下命令能正常执行：

```bash
python --version
node --version
npm --version
```

### 2）后端启动时报依赖缺失

重新安装后端依赖：

```bash
pip install -r backend/requirements.txt
```

### 3）前端启动时报模块缺失

重新安装前端依赖：

```bash
npm install
cd frontend && npm install
cd ..
```

### 4）AI 生成功能没有输出

优先检查：

- 是否配置了至少一个有效的 LLM API Key
- 前端是否正确指向后端地址
- 后端日志中是否出现上游模型报错

### 5）PDF 导出失败

通常与 Playwright 浏览器未安装有关，执行：

```bash
python -m playwright install chromium
```

---

## 15. 相关文档

仓库还提供了以下补充材料：

- `docs/INTEGRATION.md`
- `docs/STARTUP_TEST.md`
- `docs/TEST_REPORT.md`

如果需要对外演示，也可以参考 `docs/` 目录中的 PDF 文档。

---

## 16. 许可证

本项目当前声明为 `MIT` 许可证。
