package review

import (
	"testing"
	"time"
)

func TestFSRSScheduler_NewCard(t *testing.T) {
	scheduler := NewFSRSScheduler()
	now := time.Now()

	card := FSRSCard{State: StateNew}
	result := scheduler.Schedule(card, Good, now)

	if result.State == StateNew {
		t.Error("Good 评分后卡片不应仍为 New 状态")
	}
	if result.Stability <= 0 {
		t.Error("稳定性应大于 0")
	}
	if !result.NextReview.After(now) {
		t.Error("下次复习时间应在当前之后")
	}
}

func TestFSRSScheduler_AgainResetsProgress(t *testing.T) {
	scheduler := NewFSRSScheduler()
	now := time.Now()

	// 先学习几轮
	card := FSRSCard{State: StateNew}
	card = scheduler.Schedule(card, Good, now)
	card = scheduler.Schedule(card, Good, now.Add(24*time.Hour))

	stabilityBefore := card.Stability

	// 按 Again
	card = scheduler.Schedule(card, Again, now.Add(48*time.Hour))

	if card.Stability >= stabilityBefore {
		t.Error("Again 后稳定性应降低")
	}
}

func TestFSRSScheduler_EasyIncreasesInterval(t *testing.T) {
	scheduler := NewFSRSScheduler()
	now := time.Now()

	card := FSRSCard{State: StateNew}
	goodResult := scheduler.Schedule(card, Good, now)
	easyResult := scheduler.Schedule(card, Easy, now)

	if !easyResult.NextReview.After(goodResult.NextReview) {
		t.Error("Easy 评分的下次复习时间应比 Good 更远")
	}
}

func TestRatingToConfidence(t *testing.T) {
	tests := []struct {
		rating   Rating
		expected float64
	}{
		{Easy, 1.0},
		{Good, 0.85},
		{Hard, 0.55},
		{Again, 0.2},
	}
	for _, tt := range tests {
		if got := RatingToConfidence(tt.rating); got != tt.expected {
			t.Errorf("RatingToConfidence(%d) = %f, want %f", tt.rating, got, tt.expected)
		}
	}
}

func TestScoreToRating(t *testing.T) {
	tests := []struct {
		score    int
		expected Rating
	}{
		{5, Easy},
		{4, Good},
		{3, Good},
		{2, Hard},
		{1, Again},
		{0, Again},
	}
	for _, tt := range tests {
		if got := ScoreToRating(tt.score); got != tt.expected {
			t.Errorf("ScoreToRating(%d) = %d, want %d", tt.score, got, tt.expected)
		}
	}
}
