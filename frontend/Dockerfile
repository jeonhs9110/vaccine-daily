# 1단계: 빌드 스테이지
FROM node:18-alpine AS builder
WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 복사
COPY . .

# CRA 환경변수 (빌드 타임)
ARG REACT_APP_API_URL
ARG REACT_APP_WEATHER_API_KEY
# Nginx Proxy will handle /api requests
ENV REACT_APP_API_URL=/api
ENV REACT_APP_WEATHER_API_KEY=${REACT_APP_WEATHER_API_KEY}

# 빌드
RUN npm run build

# 2단계: 실행 스테이지 (Nginx)
FROM nginx:stable-alpine

# 빌드 결과물 복사
COPY --from=builder /app/build /usr/share/nginx/html

# Nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]