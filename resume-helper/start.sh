#!/bin/bash

# Resume Helper - 统一启动脚本

set -e

echo "==================================="
echo "  Resume Helper - Starting..."
echo "==================================="

# 检查目录
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "错误: 请在 resume-helper 根目录下运行此脚本"
    exit 1
fi

# 检查 Python
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 Python，请先安装 Python 3.10+"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

# 检查后端依赖
echo ""
echo "[1/4] 检查后端依赖..."
cd backend
if [ ! -f "requirements.txt" ]; then
    echo "错误: backend/requirements.txt 不存在"
    exit 1
fi

PYTHON_CMD=$(command -v python3 || command -v python)
if ! $PYTHON_CMD -c "import fastapi" 2>/dev/null; then
    echo "正在安装后端依赖..."
    $PYTHON_CMD -m pip install -r requirements.txt
fi
cd ..

# 检查前端依赖
echo ""
echo "[2/4] 检查前端依赖..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "正在安装前端依赖..."
    npm install
fi
cd ..

# 检查 .env 配置
echo ""
echo "[3/4] 检查配置文件..."
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        echo "提示: backend/.env 不存在，已从 .env.example 复制"
        cp backend/.env.example backend/.env
        echo "请编辑 backend/.env 配置 LLM API Key（或在前端 AI 设置中配置）"
    fi
fi

# 启动服务
echo ""
echo "[4/4] 启动服务..."
echo ""
echo "后端: http://localhost:8000"
echo "前端: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 使用 trap 捕获退出信号
trap 'echo ""; echo "正在停止服务..."; kill 0' SIGINT SIGTERM

# 启动后端（从项目根目录运行）
$PYTHON_CMD -m uvicorn backend.main:app --reload --reload-dir backend --port 8000 &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# 等待进程
wait $BACKEND_PID $FRONTEND_PID
