#!/usr/bin/env bash
set -euo pipefail

docker compose up --build -d
echo "Application started at http://localhost:8000"
