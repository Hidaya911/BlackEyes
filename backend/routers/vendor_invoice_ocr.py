"""Admin-only, read-only OCR. Uploads are processed without storing the image."""
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from database import get_db
from models import User, Vendor
from sessions import current_user
from services.invoice_ocr import MAX_BYTES, InvoiceOCRError, extract_invoice

router = APIRouter(prefix='/api/admin/vendor-invoices', tags=['Vendor invoice OCR'])


def invoice_admin(user: User = Depends(current_user)):
    if user.role != 'admin':
        raise HTTPException(403, 'Only administrators can parse vendor invoices.')
    return user


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
    normalize = lambda text: re.sub(r'\W+', ' ', text.casefold()).strip()
    text_lines = {normalize(line) for line in result['raw_text'].splitlines()}
    matches = [vendor.vendor_id for vendor in db.query(Vendor).all() if normalize(vendor.name) in text_lines]
    return {**result, 'suggested_vendor_id': matches[0] if len(matches) == 1 else None}
