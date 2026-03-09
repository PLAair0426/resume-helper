# Resume Helper - 项目整合完成

> 结构说明：当前项目代码位于 `resume-helper/` 目录下，并按 `backend/` 与 `frontend/` 两部分组织。

## 项目结构

```
resume-helper/                    # 统一项目根目录
├── backend/                      # FastAPI 后端
│   ├── api/routes/              # 24 个 API 端点
│   ├── agents/                  # LangGraph 工作流编排
│   ├── services/                # 业务逻辑服务
│   ├── models/                  # SQLAlchemy 数据模型
│   ├── core/                    # 配置与数据库
│   └── requirements.txt         # Python 依赖
├── frontend/                     # TanStack Start 前端
│   ├── src/
│   │   ├── routes/              # 页面路由 + API 代理
│   │   ├── components/          # UI 组件（7 模板 + Agent 面板）
│   │   ├── store/               # Zustand 状态管理
│   │   └── lib/                 # 工具函数
│   └── package.json             # Node 依赖
├── constitution/                 # 宪法层（Agent 行为准则）
├── knowledge/                    # RAG 知识库（43 篇文档）
├── skills/                       # Agent 技能模块
├── state/                        # 版本控制与反馈日志
├── tests/                        # 测试套件
├── docker/                       # Docker 配置
├── package.json                  # 根目录 npm 配置
├── docker-compose.yml            # Docker Compose 配置
├── start.sh                      # Linux/Mac 启动脚本
├── start.bat                     # Windows 启动脚本
└── README.md                     # 项目文档
```

## 快速启动

### 方式 1：一键启动脚本

**Windows**:
```bash
cd h:/简历助手/resume-helper
start.bat
```

**Linux/Mac**:
```bash
cd h:/简历助手/resume-helper
chmod +x start.sh
./start.sh
```

### 方式 2：npm 命令

```bash
cd h:/简历助手/resume-helper
npm install
npm run dev
```

### 方式 3：手动启动

**终端 1 - 后端**:
```bash
cd h:/简历助手/resume-helper
python -m uvicorn backend.main:app --reload --reload-dir backend --port 8000
```

**终端 2 - 前端**:
```bash
cd h:/简历助手/resume-helper/frontend
npm run dev
```

## 访问地址

- 前端：http://localhost:5173
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

## 配置 LLM API Key

### 方式 1：前端 UI 配置（推荐）
1. 打开 http://localhost:5173
2. 进入 Dashboard → AI 设置
3. 选择供应商（OpenAI/Claude/DeepSeek/豆包）
4. 输入 API Key
5. 保存

### 方式 2：后端环境变量
1. 复制 `backend/.env.example` 到 `backend/.env`
2. 编辑 `.env` 文件，填入至少一个 API Key
3. 重启后端

## 功能验证

### 1. 后端健康检查
```bash
curl http://localhost:8000/health
# 应返回: {"status":"ok","version":"0.1.0"}
```

### 2. 知识库统计
```bash
curl http://localhost:8000/api/v1/knowledge/stats
# 应返回: 4 个集合，43 篇文档
```

### 3. 前端页面
- 访问 http://localhost:5173
- 应看到 Dashboard 页面
- 点击"新建简历"可创建简历
- 进入工作台后右下角有 Agent 工具栏（Bot 图标）

## 核心功能

### Agent 工作流
1. **文档解析**：上传 PDF/DOCX → 自动解析 → 结构化数据
2. **JD 分析**：输入岗位描述 → 分层关键词提取 → 覆盖度计算
3. **ATS 审计**：格式检查 → 评分 → 改进建议
4. **内容优化**：关键词优化 → 证据化改写 → 多版本生成
5. **导出**：PDF/DOCX/MD/TXT 多格式导出

### 7 套简历模板
- Template A：左右分栏深蓝
- Template B：经典单栏
- Template C：顶部横幅
- Template D：绿色清新
- Template E：时间线卡片
- 另外 2 套在前端模板库中

### RAG 知识库
- ATS 规则（8 篇）
- 动词词库（2 篇）
- 行业词表（28 篇）
- 写作指南（5 篇）

## 技术栈

- **后端**：FastAPI 0.115+, LangGraph 0.2+, LiteLLM 1.40+, SQLAlchemy 2.0+
- **前端**：TanStack Start, React 18+, Zustand 4+, Tailwind CSS 3+, shadcn/ui
- **LLM**：多供应商支持（OpenAI/Claude/DeepSeek/豆包）
- **数据库**：SQLite（开发）/ PostgreSQL（生产）
- **知识库**：TF-IDF + scikit-learn（纯 Python，无原生依赖）

## 项目迁移说明

本项目由以下两个项目整合而成：
- `resume-agent/` → `resume-helper/backend` + 知识层
- `magic-resume-main/` → `resume-helper/frontend`

关键变更：
1. 后端启动命令从 `cd backend && uvicorn ...` 改为从项目根目录运行 `uvicorn backend.main:app`
2. Python 模块导入路径保持 `backend.*` 不变
3. 前端 API 代理配置保持不变（`VITE_AGENT_API_URL`）
4. 知识库路径自动适配（`Path(__file__).parent.parent.parent / "knowledge"`）

## Docker 部署

```bash
cd h:/简历助手/resume-helper
docker-compose up -d
```

服务将在以下端口启动：
- 前端：3000
- 后端：8000
- PostgreSQL：5432

## 故障排查

### 后端启动失败
- 检查 Python 版本：`python --version`（需要 3.10+）
- 检查依赖：`pip list | grep fastapi`
- 查看日志：后端窗口的错误信息

### 前端启动失败
- 检查 Node 版本：`node --version`（需要 18+）
- 重新安装依赖：`cd frontend && rm -rf node_modules && npm install`
- 查看日志：前端窗口的错误信息

### Agent 功能不可用
- 确认后端已启动：访问 http://localhost:8000/health
- 确认 API Key 已配置：Dashboard → AI 设置
- 检查浏览器控制台：F12 → Console 查看错误

## 开发指南

### 添加新的 Agent
1. 在 `backend/agents/orchestrator.py` 添加节点函数
2. 在 `build_workflow()` 中注册节点和边
3. 更新 `ResumeState` TypedDict 添加新状态字段

### 添加新的 API 端点
1. 在 `backend/api/routes/` 创建新路由文件
2. 在 `backend/main.py` 注册路由
3. 在 `frontend/src/routes/api/agent/` 创建代理路由

### 添加新的知识库文档
1. 在 `knowledge/` 对应目录添加 `.md` 或 `.json` 文件
2. 重启后端，知识库自动加载
3. 通过 `/api/v1/knowledge/stats` 验证

## License

MIT
