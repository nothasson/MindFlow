"""知识点向量存储服务 — 独立 collection 'knowledge_embeddings'"""

import asyncio
import uuid

from qdrant_client.models import PointStruct

from app.services.embedder import embed_texts
from app.services.vector_store import ensure_collection, get_client

COLLECTION = "knowledge_embeddings"


class KnowledgeVectorStore:
    """知识点向量存储，支持语义搜索和易混淆概念检测。"""

    def __init__(self) -> None:
        self._initialized = False
        self._lock = asyncio.Lock()

    async def _ensure_collection(self, dimension: int) -> None:
        """懒初始化：首次操作时创建 collection（加锁防并发竞态）"""
        if self._initialized:
            return
        async with self._lock:
            if self._initialized:
                return
            ensure_collection(COLLECTION, dimension)
            self._initialized = True

    async def upsert_knowledge(
        self,
        concept: str,
        description: str,
        metadata: dict | None = None,
    ) -> str:
        """将知识点 embedding 存入 Qdrant。

        把 concept + description 拼接生成 embedding，存入独立 collection。
        返回生成的 point id。
        """
        text = f"{concept}: {description}" if description else concept
        embeddings, dimension = await embed_texts([text])
        await self._ensure_collection(dimension)

        point_id = str(uuid.uuid4())
        payload = {
            "concept": concept,
            "description": description,
            "text": text,
        }
        if metadata:
            payload.update(metadata)

        get_client().upsert(
            collection_name=COLLECTION,
            points=[
                PointStruct(
                    id=point_id,
                    vector=embeddings[0],
                    payload=payload,
                )
            ],
        )
        return point_id

    async def search_similar(self, query: str, top_k: int = 5) -> list[dict]:
        """语义搜索相关知识点。

        返回列表，每项包含 concept、description、score、metadata。
        """
        embeddings, dimension = await embed_texts([query])
        await self._ensure_collection(dimension)

        results = get_client().query_points(
            collection_name=COLLECTION,
            query=embeddings[0],
            limit=top_k,
        )

        return [
            {
                "concept": hit.payload.get("concept", ""),
                "description": hit.payload.get("description", ""),
                "score": hit.score,
                "metadata": {
                    k: v
                    for k, v in hit.payload.items()
                    if k not in ("concept", "description", "text")
                },
            }
            for hit in results.points
        ]

    async def find_confusable(
        self,
        concept: str,
        threshold: float = 0.85,
        top_k: int = 10,
    ) -> list[dict]:
        """找出易混淆概念（高相似度 + 不同概念名）。

        先对 concept 做语义搜索，筛选出相似度 >= threshold 且概念名不同的结果。
        """
        embeddings, dimension = await embed_texts([concept])
        await self._ensure_collection(dimension)

        results = get_client().query_points(
            collection_name=COLLECTION,
            query=embeddings[0],
            limit=top_k,
        )

        confusable = []
        for hit in results.points:
            hit_concept = hit.payload.get("concept", "")
            # 排除自身，只保留高相似度的不同概念
            if hit_concept != concept and hit.score >= threshold:
                confusable.append({
                    "concept": hit_concept,
                    "description": hit.payload.get("description", ""),
                    "score": hit.score,
                    "metadata": {
                        k: v
                        for k, v in hit.payload.items()
                        if k not in ("concept", "description", "text")
                    },
                })

        return confusable


# 模块级单例
knowledge_vector_store = KnowledgeVectorStore()
