from fastapi import APIRouter, UploadFile, File

from app.models.schemas import ParseResponse
from app.services.parser import parse_pdf, parse_text

router = APIRouter()


@router.post("/parse", response_model=ParseResponse)
async def parse_document(file: UploadFile = File(...)):
    """解析上传的文档"""
    content = await file.read()
    filename = file.filename or "unknown"

    if filename.endswith(".pdf"):
        result = parse_pdf(content, filename)
    else:
        text = content.decode("utf-8", errors="replace")
        result = parse_text(text, filename)

    return ParseResponse(**result)
