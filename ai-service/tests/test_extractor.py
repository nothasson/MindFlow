from app.services.extractor import extract_knowledge_points


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
