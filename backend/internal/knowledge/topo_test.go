package knowledge

import (
	"reflect"
	"testing"
)

// TestLinearDependency 测试线性依赖：A→B→C（A 依赖 B，B 依赖 C）
// 学习顺序应为 C → B → A
func TestLinearDependency(t *testing.T) {
	nodes := []Node{
		{Concept: "A", Confidence: 0.0},
		{Concept: "B", Confidence: 0.0},
		{Concept: "C", Confidence: 0.0},
	}
	// A 依赖 B，B 依赖 C
	edges := []Edge{
		{From: "A", To: "B"},
		{From: "B", To: "C"},
	}
	mastered := map[string]bool{}

	path := GenerateLearningPath(nodes, edges, mastered)

	expected := []string{"C", "B", "A"}
	if !reflect.DeepEqual(path, expected) {
		t.Errorf("线性依赖路径错误: 期望 %v, 得到 %v", expected, path)
	}
}

// TestForkDependency 测试分叉依赖：A→C, B→C（A 和 B 都依赖 C）
// C 应最先学习，然后 A 和 B（按字母序）
func TestForkDependency(t *testing.T) {
	nodes := []Node{
		{Concept: "A", Confidence: 0.0},
		{Concept: "B", Confidence: 0.0},
		{Concept: "C", Confidence: 0.0},
	}
	// A 依赖 C，B 依赖 C
	edges := []Edge{
		{From: "A", To: "C"},
		{From: "B", To: "C"},
	}
	mastered := map[string]bool{}

	path := GenerateLearningPath(nodes, edges, mastered)

	// C 必须在 A 和 B 之前
	if len(path) != 3 {
		t.Fatalf("路径长度错误: 期望 3, 得到 %d", len(path))
	}
	if path[0] != "C" {
		t.Errorf("C 应最先学习，实际第一个是 %s", path[0])
	}
	// A 和 B 的相对顺序按字母序
	expected := []string{"C", "A", "B"}
	if !reflect.DeepEqual(path, expected) {
		t.Errorf("分叉依赖路径错误: 期望 %v, 得到 %v", expected, path)
	}
}

// TestSkipMastered 测试部分已掌握节点应被跳过
// A→B→C，B 已掌握，路径应为 C → A（跳过 B）
func TestSkipMastered(t *testing.T) {
	nodes := []Node{
		{Concept: "A", Confidence: 0.0},
		{Concept: "B", Confidence: 0.9}, // 已掌握
		{Concept: "C", Confidence: 0.0},
	}
	edges := []Edge{
		{From: "A", To: "B"},
		{From: "B", To: "C"},
	}
	mastered := map[string]bool{"B": true}

	path := GenerateLearningPath(nodes, edges, mastered)

	expected := []string{"C", "A"}
	if !reflect.DeepEqual(path, expected) {
		t.Errorf("跳过已掌握节点路径错误: 期望 %v, 得到 %v", expected, path)
	}
}

// TestEmptyGraph 测试空图返回空路径
func TestEmptyGraph(t *testing.T) {
	path := GenerateLearningPath(nil, nil, nil)
	if len(path) != 0 {
		t.Errorf("空图应返回空路径，得到 %v", path)
	}
}

// TestNoEdges 测试无边的图，所有节点按字母序返回
func TestNoEdges(t *testing.T) {
	nodes := []Node{
		{Concept: "B", Confidence: 0.0},
		{Concept: "A", Confidence: 0.0},
		{Concept: "C", Confidence: 0.0},
	}

	path := GenerateLearningPath(nodes, nil, map[string]bool{})

	expected := []string{"A", "B", "C"}
	if !reflect.DeepEqual(path, expected) {
		t.Errorf("无边图路径错误: 期望 %v, 得到 %v", expected, path)
	}
}
