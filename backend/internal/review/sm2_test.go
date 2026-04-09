package review

import (
	"testing"
)

func TestSM2_PerfectRecall(t *testing.T) {
	item := NewReviewItem("concept_1")
	item = item.Review(5) // 完美回忆
	if item.Interval != 1 {
		t.Errorf("第一次完美回忆间隔应为 1 天，实际 %d", item.Interval)
	}

	item = item.Review(5)
	if item.Interval != 6 {
		t.Errorf("第二次完美回忆间隔应为 6 天，实际 %d", item.Interval)
	}

	item = item.Review(5)
	if item.Interval <= 6 {
		t.Errorf("第三次完美回忆间隔应 >6 天，实际 %d", item.Interval)
	}
}

func TestSM2_ForgottenReset(t *testing.T) {
	item := NewReviewItem("concept_1")
	item.Interval = 30
	item.Repetitions = 5
	item = item.Review(1) // 错误且偏差大

	if item.Interval != 1 {
		t.Errorf("忘记后间隔应重置为 1 天，实际 %d", item.Interval)
	}
	if item.Repetitions != 0 {
		t.Errorf("忘记后连续正确次数应重置为 0，实际 %d", item.Repetitions)
	}
}

func TestSM2_EasinessFactorFloor(t *testing.T) {
	item := NewReviewItem("concept_1")
	// 连续多次错误
	for i := 0; i < 20; i++ {
		item = item.Review(0)
	}
	if item.EasinessFactor < 1.3 {
		t.Errorf("难度因子不应低于 1.3，实际 %.2f", item.EasinessFactor)
	}
}

func TestSM2_HesitantButCorrect(t *testing.T) {
	item := NewReviewItem("concept_1")
	item = item.Review(5) // 间隔 1
	item = item.Review(5) // 间隔 6
	item = item.Review(4) // 犹豫但正确，间隔应略短

	if item.Interval >= 15 {
		t.Errorf("犹豫回答间隔应短于完美回答，实际 %d", item.Interval)
	}
}

func TestSM2_DifficultButCorrect(t *testing.T) {
	item := NewReviewItem("concept_1")
	item = item.Review(5) // 间隔 1
	item = item.Review(5) // 间隔 6
	item = item.Review(3) // 困难但正确

	if item.Interval >= 15 {
		t.Errorf("困难回答间隔应更短，实际 %d", item.Interval)
	}
}

func TestSM2_IsDue(t *testing.T) {
	item := NewReviewItem("concept_1")
	// 新建的 item 应立即到期
	if !item.IsDue() {
		t.Error("新建 item 应该已到期")
	}
}

func TestSM2_ScoreBounds(t *testing.T) {
	item := NewReviewItem("concept_1")

	// 负分应被限制为 0
	item = item.Review(-1)
	if item.LastScore != 0 {
		t.Errorf("负分应被限制为 0，实际 %d", item.LastScore)
	}

	// 超过 5 应被限制为 5
	item = item.Review(10)
	if item.LastScore != 5 {
		t.Errorf("超过 5 应被限制为 5，实际 %d", item.LastScore)
	}
}
