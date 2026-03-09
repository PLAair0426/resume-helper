# Resume Helper 仓库说明

当前仓库已经整理为双应用结构，`resume-helper/` 目录下只保留两个子目录：

- `resume-helper/backend/`：FastAPI 后端、知识库、测试、部署脚本、项目文档
- `resume-helper/frontend/`：前端应用、Cloudflare 部署配置、前端说明

## 目录结构

```text
.
├─ resume-helper/
│  ├─ backend/
│  │  ├─ api/
│  │  ├─ core/
│  │  ├─ services/
│  │  ├─ knowledge/
│  │  ├─ constitution/
│  │  ├─ tests/
│  │  ├─ docs/
│  │  ├─ package.json
│  │  ├─ render.yaml
│  │  ├─ docker-compose.yml
│  │  ├─ start.bat
│  │  └─ start.sh
│  └─ frontend/
│     ├─ src/
│     ├─ public/
│     ├─ package.json
│     └─ wrangler.toml
└─ .gitignore
```

## 环境要求

- Python 3.10+
- Node.js 18+
- npm 9+

## 快速启动

### 从仓库根目录启动

```bash
npm --prefix resume-helper/backend run dev
```

### 从后端目录启动

```bash
cd resume-helper/backend
npm run dev
```

默认地址：

- 后端：`http://localhost:8000`
- 前端：`http://localhost:5173`

## 分别启动

### 后端

```bash
cd resume-helper/backend
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --app-dir .. --reload --reload-dir . --port 8000
```

### 前端

```bash
cd resume-helper/frontend
npm install
npm run dev
```

## 常用命令

从仓库根目录执行：

```bash
npm --prefix resume-helper/backend run dev
npm --prefix resume-helper/backend run dev:backend
npm --prefix resume-helper/backend run dev:frontend
npm --prefix resume-helper/backend run build
npm --prefix resume-helper/backend run start
npm --prefix resume-helper/backend run test
```

## 配置说明

- 后端环境变量示例：`resume-helper/backend/.env.example`
- 前端本地 JSON 配置：`resume-helper/frontend/local-config.json`
- 前端配置模板：`resume-helper/frontend/local-config.example.json`
- 自定义前端本地配置路径：设置环境变量 `LOCAL_CONFIG_JSON_PATH`

后端默认运行目录：

- 上传目录：`resume-helper/backend/uploads`
- 导出目录：`resume-helper/backend/exports`
- SQLite 数据库：`resume-helper/backend/resume_agent.db`

## 文档位置

项目文档统一保存在：

- `resume-helper/backend/docs/PROJECT_README.md`
- `resume-helper/backend/docs/INTEGRATION.md`
- `resume-helper/backend/docs/STARTUP_TEST.md`
- `resume-helper/backend/docs/TEST_REPORT.md`

前端附带文档保留在：

- `resume-helper/frontend/README.md`
- `resume-helper/frontend/README.en-US.md`

## 部署

### Cloudflare

前端部署目录：

```text
resume-helper/frontend
```

常用命令：

```bash
cd resume-helper/frontend
npm run deploy:cloudflare
```

### Render

后端部署配置文件：

```text
resume-helper/backend/render.yaml
```

其中后端服务 `rootDir` 为 `resume-helper/backend`，前端服务 `rootDir` 为 `resume-helper/frontend`。

## 安全说明

仓库默认忽略以下敏感或生成内容：

- 本地 `.env`
- API Key 与本地私密配置
- `node_modules`
- 构建产物
- 本地数据库
- 上传文件、导出文件、日志与诊断文件
