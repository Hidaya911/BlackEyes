"""Isolated API regressions. Run: python -m unittest discover -s tests -v."""
import os
os.environ["DATABASE_URL"] = "sqlite://"

import unittest
import base64
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base, get_db
from main import app
from models import User, Product, InventoryItem, InventoryTransaction, Order, OrderPayment, DesignFile, OrderItemDesign, CustomerPayment
from sessions import current_user


class AdminWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.admin = User(full_name="Admin", email="admin@test.local", password_hash="unused", role="admin", status="active")
        self.customer = User(full_name="Customer", email="customer@test.local", password_hash="unused", role="customer", status="active", phone="123456")
        self.product = Product(name="A4 printing", price=100, status="active")
        self.item = InventoryItem(name="A4 paper", type="paper", unit="sheet", quantity_on_hand=5, low_stock_threshold=4)
        self.db.add_all([self.admin, self.customer, self.product, self.item])
        self.db.commit()
        self.actor = self.admin
        def database():
            try:
                yield self.db
            except Exception:
                self.db.rollback()
                raise
        app.dependency_overrides[get_db] = database
        app.dependency_overrides[current_user] = lambda: self.actor
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()

    def link(self, quantity=1):
        result = self.client.put(f"/api/admin/inventory/products/{self.product.product_id}", json=[{"item_id": self.item.item_id, "quantity": quantity}])
        self.assertEqual(result.status_code, 200, result.text)

    def order(self, quantity=1):
        return dict(request_key=str(uuid4()), customer_id=self.customer.user_id,
            items=[dict(product_id=self.product.product_id, quantity=quantity)],
            design_request_note="Print A4", expected_total=100 * quantity, amount_paid=50)

    def test_ledger_installments_retries_and_document_totals(self):
        order_id = self.client.post('/api/press/orders', json=self.order()).json()['order_id']
        path = f'/api/press/customer-ledger/account/{self.customer.user_id}'
        self.assertEqual(self.client.get(path).json()['due'], 50)
        payload = dict(request_key=str(uuid4()), order_id=order_id, amount=20, method='cash')
        for _ in range(2):
            result = self.client.post(path + '/payments', json=payload)
            self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.client.get(path).json()['due'], 30)
        self.assertEqual(self.db.query(CustomerPayment).count(), 2)
        self.assertEqual(self.client.post(path + '/payments', json={**payload, 'amount': 10}).status_code, 409)
        self.assertEqual(self.client.post(path + '/payments', json={**payload, 'request_key':str(uuid4()), 'amount':31}).status_code, 409)
        result = self.client.post(path + '/payments', json={**payload, 'request_key':str(uuid4()), 'amount':30})
        self.assertEqual(result.status_code, 200, result.text)
        statement = self.client.get(path).json()
        self.assertEqual([e['balance'] for e in statement['entries']], [100, 50, 30, 0])
        self.assertEqual(statement['orders'][0]['payment_status'], 'paid')
        receipt = self.client.get(f'/api/press/orders/{order_id}/documents/receipt').json()
        self.assertEqual(receipt['order']['amount_paid'], 100)
        self.assertEqual(receipt['order']['amount_due'], 0)
        report = self.client.get('/api/admin/reports').json()
        self.assertEqual(float(report['collected']), 1)
        self.assertEqual(float(report['outstanding']), 0)

    def test_ledger_legacy_history_and_order_review(self):
        order_id = self.client.post('/api/press/orders', json=self.order()).json()['order_id']
        self.db.query(CustomerPayment).delete()
        self.db.commit()
        path = f'/api/press/customer-ledger/account/{self.customer.user_id}'
        statement = self.client.get(path).json()
        self.assertEqual(statement['entries'][1]['description'], 'Previous verified payment')
        self.assertEqual(self.db.query(CustomerPayment).count(), 0)
        payload = dict(production_stage='Awaiting review', confirm_payment=True)
        for _ in range(2):
            result = self.client.patch(f'/api/press/orders/{order_id}', json=payload)
            self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.db.query(CustomerPayment).count(), 2)
        self.assertEqual(self.client.get(path).json()['due'], 0)
        self.assertEqual(self.client.get(path).json()['entries'][-1]['balance'], 0)

    def test_ledger_permissions_validation_and_customer_isolation(self):
        order_id = self.client.post('/api/press/orders', json=self.order()).json()['order_id']
        path = f'/api/press/customer-ledger/account/{self.customer.user_id}'
        payload = dict(request_key=str(uuid4()), order_id=order_id, amount=20, method='cash')
        for amount in [0, -1, 1.5]:
            self.assertEqual(self.client.post(path + '/payments', json={**payload, 'amount':amount}).status_code, 422)
        walkin = self.client.post('/api/admin/customers/walk_in', json=dict(full_name='Customer', phone='12345', email='', address='')).json()['id']
        self.assertEqual(self.client.post(f'/api/press/customer-ledger/walk_in/{walkin}/payments', json=payload).status_code, 404)
        self.admin.role = 'staff'
        self.db.commit()
        self.assertEqual(self.client.get('/api/press/customer-ledger').status_code, 200)
        self.assertEqual(self.client.get(path).status_code, 200)
        self.assertEqual(self.client.post(path + '/payments', json=payload).status_code, 200)
        self.actor = self.customer
        self.assertEqual(self.client.get('/api/press/customer-ledger').status_code, 403)
        self.assertEqual(self.client.get(path).status_code, 403)
        self.assertEqual(self.client.post(path + '/payments', json=payload).status_code, 403)

    def test_ledger_pending_transfer_is_not_received_money(self):
        payload = {**self.order(), 'amount_paid':0}
        order_id = self.client.post('/api/press/orders', json=payload).json()['order_id']
        summary = self.db.query(OrderPayment).filter_by(order_id=order_id).one()
        summary.amount = 1
        summary.status = 'pending_verification'
        self.db.commit()
        path = f'/api/press/customer-ledger/account/{self.customer.user_id}'
        self.assertEqual(self.client.get(path).json()['due'], 100)
        result = self.client.post(path + '/payments', json=dict(request_key=str(uuid4()), order_id=order_id, amount=25, method='cash'))
        self.assertEqual(result.status_code, 200, result.text)
        statement = self.client.get(path).json()
        self.assertEqual(statement['paid'], 25)
        self.assertEqual(statement['due'], 75)
        self.assertEqual(len(statement['entries']), 2)

    def test_staff_production_workflow_and_stale_updates(self):
        from models import JobStatusHistory
        order_id = self.client.post('/api/press/orders', json=self.order()).json()['order_id']
        self.admin.role = 'staff'
        self.db.commit()
        path = f'/api/press/orders/{order_id}'
        previous = 'Awaiting review'
        for stage in ['Queued', 'In Prepress', 'Printing', 'Finishing', 'Ready for Pickup']:
            result = self.client.patch(path, json=dict(production_stage=stage, expected_stage=previous))
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()['production_stage'], stage)
            self.assertEqual(result.json()['amount_due'], 50)
            previous = stage
        history = self.db.query(JobStatusHistory).filter_by(order_id=order_id).count()
        self.assertEqual(self.client.patch(path, json=dict(production_stage='Printing', expected_stage='Queued')).status_code, 409)
        self.assertEqual(self.client.patch(path, json=dict(production_stage=previous, expected_stage=previous)).status_code, 200)
        self.assertEqual(self.db.query(JobStatusHistory).filter_by(order_id=order_id).count(), history)
        self.assertEqual(self.client.patch(path, json=dict(production_stage='Unknown')).status_code, 422)
        self.actor = self.customer
        self.assertEqual(self.client.patch(path, json=dict(production_stage='Queued')).status_code, 403)

    def test_staff_board_cannot_bypass_artwork_review(self):
        self.actor = self.customer
        created = self.client.post('/api/customer/orders', json=self.design_order([dict(quantity=2, file=self.artwork())]))
        self.assertEqual(created.status_code, 201, created.text)
        path = f"/api/press/orders/{created.json()['order_id']}"
        self.admin.role = 'staff'
        self.db.commit()
        self.actor = self.admin
        self.assertEqual(self.client.patch(path, json=dict(production_stage='Queued', expected_stage='Awaiting review')).status_code, 422)
        reviewed = self.client.patch(path, json=dict(production_stage='Queued', expected_stage='Awaiting review', approve_artwork=True))
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        self.assertEqual(reviewed.json()['files'][0]['verification_status'], 'verified')

    def test_threshold_retry_and_report(self):
        self.link()
        payload = self.order()
        result = self.client.post('/api/press/orders', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        retry = self.client.post('/api/press/orders', json=payload)
        self.assertEqual(retry.status_code, 201, retry.text)
        self.db.refresh(self.item)
        self.assertEqual(self.item.quantity_on_hand, 4)
        self.assertEqual(self.db.query(InventoryTransaction).count(), 1)
        alerts = self.client.get('/api/admin/inventory/alerts').json()
        self.assertEqual(alerts[0]['quantity'], 4)
        report = self.client.get('/api/admin/reports').json()
        self.assertEqual(report['order_count'], 1)
        self.assertEqual(float(report['sales']), 1)
        self.assertEqual(float(report['collected']), .5)
        self.assertEqual(float(report['outstanding']), .5)
        self.assertEqual(float(report['usage'][0]['quantity']), 1)
        removed = self.client.delete(f'/api/admin/customers/account/{self.customer.user_id}')
        self.assertEqual(removed.status_code, 409)

    def test_insufficient_stock_rolls_back_entire_order(self):
        self.link()
        result = self.client.post('/api/press/orders', json=self.order(6))
        self.assertEqual(result.status_code, 409, result.text)
        self.db.refresh(self.item)
        self.assertEqual(self.item.quantity_on_hand, 5)
        self.assertEqual(self.db.query(Order).count(), 0)
        self.assertEqual(self.db.query(InventoryTransaction).count(), 0)

    def test_online_order_deducts_once(self):
        self.link()
        self.actor = self.customer
        payload = dict(request_key=str(uuid4()), items=[dict(product_id=self.product.product_id, quantity=1)], design_request_note="A4", contact_phone="123456", expected_total=100)
        for _ in range(2):
            result = self.client.post('/api/customer/orders', json=payload)
            self.assertEqual(result.status_code, 201, result.text)
        self.db.refresh(self.item)
        self.assertEqual(self.item.quantity_on_hand, 4)
        self.assertEqual(self.db.query(InventoryTransaction).count(), 1)

    def test_customer_crud_and_permissions(self):
        payload = dict(full_name="Walk In", phone="12345", email="", address="Beirut")
        result = self.client.post('/api/admin/customers/walk_in', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        customer_id = result.json()['id']
        path = f'/api/admin/customers/walk_in/{customer_id}'
        updated = self.client.put(path, json={**payload, 'full_name': 'Updated'})
        self.assertEqual(updated.json()['full_name'], 'Updated')
        self.assertEqual(len(self.client.get('/api/admin/customers').json()), 2)
        self.assertEqual(self.client.delete(path).status_code, 200)
        self.actor = self.customer
        for endpoint in ['/api/admin/customers', '/api/admin/inventory', '/api/admin/reports']:
            self.assertEqual(self.client.get(endpoint).status_code, 403)

    def test_pending_payment_is_not_collected_and_date_filter(self):
        self.actor = self.customer
        payload = dict(request_key=str(uuid4()), items=[dict(product_id=self.product.product_id, quantity=1)], design_request_note="A4", contact_phone="123456", expected_total=100)
        result = self.client.post('/api/customer/orders', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        # Existing pending transfers must still be excluded from collections.
        self.db.add(OrderPayment(order_id=result.json()['order_id'], amount=1, remaining=1, reference='ABC123', status='pending_verification', method='whish_money'))
        self.db.commit()
        self.actor = self.admin
        report = self.client.get('/api/admin/reports').json()
        self.assertEqual(float(report['collected']), 0)
        self.assertEqual(float(report['outstanding']), 1)
        empty = self.client.get('/api/admin/reports?start=2000-01-01&end=2000-01-01').json()
        self.assertEqual(empty['order_count'], 0)
        self.assertEqual(self.client.get('/api/admin/reports?start=2026-09-02&end=2026-09-01').status_code, 422)

    def test_invalid_material_mapping_rejected(self):
        path = f'/api/admin/inventory/products/{self.product.product_id}'
        self.assertEqual(self.client.put(path, json=[]).status_code, 422)
        self.assertEqual(self.client.put(path, json=[dict(item_id=999, quantity=1)]).status_code, 422)
        self.assertEqual(self.client.put(path, json=[dict(item_id=self.item.item_id, quantity=0)]).status_code, 422)

    def test_two_sheet_order_deducts_and_alerts(self):
        self.link()
        result = self.client.post('/api/press/orders', json=self.order(2))
        self.assertEqual(result.status_code, 201, result.text)
        self.db.refresh(self.item)
        self.assertEqual(self.item.quantity_on_hand, 3)
        self.assertEqual(self.client.get('/api/admin/inventory/alerts').json()[0]['quantity'], 3)
        path = f'/api/admin/inventory/products/{self.product.product_id}'
        self.assertEqual(self.client.put(path, json=[]).status_code, 422)
        self.assertEqual(len(self.client.get('/api/admin/inventory').json()['materials']), 1)

    def test_invoice_and_partial_receipt_for_admin_and_staff(self):
        created = self.client.post('/api/press/orders', json=self.order(2))
        order_id = created.json()['order_id']
        path = f'/api/press/orders/{order_id}/documents'
        invoice = self.client.get(path + '/invoice')
        self.assertEqual(invoice.status_code, 200, invoice.text)
        self.assertEqual(invoice.json()['number'], f'INV-{order_id:06d}')
        self.assertEqual(invoice.json()['order']['total'], 200)
        receipt = self.client.get(path + '/receipt')
        self.assertEqual(receipt.status_code, 200, receipt.text)
        self.assertEqual(receipt.json()['order']['amount_paid'], 50)
        self.assertEqual(receipt.json()['order']['amount_due'], 150)
        self.admin.role = 'staff'
        self.db.commit()
        self.assertEqual(self.client.get(path + '/invoice').status_code, 200)
        self.assertEqual(self.client.get(path + '/receipt').status_code, 200)
        self.actor = self.customer
        self.assertEqual(self.client.get(path + '/invoice').status_code, 403)

    def test_unpaid_order_has_invoice_but_no_receipt(self):
        payload = self.order()
        payload['amount_paid'] = 0
        order_id = self.client.post('/api/press/orders', json=payload).json()['order_id']
        path = f'/api/press/orders/{order_id}/documents'
        self.assertEqual(self.client.get(path + '/invoice').status_code, 200)
        self.assertEqual(self.client.get(path + '/receipt').status_code, 409)
        self.assertEqual(self.client.get('/api/press/orders/99999/documents/invoice').status_code, 404)

    def test_portal_customer_create_edit_duplicate_and_delete(self):
        payload = dict(full_name="New account", email="new@test.local", password="safe-password")
        created = self.client.post('/api/admin/customers/account', json=payload)
        self.assertEqual(created.status_code, 201, created.text)
        path = f"/api/admin/customers/account/{created.json()['id']}"
        self.assertEqual(self.client.post('/api/admin/customers/account', json=payload).status_code, 409)
        updated = self.client.put(path, json={**payload, 'password': '', 'status': 'inactive'})
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()['status'], 'inactive')
        self.assertEqual(self.client.delete(path).status_code, 200)

    def test_multiple_products_share_stock_without_overdrawing(self):
        self.link(2)
        second = Product(name="Another A4 job", price=100, status="active")
        self.db.add(second)
        self.db.commit()
        self.client.put(f'/api/admin/inventory/products/{second.product_id}', json=[dict(item_id=self.item.item_id, quantity=4)])
        payload = self.order()
        payload['items'].append(dict(product_id=second.product_id, quantity=1))
        payload['expected_total'] = 200
        result = self.client.post('/api/press/orders', json=payload)
        self.assertEqual(result.status_code, 409, result.text)
        self.db.refresh(self.item)
        self.assertEqual(self.item.quantity_on_hand, 5)
        self.assertEqual(self.db.query(Order).count(), 0)

    def design_order(self, designs, quantity=2):
        return dict(request_key=str(uuid4()), items=[dict(product_id=self.product.product_id, quantity=quantity, designs=designs)],
            contact_phone='123456', expected_total=quantity * 100, payment_method='cash', payment_timing='after_pickup')

    def artwork(self, name='design.pdf'):
        return dict(name=name, data_url='data:application/pdf;base64,' + base64.b64encode(b'%PDF-1.4\nTest design').decode())

    def test_shared_design_is_attached_to_two_units(self):
        self.link()
        self.actor = self.customer
        payload = self.design_order([dict(quantity=2, file=self.artwork())])
        result = self.client.post('/api/customer/orders', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        data = result.json()
        self.assertEqual(data['items'][0]['designs'][0]['quantity'], 2)
        self.assertEqual(data['files'][0]['design_id'], data['items'][0]['designs'][0]['design_id'])
        self.assertEqual(data['payment_method'], 'cash')
        self.assertEqual(data['amount_paid'], 0)
        self.assertEqual(data['amount_due'], 200)
        self.assertEqual(self.client.post('/api/customer/orders', json=payload).status_code, 201)
        self.assertEqual(self.db.query(DesignFile).count(), 1)
        self.db.refresh(self.item)
        self.assertEqual(self.item.quantity_on_hand, 3)
        payload['items'][0]['designs'][0]['brief'] = 'Changed design'
        self.assertEqual(self.client.post('/api/customer/orders', json=payload).status_code, 409)

    def test_separate_design_files_and_staff_visibility(self):
        self.actor = self.customer
        payload = self.design_order([dict(quantity=1, file=self.artwork('front.pdf')), dict(quantity=1, file=self.artwork('other.pdf'))])
        result = self.client.post('/api/customer/orders', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        order = result.json()
        designs = order['items'][0]['designs']
        self.assertEqual([d['quantity'] for d in designs], [1, 1])
        self.assertEqual({f['design_id'] for f in order['files']}, {d['design_id'] for d in designs})
        self.actor = self.admin
        review = self.client.get('/api/press/orders').json()[0]
        self.assertEqual(review['items'][0]['designs'], designs)
        self.assertEqual(self.client.patch(f"/api/press/orders/{order['order_id']}", json={'production_stage':'Queued'}).status_code, 422)
        self.assertEqual(self.client.patch(f"/api/press/orders/{order['order_id']}", json={'production_stage':'Queued', 'approve_artwork':True}).status_code, 200)

    def test_design_quantities_and_missing_artwork_are_rejected(self):
        self.actor = self.customer
        for designs in [[dict(quantity=1, brief='Only covers one')], [dict(quantity=2)], [dict(quantity=0, brief='Zero')]]:
            result = self.client.post('/api/customer/orders', json=self.design_order(designs))
            self.assertEqual(result.status_code, 422, result.text)
        self.assertEqual(self.db.query(Order).count(), 0)

    def test_brief_only_and_file_design_can_mix(self):
        self.actor = self.customer
        result = self.client.post('/api/customer/orders', json=self.design_order([dict(quantity=1, brief='Design a blue logo'), dict(quantity=1, file=self.artwork())]))
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(len(result.json()['files']), 1)
        self.assertEqual(self.db.query(OrderItemDesign).count(), 2)

    def test_customer_whish_checkout_and_reference_are_disabled(self):
        self.actor = self.customer
        payload = self.design_order([dict(quantity=2, brief='Shared design')])
        self.assertEqual(self.client.post('/api/customer/orders', json={**payload, 'payment_method':'whish_money'}).status_code, 422)
        self.assertEqual(self.client.post('/api/customer/orders', json={**payload, 'payment_reference':'NEW123'}).status_code, 422)
        created = self.client.post('/api/customer/orders', json=payload)
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(self.client.post(f"/api/customer/orders/{created.json()['order_id']}/payment-reference", json={'reference':'NEW123'}).status_code, 409)
        self.assertEqual(self.db.query(OrderPayment).count(), 0)

    def test_combined_design_upload_limit_is_atomic(self):
        self.actor = self.customer
        file = dict(name='large.pdf', data_url='data:application/pdf;base64,' + base64.b64encode(b'%PDF-' + b'x' * (7 * 1024 * 1024)).decode())
        result = self.client.post('/api/customer/orders', json=self.design_order([dict(quantity=1, file=file) for _ in range(3)], quantity=3))
        self.assertEqual(result.status_code, 422, result.text)
        self.assertIn('20 MB', result.json()['detail'])
        self.assertEqual(self.db.query(Order).count(), 0)
        self.assertEqual(self.db.query(DesignFile).count(), 0)


if __name__ == '__main__':
    unittest.main()
