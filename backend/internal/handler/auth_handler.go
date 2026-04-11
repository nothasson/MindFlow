package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// AuthHandler 认证处理器
type AuthHandler struct {
	userRepo  *repository.UserRepo
	jwtSecret string
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(userRepo *repository.UserRepo, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
	}
}

// registerRequest 注册请求
type registerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

// loginRequest 登录请求
type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// authResponse 认证响应
type authResponse struct {
	Token string    `json:"token"`
	User  userInfo  `json:"user"`
}

// userInfo 用户信息（不含敏感字段）
type userInfo struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
}

// Register 用户注册
func (h *AuthHandler) Register(ctx context.Context, c *app.RequestContext) {
	var req registerRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误"})
		return
	}

	// 校验必填字段
	req.Email = strings.TrimSpace(req.Email)
	req.Password = strings.TrimSpace(req.Password)
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if req.Email == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "邮箱和密码不能为空"})
		return
	}
	if len(req.Password) < 6 {
		c.JSON(http.StatusBadRequest, utils.H{"error": "密码长度不能少于 6 位"})
		return
	}

	// 检查邮箱是否已注册
	existing, err := h.userRepo.GetUserByEmail(ctx, req.Email)
	if err == nil && existing != nil {
		c.JSON(http.StatusConflict, utils.H{"error": "该邮箱已注册"})
		return
	}

	// bcrypt 加密密码
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("密码加密失败: %v", err)
		c.JSON(http.StatusInternalServerError, utils.H{"error": "服务器内部错误"})
		return
	}

	// 创建用户
	user, err := h.userRepo.CreateUser(ctx, req.Email, string(hash), req.DisplayName)
	if err != nil {
		log.Printf("创建用户失败: %v", err)
		c.JSON(http.StatusInternalServerError, utils.H{"error": "创建用户失败"})
		return
	}

	// 生成 JWT
	token, err := h.generateToken(user.ID)
	if err != nil {
		log.Printf("生成 token 失败: %v", err)
		c.JSON(http.StatusInternalServerError, utils.H{"error": "服务器内部错误"})
		return
	}

	c.JSON(http.StatusOK, authResponse{
		Token: token,
		User: userInfo{
			ID:          user.ID,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			CreatedAt:   user.CreatedAt,
		},
	})
}

// Login 用户登录
func (h *AuthHandler) Login(ctx context.Context, c *app.RequestContext) {
	var req loginRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误"})
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "邮箱和密码不能为空"})
		return
	}

	// 查找用户
	user, err := h.userRepo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusUnauthorized, utils.H{"error": "邮箱或密码错误"})
			return
		}
		log.Printf("查询用户失败: %v", err)
		c.JSON(http.StatusInternalServerError, utils.H{"error": "服务器内部错误"})
		return
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, utils.H{"error": "邮箱或密码错误"})
		return
	}

	// 生成 JWT
	token, err := h.generateToken(user.ID)
	if err != nil {
		log.Printf("生成 token 失败: %v", err)
		c.JSON(http.StatusInternalServerError, utils.H{"error": "服务器内部错误"})
		return
	}

	c.JSON(http.StatusOK, authResponse{
		Token: token,
		User: userInfo{
			ID:          user.ID,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			CreatedAt:   user.CreatedAt,
		},
	})
}

// Me 获取当前用户信息
func (h *AuthHandler) Me(ctx context.Context, c *app.RequestContext) {
	// 从 context 中获取 user_id（由 JWTAuth 中间件写入）
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.H{"error": "未认证"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusUnauthorized, utils.H{"error": "无效的用户标识"})
		return
	}

	user, err := h.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, utils.H{"error": "用户不存在"})
			return
		}
		log.Printf("查询用户失败: %v", err)
		c.JSON(http.StatusInternalServerError, utils.H{"error": "服务器内部错误"})
		return
	}

	c.JSON(http.StatusOK, utils.H{
		"user": userInfo{
			ID:          user.ID,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			CreatedAt:   user.CreatedAt,
		},
	})
}

// generateToken 生成 JWT token
func (h *AuthHandler) generateToken(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"exp":     time.Now().Add(7 * 24 * time.Hour).Unix(), // 7 天有效期
		"iat":     time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
}

// GetJWTSecret 从环境变量获取 JWT 密钥
func GetJWTSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "mindflow-dev-secret"
	}
	return secret
}

// JWTAuth JWT 认证中间件
func JWTAuth(secret string) app.HandlerFunc {
	return func(ctx context.Context, c *app.RequestContext) {
		// 从 Authorization: Bearer <token> 提取 token
		authHeader := string(c.GetHeader("Authorization"))
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, utils.H{"error": "缺少认证信息"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.JSON(http.StatusUnauthorized, utils.H{"error": "认证格式错误"})
			c.Abort()
			return
		}

		tokenStr := parts[1]

		// 解析验证 JWT
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("不支持的签名方法: %v", t.Header["alg"])
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, utils.H{"error": "认证已过期或无效"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, utils.H{"error": "无效的认证信息"})
			c.Abort()
			return
		}

		userID, ok := claims["user_id"].(string)
		if !ok || userID == "" {
			c.JSON(http.StatusUnauthorized, utils.H{"error": "无效的用户标识"})
			c.Abort()
			return
		}

		// 将 user_id 写入 context
		c.Set("user_id", userID)
		c.Next(ctx)
	}
}
