package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nothasson/MindFlow/backend/internal/model"
)

// CourseRepo 课程数据访问
type CourseRepo struct {
	pool *pgxpool.Pool
}

// NewCourseRepo 创建课程仓库
func NewCourseRepo(db *DB) *CourseRepo {
	return &CourseRepo{pool: db.Pool}
}

// Create 创建课程
// userID 可为 nil，表示无登录状态
func (r *CourseRepo) Create(ctx context.Context, resourceID *uuid.UUID, title, summary, difficulty, style string, userID ...*uuid.UUID) (*model.Course, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	var course model.Course
	err := r.pool.QueryRow(ctx,
		`INSERT INTO courses (resource_id, title, summary, difficulty_level, style, user_id)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, resource_id, title, summary, difficulty_level, style, section_count, created_at, updated_at`,
		resourceID, title, summary, difficulty, style, uid,
	).Scan(&course.ID, &course.ResourceID, &course.Title, &course.Summary,
		&course.DifficultyLevel, &course.Style, &course.SectionCount,
		&course.CreatedAt, &course.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &course, nil
}

// GetByID 获取课程（userID 非 nil 时校验归属）
func (r *CourseRepo) GetByID(ctx context.Context, id uuid.UUID, userID ...*uuid.UUID) (*model.Course, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	var course model.Course
	var err error
	if uid != nil {
		err = r.pool.QueryRow(ctx,
			`SELECT id, resource_id, title, summary, difficulty_level, style, section_count, created_at, updated_at
			 FROM courses WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
			id, *uid,
		).Scan(&course.ID, &course.ResourceID, &course.Title, &course.Summary,
			&course.DifficultyLevel, &course.Style, &course.SectionCount,
			&course.CreatedAt, &course.UpdatedAt)
	} else {
		err = r.pool.QueryRow(ctx,
			`SELECT id, resource_id, title, summary, difficulty_level, style, section_count, created_at, updated_at
			 FROM courses WHERE id = $1`,
			id,
		).Scan(&course.ID, &course.ResourceID, &course.Title, &course.Summary,
			&course.DifficultyLevel, &course.Style, &course.SectionCount,
			&course.CreatedAt, &course.UpdatedAt)
	}
	if err != nil {
		return nil, err
	}
	return &course, nil
}

// List 获取课程列表（userID 非 nil 时按用户过滤）
// userID 可为 nil，表示不按用户过滤
func (r *CourseRepo) List(ctx context.Context, userID ...*uuid.UUID) ([]model.Course, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	query := `SELECT id, resource_id, title, summary, difficulty_level, style, section_count, created_at, updated_at
		 FROM courses`
	var args []interface{}
	if uid != nil {
		query += ` WHERE (user_id = $1 OR user_id IS NULL)`
		args = append(args, *uid)
	}
	query += ` ORDER BY updated_at DESC LIMIT 50`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courses []model.Course
	for rows.Next() {
		var c model.Course
		if err := rows.Scan(&c.ID, &c.ResourceID, &c.Title, &c.Summary,
			&c.DifficultyLevel, &c.Style, &c.SectionCount,
			&c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		courses = append(courses, c)
	}
	return courses, nil
}

// UpdateSectionCount 更新章节数
func (r *CourseRepo) UpdateSectionCount(ctx context.Context, courseID uuid.UUID, count int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE courses SET section_count = $1, updated_at = NOW() WHERE id = $2`,
		count, courseID,
	)
	return err
}

// Delete 删除课程（userID 非 nil 时校验归属）
func (r *CourseRepo) Delete(ctx context.Context, id uuid.UUID, userID ...*uuid.UUID) error {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}
	if uid != nil {
		_, err := r.pool.Exec(ctx, `DELETE FROM courses WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`, id, *uid)
		return err
	}
	_, err := r.pool.Exec(ctx, `DELETE FROM courses WHERE id = $1`, id)
	return err
}

// Count 获取课程总数（userID 非 nil 时按用户过滤）
func (r *CourseRepo) Count(ctx context.Context, userID ...*uuid.UUID) (int, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	var count int
	var err error
	if uid != nil {
		err = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM courses WHERE (user_id = $1 OR user_id IS NULL)`, *uid).Scan(&count)
	} else {
		err = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM courses`).Scan(&count)
	}
	return count, err
}

// CreateSection 创建章节（userID 可为 nil）
func (r *CourseRepo) CreateSection(ctx context.Context, courseID uuid.UUID, title, summary, content string, orderIndex int, objectives, questions string, userID ...*uuid.UUID) (*model.CourseSection, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	var section model.CourseSection
	err := r.pool.QueryRow(ctx,
		`INSERT INTO course_sections (course_id, title, summary, content, order_index, learning_objectives, question_prompts, user_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, course_id, title, summary, content, order_index, learning_objectives, question_prompts, created_at`,
		courseID, title, summary, content, orderIndex, objectives, questions, uid,
	).Scan(&section.ID, &section.CourseID, &section.Title, &section.Summary,
		&section.Content, &section.OrderIndex, &section.LearningObjectives,
		&section.QuestionPrompts, &section.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &section, nil
}

// GetSections 获取课程的所有章节
func (r *CourseRepo) GetSections(ctx context.Context, courseID uuid.UUID) ([]model.CourseSection, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, course_id, title, summary, content, order_index, learning_objectives, question_prompts, created_at
		 FROM course_sections WHERE course_id = $1 ORDER BY order_index ASC`,
		courseID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sections []model.CourseSection
	for rows.Next() {
		var s model.CourseSection
		if err := rows.Scan(&s.ID, &s.CourseID, &s.Title, &s.Summary,
			&s.Content, &s.OrderIndex, &s.LearningObjectives,
			&s.QuestionPrompts, &s.CreatedAt); err != nil {
			return nil, err
		}
		sections = append(sections, s)
	}
	return sections, nil
}
