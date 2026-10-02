"""Admin-only, read-only OCR. Uploads are processed without storing the image."""
import re
from pydantic import BaseModel, Field, ConfigDict, ValidationError
from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from database import get_db
from models import User, Vendor
from sessions import current_user
from services.invoice_ocr import MAX_BYTES, InvoiceOCRError, extract_invoice
from services.invoice_ocr import parse_invoice_text
from services.invoice_layout import visual_rows, table_cells

router = APIRouter(prefix='/api/admin/vendor-invoices', tags=['Vendor invoice OCR'])


def invoice_admin(user: User = Depends(current_user)):
    if user.role != 'admin':
        raise HTTPException(403, 'Only administrators can parse vendor invoices.')
    return user


class OCRWord(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    text: str = Field(max_length=500)
    confidence: float = Field(ge=0, le=100)
    left: int = Field(ge=0, le=10000)
    top: int = Field(ge=0, le=10000)
    width: int = Field(ge=0, le=10000)
    height: int = Field(ge=0, le=10000)


class OCRPass(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    text: str = Field(max_length=100000)
    confidence: float = Field(ge=0, le=100)
    words: list[OCRWord] = Field(max_length=6000)


class BrowserOCRRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    passes: list[OCRPass] = Field(min_length=1, max_length=2)


def suggest_vendor(result, db):
    normalize = lambda text: re.sub(r'\W+', ' ', text.casefold()).strip()
    text_lines = {normalize(line) for line in result['raw_text'].splitlines()}
    matches = [vendor.vendor_id for vendor in db.query(Vendor).all() if normalize(vendor.name) in text_lines]
    return {**result, 'suggested_vendor_id': matches[0] if len(matches) == 1 else None}


@router.post('/parse-text')
async def parse_browser_invoice(request: Request, admin: User = Depends(invoice_admin), db: Session = Depends(get_db)):
    # Bound the body before decoding JSON; browser input remains untrusted.
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > 2 * 1024 * 1024:
            raise HTTPException(413, 'Recognized invoice data is too large. Crop the invoice and retry.')
        content.extend(chunk)
    try:
        payload = BrowserOCRRequest.model_validate_json(content)
    except ValidationError:
        raise HTTPException(422, 'Invalid recognized invoice data. Please scan the image again.')
    candidates = []
    for scan in payload.passes:
        data = {key: [] for key in ('text', 'conf', 'left', 'top', 'width', 'height')}
        for word in scan.words:
            for key in data:
                data[key].append(getattr(word, 'confidence' if key == 'conf' else key))
        rows = visual_rows(data)
        text = '\n'.join(row['text'] for row in rows) if rows else scan.text
        if not text.strip():
            continue
        parsed = parse_invoice_text(text, rows)
        rank = (sum(not item['warning'] for item in parsed['items']), bool(parsed['total']),
                table_cells(rows) is not None, scan.confidence)
        candidates.append((rank, parsed, text, scan.confidence))
    if not candidates:
        raise HTTPException(422, 'No readable text found. Use a clear, upright photo of the full invoice.')
    _, parsed, text, confidence = max(candidates, key=lambda candidate: candidate[0])
    if confidence < 70:
        parsed['warnings'].append('Text recognition quality is low. Carefully review every field or try a clearer photo.')
    return suggest_vendor({**parsed, 'raw_text': text, 'text_confidence': confidence,
                           'engine': 'Tesseract.js LSTM'}, db)


@router.post('/parse')
async def parse_vendor_invoice(request: Request, admin: User = Depends(invoice_admin), db: Session = Depends(get_db)):
    if request.headers.get('content-type', '').split(';')[0].lower() not in {'image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'}:
        raise HTTPException(415, 'Upload a JPEG, PNG or WebP image.')
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, 'Invoice images must be no larger than 8 MB.')
        content.extend(chunk)
    try:
        result = await run_in_threadpool(extract_invoice, bytes(content))
    except InvoiceOCRError as exc:
        raise HTTPException(exc.status, str(exc)) from exc
    # Suggest only a unique full vendor-name match; the administrator still confirms it.
    return suggest_vendor(result, db)
