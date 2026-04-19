# 1단계: 빌드 스테이지
FROM python:3.11-slim AS builder
WORKDIR /app

# 빌드 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir Cython && \
    pip install --no-cache-dir -r requirements.txt

# 2단계: 실행 스테이지
FROM python:3.11-slim
WORKDIR /app

# 빌드 결과만 복사
COPY --from=builder /usr/local /usr/local

# 앱 코드 복사
COPY . .

# FastAPI 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]