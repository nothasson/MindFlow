from fastapi import APIRouter

from app.models.schemas import ExtractRequest, ExtractResponse, KnowledgePoint, KnowledgeRelation
from app.services.extractor import extract_knowledge_points

router = APIRouter()


@router.post("/extract", response_model=ExtractResponse)
async def extract(request: ExtractRequest):
    """从资料文本中提取结构化知识点。"""
    points = extract_knowledge_points(request.text, request.existing_concepts)
    result = []
    for point in points:
        relations = [
            KnowledgeRelation(**rel) for rel in point.get("relations", [])
        ]
        result.append(KnowledgePoint(
            concept=point["concept"],
            description=point.get("description", ""),
            prerequisites=point.get("prerequisites", []),
            bloom_level=point.get("bloom_level", "remember"),
            importance=point.get("importance", 0.5),
            granularity=point.get("granularity", 3),
            relations=relations,
        ))
    return ExtractResponse(points=result)
