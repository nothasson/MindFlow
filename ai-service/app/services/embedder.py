import os

from sentence_transformers import SentenceTransformer

_model = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        model_name = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5")
        _model = SentenceTransformer(model_name)
    return _model


def embed_texts(texts: list[str]) -> tuple[list[list[float]], int]:
    """生成文本嵌入向量"""
    model = get_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    dimension = embeddings.shape[1]
    return embeddings.tolist(), int(dimension)
