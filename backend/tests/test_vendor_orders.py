from decimal import Decimal
from uuid import uuid4
import unittest
import test_invoice_ocr
from models import VendorOrder, VendorPurchase, VendorPayment, InventoryItem, InventoryTransaction
from schemas.vendor import apply_constraints


class VendorOrderTests(unittest.TestCase):
    setUp = test_invoice_ocr.InvoiceOCRAPITests.setUp
    tearDown = test_invoice_ocr.InvoiceOCRAPITests.tearDown
    batch_rows = test_invoice_ocr.InvoiceOCRAPITests.batch_rows
    def create_order(self):
        rows = self.batch_rows()
        response = self.client.post(f'/api/admin/vendors/{self.vendor.vendor_id}/extracted-purchases', json={'rows': rows})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()['order_id']

    def test_one_order_with_two_lines_and_combined_payment(self):
        order_id = self.create_order()
        self.assertEqual(self.db.query(VendorOrder).count(), 1)
        self.assertEqual(self.db.query(VendorPurchase).count(), 2)
        response = self.client.get('/api/admin/vendor-ledger', params={'admin_id': self.admin.user_id}).json()
        self.assertEqual(len(response['orders']), 1)
        self.assertEqual(len(response['orders'][0]['lines']), 2)
        self.assertEqual(Decimal(response['orders'][0]['cost']), Decimal(40))
        payload = dict(admin_id=self.admin.user_id, request_key=str(uuid4()), amount='30', payment_date='2026-09-24', method='cash')
        path = f'/api/admin/vendor-orders/{order_id}/payments'
        result = self.client.post(path, json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(self.client.post(path, json=payload).status_code, 409)
        order = self.client.get('/api/admin/vendor-ledger', params={'admin_id': self.admin.user_id}).json()['orders'][0]
        self.assertEqual(Decimal(order['remaining']), Decimal(10))
        self.assertEqual(len(order['payments']), 1)
        self.assertEqual(Decimal(order['payments'][0]['amount']), Decimal(30))
        self.assertEqual(self.client.delete(f'/api/admin/vendor-orders/{order_id}').status_code, 409)

    def test_delete_reverses_all_stock_and_retains_movements(self):
        order_id = self.create_order()
        response = self.client.delete(f'/api/admin/vendor-orders/{order_id}')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.db.query(VendorOrder).count(), 0)
        self.assertEqual(self.db.query(VendorPurchase).count(), 0)
        self.assertTrue(all(item.quantity_on_hand == 0 for item in self.db.query(InventoryItem)))
        self.assertEqual(self.db.query(InventoryTransaction).count(), 4)
        self.assertEqual(self.client.delete(f'/api/admin/vendor-orders/{order_id}').status_code, 404)

    def test_consumed_stock_and_staff_delete_are_rejected(self):
        order_id = self.create_order()
        self.admin.role = 'staff'
        self.assertEqual(self.client.delete(f'/api/admin/vendor-orders/{order_id}').status_code, 403)
        self.admin.role = 'admin'
        self.db.query(InventoryItem).first().quantity_on_hand = 0
        self.db.commit()
        self.assertEqual(self.client.delete(f'/api/admin/vendor-orders/{order_id}').status_code, 409)
        self.assertEqual(self.db.query(VendorPurchase).count(), 2)

    def test_backfill_combines_existing_invoice_rows_once(self):
        self.create_order()
        self.db.query(VendorPurchase).update({'order_id': None})
        self.db.query(VendorOrder).delete()
        self.db.commit()
        with self.engine.begin() as connection:
            apply_constraints(connection)
            apply_constraints(connection)
        self.db.expire_all()
        self.assertEqual(self.db.query(VendorOrder).count(), 1)
        self.assertEqual(len({line.order_id for line in self.db.query(VendorPurchase)}), 1)

    def test_batch_rejects_mixed_invoice_dates(self):
        rows = self.batch_rows()
        rows[1]['purchase_date'] = '2026-09-23'
        self.assertEqual(self.client.post(f'/api/admin/vendors/{self.vendor.vendor_id}/extracted-purchases', json={'rows': rows}).status_code, 422)
