package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
	"unicode/utf8"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/hertz-contrib/sse"
)

// EchoRequest 回声测试请求
type EchoRequest struct {
	Content string `json:"content"`
	// 每个字符的延迟（毫秒），默认 50ms
	DelayMs int `json:"delay_ms,omitempty"`
}

// HandleEcho POST /api/echo — 开发测试用，逐字 SSE 流式返回用户发送的内容
// 用于测试前端 Markdown/Mermaid 渲染和打字机效果
func HandleEcho(ctx context.Context, c *app.RequestContext) {
	var req EchoRequest
	if err := c.BindAndValidate(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误: " + err.Error()})
		return
	}

	if req.Content == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "content 不能为空"})
		return
	}

	delay := 50
	if req.DelayMs > 0 {
		delay = req.DelayMs
	}

	stream := sse.NewStream(c)

	go func() {
		// 逐字（按 rune）发送，模拟真实 LLM 流式输出
		for i := 0; i < len(req.Content); {
			r, size := utf8.DecodeRuneInString(req.Content[i:])
			if r == utf8.RuneError && size <= 1 {
				i++
				continue
			}

			chunk := string(r)
			data, _ := json.Marshal(SSEData{Content: chunk})
			stream.Publish(&sse.Event{Data: data})

			i += size
			time.Sleep(time.Duration(delay) * time.Millisecond)
		}

		// 发送完成事件
		data, _ := json.Marshal(SSEData{Done: true})
		stream.Publish(&sse.Event{Data: data})
	}()

	<-ctx.Done()
}
