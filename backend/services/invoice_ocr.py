"""Local Tesseract recognition and conservative invoice field suggestions."""
import os
import re
import shutil
import warnings
from time import monotonic
from datetime import date
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path
from threading import BoundedSemaphore
from services.invoice_layout import visual_rows, table_cells

MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 16_000_000
_slots = BoundedSemaphore(2)
NUMBER = r"\d+(?:[.,]\d+)*"


class InvoiceOCRError(Exception):
    def __init__(self, message, status=422):
        self.status = status
        super().__init__(message)


def decimal_text(value):
    value = value.replace(' ', '')
    if ',' in value and '.' in value:
        decimal_sep = ',' if value.rfind(',') > value.rfind('.') else '.'
        value = value.replace('.' if decimal_sep == ',' else ',', '').replace(decimal_sep, '.')
    elif ',' in value:
        value = value.replace(',', '.' if len(value.rsplit(',', 1)[1]) <= 2 else '')
    try:
        number = Decimal(value)
        if not number.is_finite() or number < 0 or number > Decimal('999999999999.99'):
            return None
        return format(number, 'f')
    except InvalidOperation:
        return None


def valid_item_name(name):
    return bool(re.search(r'[a-zA-Z]{2}', name)) and not re.search(
        r'\b(tel|telephone|phone|fax|email|contact|invoice|date|subtotal|total|vat|tax|balance|address|iban|account)\b|@', name, re.I)


def make_item(name, qty, price, amount, source, unit='', material=''):
    name = re.sub(r'^\s*(?:\d+[.)]?|[a-z]\))\s+', '', name).strip()
    if not valid_item_name(name):
        return None
    values = [decimal_text(re.sub(r'(?:USD|EUR|LBP|[$€£])', '', value, flags=re.I).strip()) for value in [qty, price, amount]]
    if any(value is None for value in values) or Decimal(values[0]) <= 0:
        return None
    qty, price, amount = values
    consistent = abs(Decimal(qty) * Decimal(price) - Decimal(amount)) <= Decimal('0.02')
    kind = 'paper' if re.search(r'paper|cardboard|carton', material, re.I) else 'ink' if re.search(r'ink|toner', material, re.I) else 'other'
    return dict(item_name=name[:255], quantity=qty, unit_price=price, line_total=amount,
                unit=unit[:30], item_type=kind, source=source,
                warning='' if consistent else 'Quantity × unit price differs from the printed amount.')


def parse_invoice_text(text, layout=None):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    notes = ['OCR suggestions can contain mistakes. Check the original before recording purchases.']
    reference = ''
    purchase_date = ''
    totals = []
    subtotal = None
    tax = None
    items = []
    currency_codes = set(re.findall(r'\b(USD|EUR|GBP|LBP|AED|CAD|AUD)\b', text.upper()))
    for symbol, code in [('€', 'EUR'), ('£', 'GBP'), ('ل.ل', 'LBP')]:
        if symbol in text:
            currency_codes.add(code)
    if '$' in text and not currency_codes:
        notes.append('A dollar symbol was found; confirm which dollar currency the invoice uses.')
    currency = next(iter(currency_codes)) if len(currency_codes) == 1 else None
    if currency != 'USD':
        notes.append('The ledger uses USD. Confirm currency and convert prices manually when necessary.')
    for line in lines:
        ref = re.search(r'\b(?:invoice|bill)\s*(?:(?:no\.?|number|ref(?:erence)?\.?|#)\s*)?[:#-]?\s*([A-Z0-9][A-Z0-9/._-]*\d[A-Z0-9/._-]*|\d+)\b', line, re.I)
        if ref and not reference:
            reference = ref.group(1)[:100]
        if re.search(r'\b(?:invoice\s+date|date)\b', line, re.I) and not re.search(r'\bdue\b', line, re.I):
            match = re.search(r'\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b', line)
            if match:
                try:
                    purchase_date = date(*map(int, match.groups())).isoformat()
                except ValueError:
                    notes.append('The invoice date could not be read reliably. Enter it manually.')
            else:
                match = re.search(r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b', line)
                if match:
                    a, b, year = map(int, match.groups())
                    if a <= 12 and b <= 12 and a != b:
                        notes.append('The printed date is ambiguous (day/month or month/day). Select the correct date.')
                    else:
                        try:
                            purchase_date = date(year, b if a > 12 else a, a if a > 12 else b).isoformat()
                        except ValueError:
                            notes.append('The invoice date could not be read reliably. Enter it manually.')
        total_match = re.search(r'\b(grand\s+total|invoice\s+total|total\s+due|amount\s+due|balance\s+due|total)\b\s*[:=]?\s*\(?(?:USD|EUR|GBP|LBP|\$|€|£)?\)?\s*[:=]?\s*(' + NUMBER + r')\s*(?:USD|EUR|GBP|LBP|\$|€|£)?\s*$', line, re.I)
        if total_match and not re.search(r'\b(?:sub\s*total|tax|vat)\b', line, re.I):
            totals.append((2 if re.search('grand|invoice', total_match.group(1), re.I) else 1 if total_match.group(1).lower() == 'total' else 0, decimal_text(total_match.group(2))))
        summary = re.search(r'^\s*(subtotal|sub\s+total|vat|tax)\b.*?(' + NUMBER + r')\s*(?:USD|EUR|GBP|LBP)?\s*$', line, re.I)
        if summary:
            if re.match(r'sub', summary.group(1), re.I):
                subtotal = decimal_text(summary.group(2))
            else:
                tax = decimal_text(summary.group(2))
        # Only suggest rows whose last three columns look like quantity, unit price, amount.
        # Units, tax-inclusive layouts and other formats remain available in the raw text.
        row = re.match(r'^(.+?)\s+(' + NUMBER + r')\s+(?:([a-z]+)\s+)?(?:\$|USD\s*)?(' + NUMBER + r')\s+(?:\$|USD\s*)?(' + NUMBER + r')\s*$', line.replace('|', ' '), re.I)
        if row and not re.search(r'\b(total|subtotal|tax|vat|balance|discount|shipping|date|invoice)\b', row.group(1), re.I):
            name, qty, unit, price, amount = row.groups()
            item = make_item(name, qty, price, amount, line, unit or '')
            if item and len(items) < 100:
                items.append(item)
    cells = table_cells(layout) if layout else None
    if cells is not None:
        items = []
        for row in cells:
            item = make_item(row['item_name'], row['quantity'], row['unit_price'], row['line_total'],
                             row['source'], row.get('unit', ''), row.get('material_type', ''))
            if item:
                items.append(item)
        items = items[:100]
    if not items:
        notes.append('No reliable item columns were found. Use the extracted text to add a purchase manually.')
    total = sorted(totals, key=lambda pair: pair[0], reverse=True)[0][1] if totals else None
    item_sum = sum(Decimal(item['line_total']) for item in items)
    expected = subtotal or total
    if expected and items and abs(item_sum - Decimal(expected)) > Decimal('0.02'):
        notes.append('Recognized item amounts do not match the printed subtotal or total. Check for missing rows, taxes, fees or discounts.')
    if tax and Decimal(tax):
        notes.append(f'Printed tax/VAT is {tax}. It is not included in the material purchases posted to the ledger.')
    if total and subtotal and tax and abs(Decimal(subtotal) + Decimal(tax) - Decimal(total)) > Decimal('0.02'):
        notes.append('Printed subtotal plus tax does not match the printed invoice total. Review adjustments or OCR errors.')
    return {'invoice_reference': reference, 'purchase_date': purchase_date, 'total': total,
            'subtotal': subtotal, 'tax': tax, 'currency': currency, 'items': items, 'warnings': list(dict.fromkeys(notes))}


def _recognize(image):
    try:
        import pytesseract
        executable = os.getenv('TESSERACT_CMD') or shutil.which('tesseract')
        if not executable:
            candidates = [Path(os.getenv('ProgramFiles', 'C:/Program Files')) / 'Tesseract-OCR/tesseract.exe',
                          Path(os.getenv('LOCALAPPDATA', 'C:/')) / 'Programs/Tesseract-OCR/tesseract.exe']
            executable = next((str(path) for path in candidates if path.is_file()), None)
        if not executable:
            raise InvoiceOCRError('Tesseract is not installed on the server. Install it or configure TESSERACT_CMD.', 503)
        pytesseract.pytesseract.tesseract_cmd = executable
        candidates = []
        started = monotonic()
        for mode in (3, 6):
            remaining = 30 - (monotonic() - started)
            if remaining < 1:
                break
            try:
                data = pytesseract.image_to_data(image, lang=os.getenv('TESSERACT_LANG', 'eng'),
                                                config=f'--oem 1 --psm {mode}', output_type=pytesseract.Output.DICT, timeout=remaining)
            except RuntimeError:
                if candidates:
                    break
                raise
            rows = visual_rows(data)
            text = '\n'.join(row['text'] for row in rows)
            parsed = parse_invoice_text(text, rows)
            scores = [float(score) for word, score in zip(data['text'], data['conf']) if word.strip() and float(score) >= 0]
            confidence = round(sum(scores) / len(scores), 1) if scores else 0
            valid = sum(not item['warning'] for item in parsed['items'])
            rank = (valid, bool(parsed['total']), table_cells(rows) is not None, confidence)
            candidates.append((rank, text, confidence, rows))
        _, text, confidence, rows = max(candidates, key=lambda candidate: candidate[0])
        return text, confidence, rows
    except ImportError as exc:
        raise InvoiceOCRError('OCR dependencies are missing on the server.', 503) from exc
    except InvoiceOCRError:
        raise
    except pytesseract.TesseractNotFoundError as exc:
        raise InvoiceOCRError('The configured Tesseract executable was not found.', 503) from exc
    except pytesseract.TesseractError as exc:
        raise InvoiceOCRError('Tesseract could not read the image. Check the configured language data and try a clearer scan.', 503) from exc
    except RuntimeError as exc:
        raise InvoiceOCRError('OCR timed out. Crop the invoice or upload a smaller, clearer image.', 504) from exc


def extract_invoice(content):
    if not content or len(content) > MAX_BYTES:
        raise InvoiceOCRError('Upload an invoice image no larger than 8 MB.', 413)
    if not _slots.acquire(blocking=False):
        raise InvoiceOCRError('OCR is busy with other invoices. Please retry shortly.', 429)
    try:
        try:
            from PIL import Image, ImageOps, UnidentifiedImageError
        except ImportError as exc:
            raise InvoiceOCRError('The server image-processing dependency is missing.', 503) from exc
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(BytesIO(content)) as source:
                    if source.format not in {'JPEG', 'PNG', 'WEBP'}:
                        raise InvoiceOCRError('Use a JPEG, PNG or WebP image. Export PDF pages as images first.')
                    if source.width * source.height > MAX_PIXELS:
                        raise InvoiceOCRError('The image exceeds 16 megapixels. Resize it and retry.', 413)
                    source.load()
                    oriented = ImageOps.exif_transpose(source).convert('RGBA')
                    background = Image.new('RGBA', oriented.size, 'white')
                    image = Image.alpha_composite(background, oriented).convert('RGB')
                image.thumbnail((3000, 3000))
                if max(image.size) < 2400:
                    scale = min(2, 3200 / max(image.size))
                    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
                image = ImageOps.autocontrast(ImageOps.grayscale(image))
        except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise InvoiceOCRError('The image is too large to process safely.', 413) from exc
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise InvoiceOCRError('This file is not a readable invoice image. Try another photo or scan.') from exc
        text, confidence, layout = _recognize(image)
        if not text.strip():
            raise InvoiceOCRError('No readable text found. Use a well-lit, upright photo with the full invoice in focus.')
        result = parse_invoice_text(text, layout)
        if confidence < 70:
            result['warnings'].append('Text recognition quality is low. Carefully review every field or try a clearer photo.')
        return {**result, 'raw_text': text, 'text_confidence': confidence, 'engine': 'Tesseract LSTM'}
    finally:
        _slots.release()
