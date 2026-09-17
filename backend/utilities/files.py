import base64
import binascii
from fastapi import HTTPException

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_TOTAL_FILE_BYTES = 20 * 1024 * 1024


def decode_artwork(data_url: str, image_only=False):
    allowed = {"image/png", "image/jpeg"} if image_only else {"application/pdf", "image/png", "image/jpeg"}
    try:
        header, encoded = data_url.split(",", 1)
        mime = header.removeprefix("data:").removesuffix(";base64")
        if not header.startswith("data:") or not header.endswith(";base64") or mime not in allowed:
            raise ValueError()
        content = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(status_code=422, detail="Upload a valid PDF, PNG, or JPEG file.")
    maximum = 1024 * 1024 if image_only else MAX_FILE_BYTES
    if not content or len(content) > maximum:
        raise HTTPException(status_code=422, detail="Profile photos must be at most 1 MB; design files must be at most 10 MB each.")
    signatures = {
        "application/pdf": content.startswith(b"%PDF-"),
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
    }
    if not signatures[mime]:
        raise HTTPException(status_code=422, detail="The file content does not match its declared type.")
    return mime, content
