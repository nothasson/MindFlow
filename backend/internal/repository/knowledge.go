package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nothasson/MindFlow/backend/internal/review"
)

// KnowledgeNode 知识点节点
type KnowledgeNode struct {
	ID             string    `json:"id"`
	Concept        string    `json:"concept"`
	Confidence     float64   `json:"confidence"`
	ErrorType      *string   `json:"error_type,omitempty"`
	EasinessFactor float64   `json:"easiness_factor"`
	IntervalDays   int       `json:"interval_days"`
	Repetitions    int       `json:"repetitions"`
	LastReviewed   time.Time `json:"last_reviewed"`
	NextReview     time.Time `json:"next_review"`
}

// KnowledgeEdge 知识点关系边
type KnowledgeEdge struct {
	ID           string `json:"id"`
	FromConcept  string `json:"from"`
	RelationType string `json:"relation_type"`
	ToConcept    string `json:"to"`
}

// ExtractedRelation 提取出的知识点关系。
type ExtractedRelation struct {
	Target   string
	Type     string
	Strength float64
}

// ExtractedKnowledgePoint 资料解析后提取出的知识点。
type ExtractedKnowledgePoint struct {
	Concept       string
	Description   string
	Prerequisites []string
	BloomLevel    string
	Importance    float64
	Granularity   int
	Relations     []ExtractedRelation
}

// KnowledgeRepo 知识图谱数据访问
type KnowledgeRepo struct {
	pool *pgxpool.Pool
}

// NewKnowledgeRepo 创建知识图谱仓库
func NewKnowledgeRepo(db *DB) *KnowledgeRepo {
	return &KnowledgeRepo{pool: db.Pool}
}

// ListNodes 获取所有知识点节点
func (r *KnowledgeRepo) ListNodes(ctx context.Context) ([]KnowledgeNode, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, concept, confidence, error_type, easiness_factor, interval_days, repetitions, last_reviewed, next_review
		 FROM knowledge_mastery
		 ORDER BY concept`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []KnowledgeNode
	for rows.Next() {
		var n KnowledgeNode
		if err := rows.Scan(&n.ID, &n.Concept, &n.Confidence, &n.ErrorType, &n.EasinessFactor, &n.IntervalDays, &n.Repetitions, &n.LastReviewed, &n.NextReview); err != nil {
			return nil, err
		}
		nodes = append(nodes, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return nodes, nil
}

// ListEdges 获取所有知识点关系
func (r *KnowledgeRepo) ListEdges(ctx context.Context) ([]KnowledgeEdge, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, from_concept, relation_type, to_concept
		 FROM knowledge_relations
		 WHERE valid_to IS NULL OR valid_to > NOW()
		 ORDER BY from_concept`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var edges []KnowledgeEdge
	for rows.Next() {
		var e KnowledgeEdge
		if err := rows.Scan(&e.ID, &e.FromConcept, &e.RelationType, &e.ToConcept); err != nil {
			return nil, err
		}
		edges = append(edges, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return edges, nil
}

// UpsertExtractedPoints 写入资料提取出的知识点及关系。
func (r *KnowledgeRepo) UpsertExtractedPoints(ctx context.Context, points []ExtractedKnowledgePoint) error {
	for _, point := range points {
		bloomLevel := point.BloomLevel
		if bloomLevel == "" {
			bloomLevel = "remember"
		}
		importance := point.Importance
		if importance <= 0 {
			importance = 0.5
		}
		granularity := point.Granularity
		if granularity < 1 || granularity > 4 {
			granularity = 3
		}

		// upsert 知识点，包含新字段
		if _, err := r.pool.Exec(ctx, `
			INSERT INTO knowledge_mastery (concept, description, bloom_level, importance, granularity_level, confidence, updated_at)
			VALUES ($1, $2, $3, $4, $5, 0.0, NOW())
			ON CONFLICT (concept) DO UPDATE SET
				description = CASE WHEN EXCLUDED.description != '' THEN EXCLUDED.description ELSE knowledge_mastery.description END,
				bloom_level = EXCLUDED.bloom_level,
				importance = EXCLUDED.importance,
				granularity_level = EXCLUDED.granularity_level,
				updated_at = NOW()
		`, point.Concept, point.Description, bloomLevel, importance, granularity); err != nil {
			return err
		}

		// 写入多种关系类型
		for _, rel := range point.Relations {
			if rel.Target == "" {
				continue
			}
			strength := rel.Strength
			if strength <= 0 {
				strength = 0.5
			}
			relType := rel.Type
			if relType == "" {
				relType = "prerequisite"
			}

			// 确保关系目标也存在于知识图谱
			if _, err := r.pool.Exec(ctx, `
				INSERT INTO knowledge_mastery (concept, confidence, updated_at)
				VALUES ($1, 0.0, NOW())
				ON CONFLICT (concept) DO UPDATE SET updated_at = NOW()
			`, rel.Target); err != nil {
				return err
			}

			if _, err := r.pool.Exec(ctx, `
				INSERT INTO knowledge_relations (from_concept, relation_type, to_concept, strength)
				VALUES ($1, $2, $3, $4)
				ON CONFLICT (from_concept, relation_type, to_concept)
				DO UPDATE SET strength = EXCLUDED.strength
			`, point.Concept, relType, rel.Target, strength); err != nil {
				return err
			}
		}

		// 兼容旧的 prerequisites 字段（如果 relations 中没覆盖）
		for _, prereq := range point.Prerequisites {
			if prereq == "" {
				continue
			}
			// 检查 relations 中是否已包含
			found := false
			for _, rel := range point.Relations {
				if rel.Target == prereq && rel.Type == "prerequisite" {
					found = true
					break
				}
			}
			if found {
				continue
			}

			if _, err := r.pool.Exec(ctx, `
				INSERT INTO knowledge_mastery (concept, confidence, updated_at)
				VALUES ($1, 0.0, NOW())
				ON CONFLICT (concept) DO UPDATE SET updated_at = NOW()
			`, prereq); err != nil {
				return err
			}

			if _, err := r.pool.Exec(ctx, `
				INSERT INTO knowledge_relations (from_concept, relation_type, to_concept, strength)
				VALUES ($1, 'prerequisite', $2, 0.8)
				ON CONFLICT (from_concept, relation_type, to_concept) DO NOTHING
			`, point.Concept, prereq); err != nil {
				return err
			}
		}
	}
	return nil
}

// ReviewItem 复习项
type ReviewItem struct {
	ID             string    `json:"id"`
	Concept        string    `json:"concept"`
	Confidence     float64   `json:"confidence"`
	EasinessFactor float64   `json:"easiness_factor"`
	IntervalDays   int       `json:"interval_days"`
	Repetitions    int       `json:"repetitions"`
	NextReview     time.Time `json:"next_review"`
	LastReviewed   time.Time `json:"last_reviewed"`
}

// GetDueForReview 获取今日到期的复习项
func (r *KnowledgeRepo) GetDueForReview(ctx context.Context) ([]ReviewItem, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, concept, confidence, easiness_factor, interval_days, repetitions, next_review, last_reviewed
		 FROM knowledge_mastery WHERE next_review <= NOW() ORDER BY next_review ASC LIMIT 50`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ReviewItem
	for rows.Next() {
		var item ReviewItem
		if err := rows.Scan(&item.ID, &item.Concept, &item.Confidence, &item.EasinessFactor,
			&item.IntervalDays, &item.Repetitions, &item.NextReview, &item.LastReviewed); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// GetUpcomingReview 获取未来 N 天内到期的复习项
func (r *KnowledgeRepo) GetUpcomingReview(ctx context.Context, days int) ([]ReviewItem, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, concept, confidence, easiness_factor, interval_days, repetitions, next_review, last_reviewed
		 FROM knowledge_mastery WHERE next_review > NOW() AND next_review <= NOW() + make_interval(days => $1)
		 ORDER BY next_review ASC LIMIT 50`,
		days,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ReviewItem
	for rows.Next() {
		var item ReviewItem
		if err := rows.Scan(&item.ID, &item.Concept, &item.Confidence, &item.EasinessFactor,
			&item.IntervalDays, &item.Repetitions, &item.NextReview, &item.LastReviewed); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// GetWeakPoints 获取薄弱知识点（confidence < 0.5，按 confidence 升序）
func (r *KnowledgeRepo) GetWeakPoints(ctx context.Context, limit int) ([]ReviewItem, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, concept, confidence, easiness_factor, interval_days, repetitions, next_review, last_reviewed
		 FROM knowledge_mastery WHERE confidence < 0.5 ORDER BY confidence ASC LIMIT $1`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ReviewItem
	for rows.Next() {
		var item ReviewItem
		if err := rows.Scan(&item.ID, &item.Concept, &item.Confidence, &item.EasinessFactor,
			&item.IntervalDays, &item.Repetitions, &item.NextReview, &item.LastReviewed); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// UpdateMasteryWithSM2 使用 SM-2 算法评分更新知识点掌握度
func (r *KnowledgeRepo) UpdateMasteryWithSM2(ctx context.Context, concept string, score int) error {
	var ef float64
	var intervalDays, repetitions int
	err := r.pool.QueryRow(ctx,
		`SELECT easiness_factor, interval_days, repetitions FROM knowledge_mastery WHERE concept = $1`,
		concept,
	).Scan(&ef, &intervalDays, &repetitions)
	if err != nil {
		return err
	}

	item := &review.ReviewItem{
		ConceptID:      concept,
		EasinessFactor: ef,
		Interval:       intervalDays,
		Repetitions:    repetitions,
	}
	updated := item.Review(score)

	confidenceMap := map[int]float64{5: 1.0, 4: 0.85, 3: 0.7, 2: 0.4, 1: 0.2, 0: 0.0}
	newConfidence := confidenceMap[score]

	_, err = r.pool.Exec(ctx,
		`UPDATE knowledge_mastery
		 SET confidence = $1, easiness_factor = $2, interval_days = $3, repetitions = $4,
		     next_review = $5, last_reviewed = NOW(), updated_at = NOW()
		 WHERE concept = $6`,
		newConfidence, updated.EasinessFactor, updated.Interval, updated.Repetitions,
		time.Now().AddDate(0, 0, updated.Interval), concept,
	)
	return err
}

// UpdateMasteryWithFSRS 使用 FSRS 算法评分更新知识点掌握度
func (r *KnowledgeRepo) UpdateMasteryWithFSRS(ctx context.Context, concept string, rating review.Rating) error {
	var stability, difficulty float64
	var elapsedDays, scheduledDays, reps, lapses int
	var state int16
	var lastReviewed, nextReview time.Time

	err := r.pool.QueryRow(ctx,
		`SELECT stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_reviewed, next_review
		 FROM knowledge_mastery WHERE concept = $1`,
		concept,
	).Scan(&stability, &difficulty, &elapsedDays, &scheduledDays, &reps, &lapses, &state, &lastReviewed, &nextReview)
	if err != nil {
		return err
	}

	card := review.FSRSCard{
		Stability:     stability,
		Difficulty:    difficulty,
		ElapsedDays:   elapsedDays,
		ScheduledDays: scheduledDays,
		Reps:          reps,
		Lapses:        lapses,
		State:         review.CardState(state),
		LastReview:    lastReviewed,
		NextReview:    nextReview,
	}

	scheduler := review.NewFSRSScheduler()
	updated := scheduler.Schedule(card, rating, time.Now())
	newConfidence := review.RatingToConfidence(rating)

	_, err = r.pool.Exec(ctx,
		`UPDATE knowledge_mastery
		 SET confidence = $1, stability = $2, difficulty = $3,
		     elapsed_days = $4, scheduled_days = $5, reps = $6, lapses = $7, state = $8,
		     next_review = $9, last_reviewed = NOW(), updated_at = NOW(),
		     interval_days = $10, repetitions = $6
		 WHERE concept = $11`,
		newConfidence, updated.Stability, updated.Difficulty,
		updated.ElapsedDays, updated.ScheduledDays, updated.Reps, updated.Lapses, int16(updated.State),
		updated.NextReview, updated.ScheduledDays, concept,
	)
	return err
}

// ListConceptNames 获取所有已有概念名称（轻量查询，用于去重）
func (r *KnowledgeRepo) ListConceptNames(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT concept FROM knowledge_mastery ORDER BY concept`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// DeleteByConcept 删除指定知识点（含关系）
func (r *KnowledgeRepo) DeleteByConcept(ctx context.Context, concept string) error {
	_, _ = r.pool.Exec(ctx, `DELETE FROM knowledge_relations WHERE from_concept = $1 OR to_concept = $1`, concept)
	_, err := r.pool.Exec(ctx, `DELETE FROM knowledge_mastery WHERE concept = $1`, concept)
	return err
}

// GetConceptConfidence 查询指定概念的掌握度（confidence）
func (r *KnowledgeRepo) GetConceptConfidence(ctx context.Context, concept string) (float64, error) {
	var confidence float64
	err := r.pool.QueryRow(ctx,
		`SELECT confidence FROM knowledge_mastery WHERE concept = $1`, concept,
	).Scan(&confidence)
	if err != nil {
		return 0, err
	}
	return confidence, nil
}

// GetSimilarPairs 获取所有 similar 关系对，返回 map[概念][]相似概念
func (r *KnowledgeRepo) GetSimilarPairs(ctx context.Context) (map[string][]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT from_concept, to_concept
		 FROM knowledge_relations
		 WHERE relation_type = 'similar'
		   AND (valid_to IS NULL OR valid_to > NOW())`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pairs := make(map[string][]string)
	for rows.Next() {
		var from, to string
		if err := rows.Scan(&from, &to); err != nil {
			return nil, err
		}
		pairs[from] = append(pairs[from], to)
		pairs[to] = append(pairs[to], from) // 双向关系
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return pairs, nil
}

// UpdateErrorType 更新知识点的错误类型
func (r *KnowledgeRepo) UpdateErrorType(ctx context.Context, concept string, errorType string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE knowledge_mastery SET error_type = $1, updated_at = NOW() WHERE concept = $2`,
		errorType, concept,
	)
	return err
}

// PrerequisiteChainNode 前置知识链中的节点，包含递归深度信息
type PrerequisiteChainNode struct {
	ID         string  `json:"id"`
	Concept    string  `json:"concept"`
	Confidence float64 `json:"confidence"`
	ErrorType  *string `json:"error_type,omitempty"`
	Depth      int     `json:"depth"`
}

// GetPrerequisiteChain 递归查找薄弱前置知识
// 使用 PostgreSQL 递归 CTE，只返回 confidence < 0.5 的薄弱前置节点
func (r *KnowledgeRepo) GetPrerequisiteChain(ctx context.Context, concept string, maxDepth int) ([]PrerequisiteChainNode, error) {
	query := `
		WITH RECURSIVE prereq_chain AS (
			-- 基准：找到目标概念的直接前置知识
			SELECT km.id, km.concept, km.confidence, km.error_type, 1 AS depth
			FROM knowledge_relations kr
			JOIN knowledge_mastery km ON km.concept = kr.to_concept
			WHERE kr.from_concept = $1
			  AND kr.relation_type = 'prerequisite'
			  AND (kr.valid_to IS NULL OR kr.valid_to > NOW())

			UNION

			-- 递归：沿前置关系继续向上追踪
			SELECT km.id, km.concept, km.confidence, km.error_type, pc.depth + 1
			FROM prereq_chain pc
			JOIN knowledge_relations kr ON kr.from_concept = pc.concept
			JOIN knowledge_mastery km ON km.concept = kr.to_concept
			WHERE kr.relation_type = 'prerequisite'
			  AND (kr.valid_to IS NULL OR kr.valid_to > NOW())
			  AND pc.depth < $2
		)
		SELECT DISTINCT ON (concept) id, concept, confidence, error_type, depth
		FROM prereq_chain
		WHERE confidence < 0.5
		ORDER BY concept, depth ASC
	`

	rows, err := r.pool.Query(ctx, query, concept, maxDepth)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []PrerequisiteChainNode
	for rows.Next() {
		var n PrerequisiteChainNode
		if err := rows.Scan(&n.ID, &n.Concept, &n.Confidence, &n.ErrorType, &n.Depth); err != nil {
			return nil, err
		}
		nodes = append(nodes, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return nodes, nil
}
