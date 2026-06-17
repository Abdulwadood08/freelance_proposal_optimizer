"""Extract plain text from resume PDF bytes."""
from io import BytesIO


def pdf_bytes_to_text(data: bytes) -> str:
    """Pull text from a PDF using pypdf."""
    from pypdf import PdfReader

    reader = PdfReader(BytesIO(data))
    parts: list[str] = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n".join(parts).strip()
