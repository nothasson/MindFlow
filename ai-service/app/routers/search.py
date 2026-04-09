from fastapi import APIRouter

from app.models.schemas import SearchRequest, SearchResponse, SearchResult
from app.services.embedder import embed_texts
from app.services.vector_store import search_vectors

router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """向量相似度搜索"""
    embeddings, _ = embed_texts([request.query])
    query_vector = embeddings[0]

    results = search_vectors(
        collection=request.collection,
        query_vector=query_vector,
        limit=request.limit,
    )

    return SearchResponse(
        results=[SearchResult(**r) for r in results]
    )
