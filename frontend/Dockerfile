# ===== 开发阶段 =====
FROM node:20-alpine AS dev

WORKDIR /app

# 腾讯云镜像加速
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ===== 构建阶段 =====
FROM node:20-alpine AS builder

WORKDIR /app

# 腾讯云镜像加速
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

COPY package.json package-lock.json* ./
RUN npm install
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

RUN npm run build

# ===== 生产阶段 =====
FROM node:20-alpine AS prod

WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
