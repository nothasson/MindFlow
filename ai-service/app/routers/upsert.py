from fastapi import APIRouter

from app.models.schemas import UpsertRequest, UpsertResponse
from app.services.vector_store import ensure_collection, upsert_vectors

router = APIRouter()


@router.post("/upsert", response_model=UpsertResponse)
async def upsert(request: UpsertRequest):
    """将文本及向量写入 Qdrant。"""
    dimension = len(request.embeddings[0]) if request.embeddings else 0
    if dimension > 0:
        ensure_collection(request.collection, dimension)

    inserted = upsert_vectors(
        collection=request.collection,
        texts=request.texts,
        embeddings=request.embeddings,
        metadata=request.metadata,
    )
    return UpsertResponse(inserted=inserted)
