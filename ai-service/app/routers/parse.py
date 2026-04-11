from fastapi import APIRouter, UploadFile, File

from app.models.schemas import ParseResponse
from app.services.parser import parse_docx, parse_pdf, parse_pptx, parse_text

router = APIRouter()


@router.post("/parse", response_model=ParseResponse)
async def parse_document(file: UploadFile = File(...)):
    """解析上传的文档，支持 PDF / DOCX / PPTX / TXT / MD"""
    content = await file.read()
    filename = file.filename or "unknown"
    lower = filename.lower()

    if lower.endswith(".pdf"):
        result = parse_pdf(content, filename)
    elif lower.endswith(".docx"):
        result = parse_docx(content, filename)
    elif lower.endswith(".pptx"):
        result = parse_pptx(content, filename)
    else:
        # .txt / .md / 其他纯文本
        text = content.decode("utf-8", errors="replace")
        result = parse_text(text, filename)

    return ParseResponse(**result)
