"""知识点向量化路由 — 写入、语义搜索、易混淆概念检测"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.knowledge_vector import knowledge_vector_store

router = APIRouter(prefix="/knowledge")


# --- 请求/响应模型 ---


class KnowledgeEmbedRequest(BaseModel):
    """知识点向量化写入请求"""

    concept: str
    description: str = ""
    metadata: dict[str, str] = Field(default_factory=dict)


class KnowledgeEmbedResponse(BaseModel):
    """知识点向量化写入响应"""

    point_id: str
    concept: str


class KnowledgeSearchRequest(BaseModel):
    """知识点语义搜索请求"""

    query: str
    top_k: int = 5


class KnowledgeSearchResult(BaseModel):
    """单条知识点搜索结果"""

    concept: str
    description: str = ""
    score: float
    metadata: dict = Field(default_factory=dict)


class KnowledgeSearchResponse(BaseModel):
    """知识点语义搜索响应"""

    results: list[KnowledgeSearchResult]


class KnowledgeConfusableRequest(BaseModel):
    """易混淆概念查找请求"""

    concept: str
    threshold: float = 0.85


class KnowledgeConfusableResponse(BaseModel):
    """易混淆概念查找响应"""

    concept: str
    confusable: list[KnowledgeSearchResult]


# --- 路由 ---


@router.post("/embed", response_model=KnowledgeEmbedResponse)
async def embed_knowledge(request: KnowledgeEmbedRequest):
    """将知识点写入向量库"""
    point_id = knowledge_vector_store.upsert_knowledge(
        concept=request.concept,
        description=request.description,
        metadata=request.metadata,
    )
    return KnowledgeEmbedResponse(point_id=point_id, concept=request.concept)


@router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(request: KnowledgeSearchRequest):
    """语义搜索知识点"""
    results = knowledge_vector_store.search_similar(
        query=request.query,
        top_k=request.top_k,
    )
    return KnowledgeSearchResponse(
        results=[KnowledgeSearchResult(**r) for r in results]
    )


@router.post("/confusable", response_model=KnowledgeConfusableResponse)
async def find_confusable(request: KnowledgeConfusableRequest):
    """查找易混淆概念"""
    confusable = knowledge_vector_store.find_confusable(
        concept=request.concept,
        threshold=request.threshold,
    )
    return KnowledgeConfusableResponse(
        concept=request.concept,
        confusable=[KnowledgeSearchResult(**r) for r in confusable],
    )
