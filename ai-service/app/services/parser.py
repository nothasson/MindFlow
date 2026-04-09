import fitz  # PyMuPDF


def parse_pdf(file_bytes: bytes, filename: str) -> dict:
    """解析 PDF 文件，提取纯文本"""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()

    full_text = "\n\n".join(pages)
    return {
        "text": full_text,
        "pages": len(pages),
        "filename": filename,
    }


def parse_text(content: str, filename: str) -> dict:
    """处理纯文本文件"""
    return {
        "text": content,
        "pages": 1,
        "filename": filename,
    }
