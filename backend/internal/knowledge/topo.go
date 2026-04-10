package knowledge

// Node 知识图谱节点（拓扑排序用）
type Node struct {
	Concept    string
	Confidence float64
}

// Edge 知识图谱边（prerequisite 关系：From 依赖 To）
type Edge struct {
	From string // 当前概念
	To   string // 前置概念
}

// GenerateLearningPath 基于知识图谱拓扑排序生成学习路径
// 1. 构建邻接表（prerequisite 关系：From 依赖 To，即 To → From 方向学习）
// 2. Kahn 拓扑排序
// 3. 过滤已掌握节点（confidence > 0.8）
// 4. 返回按依赖顺序排列的学习路径（先学前置，再学后续）
func GenerateLearningPath(nodes []Node, edges []Edge, mastered map[string]bool) []string {
	// 收集所有概念
	conceptSet := make(map[string]bool)
	for _, n := range nodes {
		conceptSet[n.Concept] = true
	}

	// 构建邻接表和入度表
	// 学习方向：前置 → 后续，即 edge.To → edge.From
	inDegree := make(map[string]int)
	adjacency := make(map[string][]string) // from -> [to]: 前置 -> 后续

	for concept := range conceptSet {
		inDegree[concept] = 0
	}

	for _, e := range edges {
		if !conceptSet[e.From] || !conceptSet[e.To] {
			continue
		}
		// To 是前置，From 依赖 To，学习方向 To → From
		adjacency[e.To] = append(adjacency[e.To], e.From)
		inDegree[e.From]++
	}

	// Kahn 拓扑排序
	var queue []string
	for concept := range conceptSet {
		if inDegree[concept] == 0 {
			queue = append(queue, concept)
		}
	}

	// 为了确定性输出，对初始队列排序
	sortStrings(queue)

	var sorted []string
	for len(queue) > 0 {
		// 取出队首
		current := queue[0]
		queue = queue[1:]
		sorted = append(sorted, current)

		// 处理后继节点
		neighbors := adjacency[current]
		sortStrings(neighbors)
		for _, next := range neighbors {
			inDegree[next]--
			if inDegree[next] == 0 {
				queue = insertSorted(queue, next)
			}
		}
	}

	// 过滤已掌握节点
	var path []string
	for _, concept := range sorted {
		if !mastered[concept] {
			path = append(path, concept)
		}
	}

	return path
}

// sortStrings 简单插入排序（避免引入 sort 包，数据量小）
func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		key := s[i]
		j := i - 1
		for j >= 0 && s[j] > key {
			s[j+1] = s[j]
			j--
		}
		s[j+1] = key
	}
}

// insertSorted 将字符串插入到已排序切片的正确位置
func insertSorted(sorted []string, val string) []string {
	i := 0
	for i < len(sorted) && sorted[i] < val {
		i++
	}
	sorted = append(sorted, "")
	copy(sorted[i+1:], sorted[i:])
	sorted[i] = val
	return sorted
}
