from fastapi import APIRouter

from app.models.schemas import EmbedRequest, EmbedResponse
from app.services.embedder import embed_texts

router = APIRouter()


@router.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    """生成文本嵌入向量"""
    embeddings, dimension = await embed_texts(request.texts)
    return EmbedResponse(embeddings=embeddings, dimension=dimension)
