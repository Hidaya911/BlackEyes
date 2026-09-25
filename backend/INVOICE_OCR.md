Vendor invoice OCR is available only in Admin → Vendors → Purchases & payments.
Upload a JPEG, PNG or WebP scan/photo (8 MB, 16 megapixels maximum). PDF and HEIC
files must be exported as images first. Uploads are processed locally and are not
retained; the OCR subprocess uses temporary files which pytesseract cleans up.

Setup
-----
Install requirements.txt and the Tesseract executable separately:

    winget install --id UB-Mannheim.TesseractOCR --exact

On Debian/Ubuntu, install `tesseract-ocr` and `tesseract-ocr-eng`. Windows defaults
under Program Files and LocalAppData are detected automatically. Other locations
can be configured through `TESSERACT_CMD` in the backend environment. Restart the
backend after installation. A persistent backend with subprocess support is
required; the native executable is not bundled for serverless deployment.

`TESSERACT_LANG` defaults to `eng`. Install the corresponding traineddata files
before changing it (for example `eng+ara`). Recognition can use other languages,
but structured field extraction currently recognizes English labels, Latin-digit
amounts and common numeric dates. Other content remains in the extracted text.

How it works
------------
Tesseract's LSTM OCR model recognizes the text. Image orientation metadata,
grayscale and contrast normalization are applied before recognition. Conservative
rules suggest invoice references, dates, subtotal, VAT and totals. OCR word positions
reconstruct visual rows and header-defined columns, including material types and
quantity units. Automatic and single-block segmentation are compared within the
30-second time budget, and small scans are enlarged. Contact/phone lines are rejected
as items. This is OCR-assisted extraction, not an LLM or universal
invoice-layout model. Average OCR word confidence is not field-level accuracy.

The administrator confirms the vendor and reviews every purchase using the
existing ledger form. Select an existing material or enter a material type and
unit. Unknown/foreign currency leaves the USD price blank. Ambiguous dates stay
blank. Taxes, shipping and discounts are flagged through total discrepancies but
are not automatically posted as inventory. Payment defaults to zero. Each saved
row uses the ledger's normal validation, stock transaction, and request-key
duplicate protection. A matching vendor/reference triggers a review warning;
several legitimate purchase rows can share one invoice reference. Re-scanning an
invoice is not guaranteed to detect duplicates with missing/different references.

The read-only endpoint is `POST /api/admin/vendor-invoices/parse`, with a raw image
request body and a session cookie. It enforces the admin role, streams with a size
limit, checks the actual image format/dimensions, and limits OCR to two concurrent
jobs per process and a 30-second OCR time budget. Vendor unit prices now support
six decimal places; startup migrations widen PostgreSQL unit_price to NUMERIC(18,6).
Final purchase costs remain rounded to cents. Restart the backend to apply this
non-destructive precision change before recording sub-cent per-sheet rates.

Validation: `python -B -m unittest discover -s tests -p test_invoice_ocr.py -v`.
Tesseract installation reference: https://tesseract-ocr.github.io/tessdoc/Installation.html
