#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"
APP_DIR="$(cd "$BACKEND_DIR/.." && pwd)"
FRONTEND_DIR="$APP_DIR/frontend"

cd "$BACKEND_DIR"

echo "=== Resume Helper ==="
echo

if [ ! -f "$BACKEND_DIR/main.py" ]; then
  echo "[ERROR] Missing backend app: $BACKEND_DIR/main.py"
  exit 1
fi

if [ ! -f "$FRONTEND_DIR/package.json" ]; then
  echo "[ERROR] Missing frontend app: $FRONTEND_DIR/package.json"
  exit 1
fi

PYTHON_CMD="$(command -v python3 || command -v python || true)"
if [ -z "$PYTHON_CMD" ]; then
  echo "[ERROR] Python not found in PATH"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js not found in PATH"
  exit 1
fi

echo "[1/4] Checking backend dependencies..."
if ! "$PYTHON_CMD" -c "import fastapi" >/dev/null 2>&1; then
  echo "Installing backend dependencies..."
  "$PYTHON_CMD" -m pip install -r "$BACKEND_DIR/requirements.txt"
fi

echo
echo "[2/4] Checking frontend dependencies..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm --prefix "$FRONTEND_DIR" install
fi

echo
echo "[3/4] Checking backend environment file..."
if [ ! -f "$BACKEND_DIR/.env" ] && [ -f "$BACKEND_DIR/.env.example" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "Created backend/.env from backend/.env.example"
fi

echo
echo "[4/4] Starting services..."
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo
echo "Press Ctrl+C to stop both services."
echo

trap 'echo; echo "Stopping services..."; kill 0' INT TERM

"$PYTHON_CMD" -m uvicorn backend.main:app --app-dir .. --reload --reload-dir . --port 8000 &
BACKEND_PID=$!

sleep 3

npm --prefix "$FRONTEND_DIR" run dev &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
