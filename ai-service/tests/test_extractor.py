from app.services.extractor import extract_knowledge_points


def test_extract_knowledge_points_uses_fallback_when_no_llm(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)

    points = extract_knowledge_points(
        "向量空间是线性代数的核心概念。矩阵表示线性变换。特征值描述变换的重要性质。"
    )

    assert len(points) >= 1
    assert all(point["concept"] for point in points)
    assert all("description" in point for point in points)
