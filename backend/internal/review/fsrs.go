package review

import (
	"time"

	gofsrs "github.com/open-spaced-repetition/go-fsrs/v3"
)

// Rating FSRS 评分等级（前端四按钮映射）
type Rating = gofsrs.Rating

const (
	Again Rating = gofsrs.Again // 1 - 完全忘记
	Hard  Rating = gofsrs.Hard  // 2 - 困难回忆
	Good  Rating = gofsrs.Good  // 3 - 正常回忆
	Easy  Rating = gofsrs.Easy  // 4 - 轻松回忆
)

// CardState FSRS 卡片状态
type CardState = gofsrs.State

const (
	StateNew        CardState = gofsrs.New
	StateLearning   CardState = gofsrs.Learning
	StateReview     CardState = gofsrs.Review
	StateRelearning CardState = gofsrs.Relearning
)

// FSRSCard 封装 FSRS 卡片信息（对应数据库字段）
type FSRSCard struct {
	Stability    float64
	Difficulty   float64
	ElapsedDays  int
	ScheduledDays int
	Reps         int
	Lapses       int
	State        CardState
	LastReview   time.Time
	NextReview   time.Time
}

// FSRSScheduler 封装 FSRS 调度逻辑
type FSRSScheduler struct {
	params gofsrs.Parameters
}

// NewFSRSScheduler 创建 FSRS 调度器（使用默认参数，后续可训练优化）
func NewFSRSScheduler() *FSRSScheduler {
	p := gofsrs.DefaultParam()
	return &FSRSScheduler{params: p}
}

// Schedule 根据当前卡片状态和评分，计算下次复习信息
func (s *FSRSScheduler) Schedule(card FSRSCard, rating Rating, now time.Time) FSRSCard {
	// 转换为 go-fsrs 的 Card 结构
	fsrsCard := gofsrs.Card{
		Due:           card.NextReview,
		Stability:     card.Stability,
		Difficulty:    card.Difficulty,
		ElapsedDays:   uint64(card.ElapsedDays),
		ScheduledDays: uint64(card.ScheduledDays),
		Reps:          uint64(card.Reps),
		Lapses:        uint64(card.Lapses),
		State:         card.State,
		LastReview:     card.LastReview,
	}

	// 新卡片特殊处理
	if card.State == StateNew && card.Stability == 0 {
		fsrsCard.Due = now
	}

	scheduler := gofsrs.NewFSRS(s.params)
	result := scheduler.Repeat(fsrsCard, now)
	scheduled := result[rating]

	return FSRSCard{
		Stability:    scheduled.Card.Stability,
		Difficulty:   scheduled.Card.Difficulty,
		ElapsedDays:  int(scheduled.Card.ElapsedDays),
		ScheduledDays: int(scheduled.Card.ScheduledDays),
		Reps:         int(scheduled.Card.Reps),
		Lapses:       int(scheduled.Card.Lapses),
		State:        scheduled.Card.State,
		LastReview:   now,
		NextReview:   scheduled.Card.Due,
	}
}

// RatingToConfidence FSRS 评分映射到置信度（用于 knowledge_mastery.confidence）
func RatingToConfidence(rating Rating) float64 {
	switch rating {
	case Easy:
		return 1.0
	case Good:
		return 0.85
	case Hard:
		return 0.55
	case Again:
		return 0.2
	default:
		return 0.5
	}
}

// ScoreToRating 将旧的 0-5 分制映射到 FSRS 四级评分（兼容过渡）
func ScoreToRating(score int) Rating {
	switch {
	case score >= 5:
		return Easy
	case score >= 3:
		return Good
	case score >= 2:
		return Hard
	default:
		return Again
	}
}
