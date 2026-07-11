FROM node:22-alpine AS frontend-builder
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
WORKDIR /workspace/backend

RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml ./
RUN uv sync --no-dev

COPY backend/ ./
COPY --from=frontend-builder /workspace/frontend/out ./static

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
