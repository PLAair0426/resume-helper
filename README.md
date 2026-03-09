# 简历助手

这个仓库的实际应用代码位于 `resume-helper/` 目录，仓库根目录主要提供统一启动脚本和委托式 `npm` 脚本。

## 目录说明

- `resume-helper/`：主项目目录，包含前端、后端、知识库与详细文档
- `package.json`：根目录启动脚本，会转发到 `resume-helper/`
- `start.bat` / `start.sh`：根目录快捷启动脚本

## 快速启动

在仓库根目录执行：

```bash
npm run dev
```

或直接进入主项目目录：

```bash
cd resume-helper
npm run dev
```

## 详细文档

完整项目文档见：

- `resume-helper/README.md`
- `render.yaml`

## 安全说明

仓库默认不提交以下内容：

- 本地环境变量文件
- API Key 等敏感配置
- `node_modules`、虚拟环境、构建产物
- 本地数据库、日志、上传文件与导出文件
