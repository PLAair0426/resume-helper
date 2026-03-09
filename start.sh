#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/resume-helper"
PROJECT_START="$PROJECT_DIR/start.sh"

echo "=== Resume Helper ==="
echo

if [ ! -f "$PROJECT_START" ]; then
  echo "[ERROR] Missing project start script: $PROJECT_START"
  exit 1
fi

echo "Delegating to $PROJECT_START"
cd "$PROJECT_DIR"
exec bash "$PROJECT_START"