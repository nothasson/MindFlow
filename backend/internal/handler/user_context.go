package handler

import (
	"github.com/cloudwego/hertz/pkg/app"
	"github.com/google/uuid"
)

// getUserIDFromCtx 从请求上下文中获取当前用户 ID（由 JWT 中间件注入）。
// 如果用户未登录或中间件未注入，返回 nil（兼容无登录状态）。
func getUserIDFromCtx(c *app.RequestContext) *uuid.UUID {
	// JWT 中间件会将 user_id 存入 context
	val, exists := c.Get("user_id")
	if !exists {
		return nil
	}

	switch v := val.(type) {
	case uuid.UUID:
		return &v
	case *uuid.UUID:
		return v
	case string:
		id, err := uuid.Parse(v)
		if err != nil {
			return nil
		}
		return &id
	default:
		return nil
	}
}
