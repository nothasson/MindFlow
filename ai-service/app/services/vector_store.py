import os
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

_client = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        url = os.getenv("QDRANT_URL", "http://localhost:6333")
        _client = QdrantClient(url=url)
    return _client


def ensure_collection(collection: str, dimension: int) -> None:
    """确保集合存在"""
    client = get_client()
    collections = [c.name for c in client.get_collections().collections]
    if collection not in collections:
        client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(size=dimension, distance=Distance.COSINE),
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
