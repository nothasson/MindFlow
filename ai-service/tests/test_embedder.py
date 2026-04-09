from app.services.embedder import embed_texts


def test_embed_texts_returns_stable_dimension():
    embeddings, dimension = embed_texts(["线性代数", "线性代数"])

    assert dimension == 256
    assert len(embeddings) == 2
    assert len(embeddings[0]) == 256
    assert embeddings[0] == embeddings[1]


def test_embed_texts_normalizes_vectors():
    embeddings, _ = embed_texts(["特征值分解"])
    norm = sum(v * v for v in embeddings[0])

    assert abs(norm - 1.0) < 1e-6
