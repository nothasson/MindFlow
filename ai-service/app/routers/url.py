from fastapi import APIRouter

from app.models.schemas import URLParseRequest, URLParseResponse
from app.services.parser import parse_url

router = APIRouter()


@router.post("/parse-url", response_model=URLParseResponse)
async def parse_url_content(request: URLParseRequest):
    """抓取网页正文并转换为资料文本。"""
    return URLParseResponse(**parse_url(request.url))
