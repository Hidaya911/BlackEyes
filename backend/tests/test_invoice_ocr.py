import os
os.environ['DATABASE_URL'] = 'sqlite://'
import unittest
from io import BytesIO
from unittest.mock import patch
from uuid import uuid4
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base, get_db
from main import app
from models import User, Vendor, VendorPurchase, InventoryTransaction, InventoryItem
from sessions import current_user
from services.invoice_ocr import parse_invoice_text, extract_invoice, InvoiceOCRError

SAMPLE = '''Cedar Paper Supplies
Invoice No: INV-2026-042
Invoice Date: 2026-09-20
Description Qty Unit Price Amount
A4 Paper Reams 10 4.50 45.00
Black Toner 2 15.00 30.00
Subtotal 75.00
Tax 0.00
Grand Total USD 75.00
'''


def image_bytes():
    buffer = BytesIO()
    Image.new('RGB', (100, 100), 'white').save(buffer, format='PNG')
    return buffer.getvalue()


class InvoiceParsingTests(unittest.TestCase):
    def test_fields_and_rows(self):
        result = parse_invoice_text(SAMPLE)
        self.assertEqual(result['invoice_reference'], 'INV-2026-042')
        self.assertEqual(result['purchase_date'], '2026-09-20')
        self.assertEqual(result['currency'], 'USD')
        self.assertEqual(result['total'], '75.00')
        self.assertEqual(len(result['items']), 2)
        self.assertEqual(result['items'][0]['item_name'], 'A4 Paper Reams')
        self.assertEqual(result['items'][0]['unit_price'], '4.50')

    def test_ambiguous_date_currency_and_tax_are_flagged(self):
        result = parse_invoice_text('Date: 03/04/2026\nPaper 2 10.00 20.00\nTax 2.00\nTotal EUR 22.00')
        self.assertEqual(result['purchase_date'], '')
        self.assertEqual(result['currency'], 'EUR')
        self.assertTrue(any('ambiguous' in note for note in result['warnings']))
        self.assertTrue(any('do not match' in note for note in result['warnings']))
        self.assertTrue(any('USD' in note for note in result['warnings']))

    def test_numeric_formats_and_inconsistent_row(self):
        result = parse_invoice_text('Paper 2 1.234,50 2.000,00\nGrand Total EUR 2.000,00')
        self.assertEqual(result['items'][0]['unit_price'], '1234.50')
        self.assertTrue(result['items'][0]['warning'])
        self.assertEqual(result['total'], '2000.00')

    def test_missing_values_are_not_invented(self):
        result = parse_invoice_text('Unreadable vendor invoice\nSome blurry paper supplies')
        self.assertEqual(result['items'], [])
        self.assertIsNone(result['total'])
        self.assertEqual(result['purchase_date'], '')

    def test_invalid_file_and_no_text(self):
        with self.assertRaises(InvoiceOCRError):
            extract_invoice(b'not an image')
        with patch('services.invoice_ocr._recognize', return_value=('', 0, [])):
            with self.assertRaisesRegex(InvoiceOCRError, 'No readable text'):
                extract_invoice(image_bytes())

    def test_pixel_limit_and_low_confidence(self):
        with patch('services.invoice_ocr.MAX_PIXELS', 5000):
            with self.assertRaisesRegex(InvoiceOCRError, 'megapixels'):
                extract_invoice(image_bytes())
        with patch('services.invoice_ocr._recognize', return_value=(SAMPLE, 45, [])):
            result = extract_invoice(image_bytes())
        self.assertTrue(any('quality is low' in note for note in result['warnings']))


class InvoiceOCRAPITests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.admin = User(full_name='Admin', email='ocr@test.local', password_hash='unused', role='admin', status='active')
        self.vendor = Vendor(name='Cedar Paper Supplies')
        self.db.add_all([self.admin, self.vendor]); self.db.commit()
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[current_user] = lambda: self.admin
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close(); app.dependency_overrides.clear(); self.db.close(); self.engine.dispose()

    def upload(self, content=None, mime='image/png'):
        return self.client.post('/api/admin/vendor-invoices/parse', content=image_bytes() if content is None else content, headers={'Content-Type': mime})

    @patch('services.invoice_ocr._recognize', return_value=(SAMPLE, 95, []))
    def test_admin_can_extract_without_writes(self, recognize):
        response = self.upload()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['suggested_vendor_id'], self.vendor.vendor_id)
        self.assertEqual(response.json()['total'], '75.00')
        self.assertEqual(self.db.query(VendorPurchase).count(), 0)
        self.assertEqual(self.db.query(InventoryTransaction).count(), 0)

    @patch('routers.vendor_invoice_ocr.extract_invoice')
    def test_staff_customer_and_anonymous_denied_before_ocr(self, extract):
        for role in ['staff', 'customer', 'wholesaler']:
            self.admin.role = role
            self.assertEqual(self.upload().status_code, 403)
        del app.dependency_overrides[current_user]
        self.assertEqual(self.upload().status_code, 401)
        extract.assert_not_called()

    def test_content_validation(self):
        self.assertEqual(self.upload(b'%PDF', 'application/pdf').status_code, 415)
        self.assertEqual(self.upload(b'not an image').status_code, 422)
        self.assertEqual(self.upload(b'').status_code, 413)
        with patch('routers.vendor_invoice_ocr.MAX_BYTES', 10):
            self.assertEqual(self.upload(b'x' * 11).status_code, 413)

    def test_runtime_errors_are_actionable(self):
        for code in [429, 503, 504]:
            with patch('routers.vendor_invoice_ocr.extract_invoice', side_effect=InvoiceOCRError('Retry or check OCR setup.', code)):
                self.assertEqual(self.upload().status_code, code)

    @patch('services.invoice_ocr._recognize', return_value=(SAMPLE, 95, []))
    def test_reviewed_row_uses_existing_ledger_and_retry_protection(self, recognize):
        extracted = self.upload().json()
        row = extracted['items'][0]
        payload = dict(admin_id=self.admin.user_id, request_key=str(uuid4()),
                       item_name=row['item_name'], item_type='paper', unit='reams',
                       quantity=row['quantity'], unit_price=row['unit_price'],
                       purchase_date=extracted['purchase_date'], invoice_reference=extracted['invoice_reference'])
        path = f'/api/admin/vendors/{self.vendor.vendor_id}/purchases'
        response = self.client.post(path, json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(str(self.db.query(VendorPurchase).one().cost), '45.00')
        self.assertEqual(float(self.db.query(InventoryItem).one().quantity_on_hand), 10)
        self.assertEqual(self.db.query(InventoryTransaction).count(), 1)
        self.assertEqual(self.client.post(path, json=payload).status_code, 409)
        self.assertEqual(self.db.query(VendorPurchase).count(), 1)


    def test_subcent_rate_is_saved_without_loss(self):
        payload = dict(admin_id=self.admin.user_id, request_key=str(uuid4()), item_name='Paper sheets',
                       item_type='paper', unit='sheets', quantity='5000', unit_price='0.004',
                       purchase_date='2026-09-24')
        response = self.client.post(f'/api/admin/vendors/{self.vendor.vendor_id}/purchases', json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        self.db.expire_all()
        purchase = self.db.query(VendorPurchase).one()
        self.assertEqual(float(purchase.unit_price), .004)
        self.assertEqual(float(purchase.cost), 20)


    def batch_rows(self):
        return [dict(admin_id=self.admin.user_id, request_key=str(uuid4()), item_name=name,
                     item_type='paper', unit='sheets', quantity=qty, unit_price=price,
                     purchase_date='2026-09-24', invoice_reference='BATCH-1')
                for name, qty, price in [('A4 paper', '5000', '0.004'), ('A3 paper', '2500', '0.008')]]

    def test_batch_persists_rows_and_retries_once(self):
        rows = self.batch_rows()
        path = f'/api/admin/vendors/{self.vendor.vendor_id}/extracted-purchases'
        result = self.client.post(path, json={'rows': rows})
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(len(result.json()['purchase_ids']), 2)
        self.assertEqual(self.db.query(VendorPurchase).count(), 2)
        self.assertEqual(self.db.query(InventoryTransaction).count(), 2)
        self.assertTrue(self.client.post(path, json={'rows': rows}).json()['already_saved'])
        self.assertEqual(self.db.query(VendorPurchase).count(), 2)
        ledger = self.client.get('/api/admin/vendor-ledger', params={'admin_id': self.admin.user_id}).json()
        self.assertEqual(len(ledger['purchases']), 2)
        self.assertEqual(float(ledger['total_cost']), 40)
        fresh = self.batch_rows()
        self.assertEqual(self.client.post(path, json={'rows': fresh}).status_code, 201)
        self.assertEqual(self.db.query(InventoryItem).count(), 2)
        self.assertEqual(sum(float(item.quantity_on_hand) for item in self.db.query(InventoryItem)), 15000)

    def test_batch_rolls_back_every_row_on_failure(self):
        rows = self.batch_rows()
        rows[1]['item_id'] = 999999
        result = self.client.post(f'/api/admin/vendors/{self.vendor.vendor_id}/extracted-purchases', json={'rows': rows})
        self.assertEqual(result.status_code, 404, result.text)
        self.assertEqual(self.db.query(VendorPurchase).count(), 0)
        self.assertEqual(self.db.query(InventoryTransaction).count(), 0)
        self.assertEqual(self.db.query(InventoryItem).count(), 0)

    def test_batch_rejects_staff_and_duplicate_row_keys(self):
        rows = self.batch_rows()
        path = f'/api/admin/vendors/{self.vendor.vendor_id}/extracted-purchases'
        self.admin.role = 'staff'
        self.assertEqual(self.client.post(path, json={'rows': rows}).status_code, 403)
        self.admin.role = 'admin'
        rows[1]['request_key'] = rows[0]['request_key']
        self.assertEqual(self.client.post(path, json={'rows': rows}).status_code, 422)


if __name__ == '__main__':
    unittest.main()
