from fastapi import APIRouter

from app.models.schemas import ExtractRequest, ExtractResponse, KnowledgePoint
from app.services.extractor import extract_knowledge_points

router = APIRouter()


@router.post("/extract", response_model=ExtractResponse)
async def extract(request: ExtractRequest):
    """从资料文本中提取结构化知识点。"""
    points = extract_knowledge_points(request.text)
    return ExtractResponse(points=[KnowledgePoint(**point) for point in points])
