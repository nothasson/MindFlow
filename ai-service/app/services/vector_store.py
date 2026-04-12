import logging
import os
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

logger = logging.getLogger(__name__)

_client = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        url = os.getenv("QDRANT_URL", "http://localhost:6333")
        _client = QdrantClient(url=url)
    return _client


def ensure_collection(collection: str, dimension: int) -> None:
    """确保集合存在，并检查维度是否匹配。"""
    client = get_client()
    collections = [c.name for c in client.get_collections().collections]
    if collection not in collections:
        client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(size=dimension, distance=Distance.COSINE),
        )
    else:
        # 检查现有 collection 的维度是否与当前 embedding 维度匹配
        col_info = client.get_collection(collection_name=collection)
        existing_dim = col_info.config.params.vectors.size
        if existing_dim != dimension:
            raise ValueError(
                f"Qdrant collection '{collection}' 维度不匹配: 现有={existing_dim}, 当前={dimension}。"
                f"需要删除旧 collection 并重新导入数据: "
                f"curl -X DELETE 'http://localhost:6333/collections/{collection}'"
            )


def upsert_vectors(
    collection: str,
    texts: list[str],
    embeddings: list[list[float]],
    metadata: dict | None = None,
) -> int:
    """插入向量"""
    client = get_client()
    points = []
    for i, (text, embedding) in enumerate(zip(texts, embeddings)):
        payload = {"text": text}
        if metadata:
            payload.update(metadata)
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding,
                payload=payload,
            )
        )

    client.upsert(collection_name=collection, points=points)
    return len(points)


def search_vectors(
    collection: str,
    query_vector: list[float],
    limit: int = 5,
) -> list[dict]:
    """向量搜索"""
    client = get_client()
    results = client.query_points(
        collection_name=collection,
        query=query_vector,
        limit=limit,
    )
    return [
        {
            "text": hit.payload.get("text", ""),
            "score": hit.score,
            "metadata": {k: v for k, v in hit.payload.items() if k != "text"},
        }
        for hit in results.points
    ]
