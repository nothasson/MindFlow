package review

import (
	"math"
	"time"
)

// ReviewItem 复习项（SM-2 算法）
type ReviewItem struct {
	ConceptID      string    `json:"concept_id"`
	EasinessFactor float64   `json:"easiness_factor"`
	Interval       int       `json:"interval"`
	Repetitions    int       `json:"repetitions"`
	NextReview     time.Time `json:"next_review"`
	LastReview     time.Time `json:"last_review"`
	LastScore      int       `json:"last_score"`
}

// NewReviewItem 创建新复习项
func NewReviewItem(conceptID string) *ReviewItem {
	return &ReviewItem{
		ConceptID:      conceptID,
		EasinessFactor: 2.5,
		Interval:       0,
		Repetitions:    0,
		NextReview:     time.Now(),
		LastReview:     time.Now(),
		LastScore:      0,
	}
}

// Review 执行一次复习评分（0-5 分）
// 返回更新后的 ReviewItem
func (r *ReviewItem) Review(score int) *ReviewItem {
	if score < 0 {
		score = 0
	}
	if score > 5 {
		score = 5
	}

	result := *r
	result.LastScore = score
	result.LastReview = time.Now()

	if score >= 3 {
		// 正确回答
		result.Repetitions++

		switch result.Repetitions {
		case 1:
			result.Interval = 1
		case 2:
			result.Interval = 6
		default:
			result.Interval = int(math.Round(float64(result.Interval) * result.EasinessFactor))
		}

		// 根据评分调整难度因子
		switch score {
		case 5:
			// 完美，不调整
		case 4:
			result.Interval = int(math.Round(float64(result.Interval) * 0.9))
		case 3:
			result.Interval = int(math.Round(float64(result.Interval) * 0.8))
		}
	} else {
		// 错误回答：重置
		result.Repetitions = 0
		result.Interval = 1

		// 降低难度因子
		result.EasinessFactor = result.EasinessFactor - 0.2
		if score <= 1 {
			result.EasinessFactor = result.EasinessFactor - 0.1
		}
	}

	// 难度因子下限
	if result.EasinessFactor < 1.3 {
		result.EasinessFactor = 1.3
	}

	// 间隔上限 365 天
	if result.Interval > 365 {
		result.Interval = 365
	}

	result.NextReview = result.LastReview.AddDate(0, 0, result.Interval)

	return &result
}

// IsDue 是否到了复习时间
func (r *ReviewItem) IsDue() bool {
	return time.Now().After(r.NextReview) || time.Now().Equal(r.NextReview)
}
