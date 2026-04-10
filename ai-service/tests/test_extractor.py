from app.services.extractor import (
    extract_knowledge_points,
    merge_and_deduplicate,
    split_by_sections,
)


def test_extract_returns_empty_when_no_llm_key(monkeypatch):
    """无 LLM_API_KEY 时应返回空列表（不做启发式 fallback）"""
    monkeypatch.delenv("LLM_API_KEY", raising=False)

    points = extract_knowledge_points(
        "向量空间是线性代数的核心概念。矩阵表示线性变换。"
    )

    assert points == []


def test_extract_returns_empty_for_empty_text():
    """空文本应返回空列表"""
    assert extract_knowledge_points("") == []
    assert extract_knowledge_points("   ") == []


def test_split_by_sections_basic():
    """测试按标题分块能正确分割"""
    text = """# 第一章 线性代数基础

这是第一章的内容，介绍线性代数的基本概念。
向量空间是线性代数的核心概念之一。

## 1.1 向量

向量是有大小和方向的量。在数学中，向量通常表示为有序数组。

## 1.2 矩阵

矩阵是一个按行和列排列的数字方阵。矩阵运算是线性代数的基础。

# 第二章 微积分

微积分研究函数的变化率和累积量。

## 2.1 导数

导数表示函数在某一点的变化率。"""

    chunks = split_by_sections(text, max_chars=200)

    # 应该被分成多个块
    assert len(chunks) >= 2
    # 每个块都不应为空
    for chunk in chunks:
        assert len(chunk.strip()) > 0


def test_split_by_sections_short_text():
    """短文本不分块，返回单个块"""
    text = "这是一段很短的文本。"
    chunks = split_by_sections(text, max_chars=4000)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_split_by_sections_empty():
    """空文本返回空列表"""
    assert split_by_sections("") == []
    assert split_by_sections("   ") == []


def test_split_by_sections_chinese_chapter():
    """测试按中文章节标题分割"""
    text = """第一章 基本概念

这是第一章内容。

第二章 进阶知识

这是第二章内容。"""

    chunks = split_by_sections(text, max_chars=50)
    assert len(chunks) >= 2


def test_merge_and_deduplicate_basic():
    """测试基本去重：同名概念合并，保留更详细的描述"""
    batch1 = [
        {
            "concept": "向量",
            "description": "有大小和方向的量",
            "importance": 0.7,
            "prerequisites": ["数组"],
            "relations": [{"target": "矩阵", "type": "prerequisite", "strength": 0.8}],
        },
        {
            "concept": "矩阵",
            "description": "数字方阵",
            "importance": 0.8,
            "prerequisites": [],
            "relations": [],
        },
    ]
    batch2 = [
        {
            "concept": "向量",
            "description": "向量是具有大小和方向的数学对象，在物理和工程中广泛应用",
            "importance": 0.9,
            "prerequisites": ["坐标系"],
            "relations": [
                {"target": "矩阵", "type": "prerequisite", "strength": 0.8},
                {"target": "标量", "type": "similar", "strength": 0.6},
            ],
        },
    ]

    result = merge_and_deduplicate([batch1, batch2])

    # 应该有 2 个概念（向量 + 矩阵），不是 3 个
    assert len(result) == 2

    # 找到合并后的"向量"
    vector = next(p for p in result if p["concept"] == "向量")

    # 保留更长的描述
    assert "物理和工程" in vector["description"]
    # 保留更高的 importance
    assert vector["importance"] == 0.9
    # prerequisites 合并去重
    assert "数组" in vector["prerequisites"]
    assert "坐标系" in vector["prerequisites"]
    # relations 合并去重
    assert len(vector["relations"]) == 2  # 矩阵 prerequisite + 标量 similar


def test_merge_and_deduplicate_empty():
    """空输入返回空列表"""
    assert merge_and_deduplicate([]) == []
    assert merge_and_deduplicate([[]]) == []
