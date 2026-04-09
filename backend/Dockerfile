# ===== 开发阶段 =====
FROM golang:1.26-alpine AS dev

WORKDIR /app

# air 热重载
RUN go install github.com/air-verse/air@latest

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

EXPOSE 8080

CMD ["air", "-c", ".air.toml"]

# ===== 构建阶段 =====
FROM golang:1.26-alpine AS builder

WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /mindflow-backend ./cmd/server/

# ===== 生产阶段 =====
FROM alpine:3.19 AS prod

RUN apk --no-cache add ca-certificates
COPY --from=builder /mindflow-backend /mindflow-backend
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080

ENV MIGRATIONS_DIR=/app/migrations
CMD ["/mindflow-backend"]
