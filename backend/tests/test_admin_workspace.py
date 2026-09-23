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

    def test_product_customizable_setting_and_catalogs(self):
        payload = dict(admin_id=self.admin.user_id, name="Ready-made notebook", price=200,
                       wholesale_price=150, is_customizable=False)
        result = self.client.post('/api/admin/products', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        product_id = result.json()['product_id']
        self.assertFalse(result.json()['is_customizable'])
        catalog = self.client.get('/api/press/catalog').json()
        self.assertFalse(next(p for p in catalog if p['product_id'] == product_id)['is_customizable'])
        self.actor = self.customer
        catalog = self.client.get('/api/customer/products').json()
        self.assertFalse(next(p for p in catalog if p['product_id'] == product_id)['is_customizable'])
        self.actor = self.admin
        result = self.client.put(f'/api/admin/products/{product_id}', json={**payload, 'is_customizable': True})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertTrue(result.json()['is_customizable'])

    def test_standard_counter_order_needs_no_design(self):
        self.product.is_customizable = False
        self.db.commit()
        payload = self.order()
        payload['design_request_note'] = ''
        result = self.client.post('/api/press/orders', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        payload['request_key'] = str(uuid4())
        payload['items'][0]['specifications'] = 'Change the color'
        self.assertEqual(self.client.post('/api/press/orders', json=payload).status_code, 422)
        payload['items'][0]['specifications'] = ''
        self.product.is_customizable = True
        self.db.commit()
        self.assertEqual(self.client.post('/api/press/orders', json=payload).status_code, 422)

    def test_customer_standard_and_mixed_orders(self):
        self.product.is_customizable = False
        custom = Product(name="Custom mug", price=300, is_customizable=True)
        self.db.add(custom)
        self.db.commit()
        self.actor = self.customer
        payload = dict(request_key=str(uuid4()), items=[dict(product_id=self.product.product_id, quantity=2)],
                       expected_total=200, contact_phone="123456")
        result = self.client.post('/api/customer/orders', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(result.json()['items'][0]['designs'], [])
        payload['request_key'] = str(uuid4())
        payload['items'].append(dict(product_id=custom.product_id, quantity=1))
        payload['expected_total'] = 500
        self.assertEqual(self.client.post('/api/customer/orders', json=payload).status_code, 422)
        payload['items'][1]['designs'] = [dict(quantity=1, brief="Print a flower")]
        result = self.client.post('/api/customer/orders', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        payload['request_key'] = str(uuid4())
        payload['items'][0]['designs'] = [dict(quantity=2, brief="Change notebook cover")]
        self.assertEqual(self.client.post('/api/customer/orders', json=payload).status_code, 422)

    def test_product_customizable_migration_preserves_existing_products(self):
        from sqlalchemy import text
        from schemas.updates import apply_schema_updates
        engine = create_engine('sqlite://')
        try:
            with engine.begin() as connection:
                connection.execute(text('CREATE TABLE products (product_id INTEGER PRIMARY KEY, name TEXT)'))
                connection.execute(text("INSERT INTO products VALUES (1, 'Existing product')"))
            apply_schema_updates(engine)
            apply_schema_updates(engine)
            with engine.connect() as connection:
                self.assertEqual(connection.execute(text('SELECT is_customizable FROM products')).scalar(), 1)
        finally:
            engine.dispose()

    def test_wholesale_storefront_pricing_checkout_and_privacy(self):
        from models import CustomerSpecialPrice
        from decimal import Decimal
        buyer = User(full_name='Wholesale buyer', email='buyer@test.local', password_hash='unused',
                     role='wholesaler', status='active', phone='123456')
        self.product.wholesale_price = 60
        self.product.is_customizable = False
        self.db.add(buyer)
        self.db.flush()
        self.db.add(CustomerSpecialPrice(customer_id=buyer.user_id, product_id=self.product.product_id, special_price=Decimal('0.10'), set_by=self.admin.user_id))
        self.db.commit()
        public = self.client.get('/api/products')
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.json()[0]['price'], 100)
        self.assertNotIn('wholesale_price', public.text)
        self.actor = buyer
        catalog = self.client.get('/api/customer/products').json()
        self.assertEqual(catalog[0]['price'], 60)
        self.assertEqual(catalog[0]['price_kind'], 'wholesale')
        self.assertFalse(catalog[0]['special_price'])
        self.assertEqual(self.client.get('/api/customer/profile').json()['role'], 'wholesaler')
        payload = dict(request_key=str(uuid4()), items=[dict(product_id=self.product.product_id, quantity=2)], expected_total=200, contact_phone='123456')
        self.assertEqual(self.client.post('/api/customer/orders', json=payload).status_code, 409)
        payload['expected_total'] = 120
        result = self.client.post('/api/customer/orders', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(result.json()['total'], 120)
        self.assertEqual(len(self.client.get('/api/customer/orders').json()), 1)
        self.actor = self.customer
        self.assertEqual(self.client.get('/api/customer/orders').json(), [])
        self.assertEqual(self.client.get('/api/customer/products').json()[0]['price'], 100)
        self.actor = buyer
        self.product.wholesale_price = None
        self.db.commit()
        self.assertIsNone(self.client.get('/api/customer/products').json()[0]['price'])
        payload['request_key'] = str(uuid4())
        self.assertEqual(self.client.post('/api/customer/orders', json=payload).status_code, 422)

    def test_order_history_batches_queries_and_preserves_details(self):
        from sqlalchemy import event
        from services.order_details import order_response, order_responses
        for _ in range(3):
            self.assertEqual(self.client.post('/api/press/orders', json=self.order()).status_code, 201)
        orders = self.db.query(Order).order_by(Order.order_id.desc()).all()
        expected = [order_response(order, self.db) for order in orders]
        queries = []
        def count_queries(connection, cursor, statement, parameters, context, executemany):
            queries.append(statement)
        event.listen(self.engine, 'before_cursor_execute', count_queries)
        try:
            actual = order_responses(orders, self.db)
        finally:
            event.remove(self.engine, 'before_cursor_execute', count_queries)
        self.assertEqual(actual, expected)
        self.assertLessEqual(len(queries), 6)

    def test_vercel_startup_does_not_run_schema_queries(self):
        from unittest.mock import patch
        from main import startup
        with patch.dict(os.environ, {'VERCEL': '1'}), patch('main.Base.metadata.create_all') as create, patch('main.apply_schema_updates') as update:
            startup()
            create.assert_not_called()
            update.assert_not_called()

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

    def wholesale_registration(self):
        return dict(full_name='Wholesale Buyer', business_name='Print Shop', email='BUYER@example.com', phone='12345678', address='Beirut, Main Street', password='safe-password')

    def test_wholesale_registration_directory_and_permissions(self):
        from sessions import pwd_context
        payload = self.wholesale_registration()
        result = self.client.post('/api/wholesale/register', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        buyer = self.db.query(User).filter_by(email='buyer@example.com').one()
        self.assertEqual(buyer.role, 'wholesaler')
        self.assertEqual(buyer.business_name, 'Print Shop')
        self.assertTrue(pwd_context.verify(payload['password'], buyer.password_hash))
        self.assertNotIn('password', result.text)
        self.assertEqual(self.client.post('/api/wholesale/register', json=payload).status_code, 409)
        self.assertEqual(self.client.post('/api/wholesale/register', json={**payload, 'email':'second@example.com', 'role':'admin'}).status_code, 422)
        for change in [dict(email='bad-email'), dict(phone=' '), dict(business_name=' '), dict(password='short')]:
            self.assertEqual(self.client.post('/api/wholesale/register', json={**payload, **change}).status_code, 422)
        listing = self.client.get('/api/admin/customers').json()
        self.assertEqual(next(c for c in listing if c['id'] == buyer.user_id and c['kind'] == 'account')['role'], 'wholesaler')
        self.admin.role = 'staff'
        self.db.commit()
        directory = self.client.get('/api/press/customers/directory')
        self.assertEqual(directory.status_code, 200)
        self.assertIn('Print Shop', directory.text)
        self.assertNotIn('password_hash', directory.text)
        self.assertEqual(self.client.delete(f'/api/admin/customers/account/{buyer.user_id}').status_code, 403)
        self.actor = buyer
        self.assertEqual(self.client.get('/api/press/customers/directory').status_code, 403)
        login = self.client.post('/api/auth/login', json=dict(email=payload['email'], password=payload['password']))
        self.assertEqual(login.status_code, 200, login.text)
        self.assertEqual(login.json()['role'], 'wholesaler')
        self.assertEqual(self.client.get('/api/customer/orders').status_code, 200)

    def test_product_retail_and_wholesale_prices(self):
        payload = dict(admin_id=self.admin.user_id, name='Business cards', price=2000, wholesale_price=1500)
        created = self.client.post('/api/admin/products', json=payload)
        self.assertEqual(created.status_code, 201, created.text)
        product_id = created.json()['product_id']
        self.assertEqual(created.json()['price'], 2000)
        self.assertEqual(created.json()['wholesale_price'], 1500)
        updated = self.client.put(f'/api/admin/products/{product_id}', json={**payload, 'wholesale_price':1250})
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()['wholesale_price'], 1250)
        self.assertEqual(updated.json()['price'], 2000)
        self.assertEqual(self.client.post('/api/admin/products', json={**payload, 'wholesale_price':-1}).status_code, 422)
        self.assertEqual(self.client.post('/api/admin/products', json={k:v for k,v in payload.items() if k != 'wholesale_price'}).status_code, 422)
        self.product.wholesale_price = 40
        self.db.commit()
        order = self.client.post('/api/press/orders', json=self.order())
        self.assertEqual(order.status_code, 201, order.text)
        self.assertEqual(order.json()['total'], 100)

    def test_wholesale_schema_upgrade_is_repeatable(self):
        from sqlalchemy import text, inspect
        from schemas import apply_schema_updates
        engine = create_engine('sqlite://')
        try:
            with engine.begin() as connection:
                connection.execute(text('CREATE TABLE users (user_id INTEGER PRIMARY KEY, role VARCHAR)'))
                connection.execute(text('CREATE TABLE products (product_id INTEGER PRIMARY KEY, price INTEGER)'))
                connection.execute(text('INSERT INTO products VALUES (1, 100)'))
            apply_schema_updates(engine)
            apply_schema_updates(engine)
            self.assertIn('business_name', {c['name'] for c in inspect(engine).get_columns('users')})
            with engine.connect() as connection:
                row = connection.execute(text('SELECT price, wholesale_price FROM products')).one()
                self.assertEqual(tuple(row), (100, None))
        finally:
            engine.dispose()

    def test_counter_catalog_wholesale_and_overrides(self):
        self.client.post('/api/wholesale/register', json=self.wholesale_registration())
        buyer = self.db.query(User).filter_by(email='buyer@example.com').one()
        self.product.wholesale_price = 60
        self.product.description = 'A4 color printing'
        self.product.image_url = '/images/a4.png'
        self.db.commit()
        self.link()
        self.admin.role = 'staff'
        self.db.commit()
        matches = self.client.get('/api/press/customers?q=Print%20Shop').json()
        self.assertEqual(matches[0]['role'], 'wholesaler')
        catalog = self.client.get(f'/api/press/catalog?customer_id={buyer.user_id}').json()[0]
        self.assertEqual(catalog['price'], 60)
        self.assertEqual(catalog['price_kind'], 'wholesale')
        self.assertEqual(catalog['image_url'], '/images/a4.png')
        self.assertEqual(self.client.get('/api/press/catalog').json()[0]['price'], 100)
        payload = {**self.order(2), 'customer_id':buyer.user_id, 'expected_total':120, 'amount_paid':0}
        created = self.client.post('/api/press/orders', json=payload)
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(created.json()['total'], 120)
        self.assertEqual(self.client.get(f'/api/press/customer-ledger/account/{buyer.user_id}').json()['due'], 120)
        override = {**payload, 'request_key':str(uuid4()), 'expected_total':100, 'items':[dict(product_id=self.product.product_id, quantity=2, unit_price=50, specifications='Double sided, matte')]}
        result = self.client.post('/api/press/orders', json=override)
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(result.json()['items'][0]['unit_price'], 50)
        self.assertEqual(result.json()['items'][0]['specifications'], 'Double sided, matte')
        self.assertEqual(self.client.post('/api/press/orders', json=override).status_code, 201)
        self.db.refresh(self.item)
        self.db.refresh(self.product)
        self.assertEqual(self.item.quantity_on_hand, 1)
        self.assertEqual(self.product.price, 100)
        self.assertEqual(self.product.wholesale_price, 60)

    def test_counter_missing_wholesale_price_and_override_validation(self):
        self.client.post('/api/wholesale/register', json=self.wholesale_registration())
        buyer = self.db.query(User).filter_by(email='buyer@example.com').one()
        payload = {**self.order(), 'customer_id':buyer.user_id, 'amount_paid':0}
        self.assertIsNone(self.client.get(f'/api/press/catalog?customer_id={buyer.user_id}').json()[0]['price'])
        self.assertEqual(self.client.post('/api/press/orders', json=payload).status_code, 422)
        for price in [-1, 1.5, 100000000]:
            invalid = {**payload, 'items':[dict(product_id=self.product.product_id, quantity=1, unit_price=price)]}
            self.assertEqual(self.client.post('/api/press/orders', json=invalid).status_code, 422)
        zero = {**payload, 'expected_total':0, 'items':[dict(product_id=self.product.product_id, quantity=1, unit_price=0)]}
        self.assertEqual(self.client.post('/api/press/orders', json=zero).status_code, 201)
        normal_override = {**self.order(), 'items':[dict(product_id=self.product.product_id, quantity=1, unit_price=80)], 'expected_total':80}
        self.assertEqual(self.client.post('/api/press/orders', json=normal_override).status_code, 201)
        stale = {**self.order(), 'expected_total':90}
        self.assertEqual(self.client.post('/api/press/orders', json=stale).status_code, 409)
        self.actor = buyer
        self.assertEqual(self.client.post('/api/press/orders', json=normal_override).status_code, 403)

    def test_signup_and_admin_contacts_reach_directories(self):
        contact = dict(full_name='Contact Test', email='contact@test.local', password='safe-password', phone='+961 71 123456', address='Beirut, Test Street')
        registered = self.client.post('/api/auth/signup', json=contact)
        self.assertEqual(registered.status_code, 201, registered.text)
        account_id = registered.json()['user_id']
        for field in ('phone', 'address'):
            self.assertEqual(registered.json()[field], contact[field])
        created = self.client.post('/api/admin/customers/account', json={**contact, 'email':'admin-contact@test.local'})
        self.assertEqual(created.status_code, 201, created.text)
        admin_id = created.json()['id']
        for endpoint in ['/api/admin/customers', '/api/press/customers/directory', '/api/press/customers?q=Contact']:
            rows = self.client.get(endpoint).json()
            for identity in (account_id, admin_id):
                row = next(r for r in rows if r['kind'] == 'account' and r['id'] == identity)
                self.assertEqual(row['phone'], contact['phone'])
                self.assertEqual(row['address'], contact['address'])
        updated = self.client.put(f'/api/admin/customers/account/{admin_id}', json=dict(full_name='Renamed', email='admin-contact@test.local'))
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()['phone'], contact['phone'])
        self.assertEqual(updated.json()['address'], contact['address'])
        self.actor = self.db.get(User, account_id)
        profile = self.client.put('/api/customer/profile', json=dict(full_name='Renamed', email=contact['email']))
        self.assertEqual(profile.status_code, 200, profile.text)
        self.assertEqual(profile.json()['phone'], contact['phone'])
        self.assertEqual(profile.json()['address'], contact['address'])
        cleared = self.client.put('/api/customer/profile', json=dict(full_name='Renamed', email=contact['email'], phone='', address=''))
        self.assertIsNone(cleared.json()['phone'])
        self.assertIsNone(cleared.json()['address'])

    def test_order_contacts_snapshot_and_legacy_display(self):
        self.customer.address = 'Saved address'
        self.db.commit()
        self.actor = self.customer
        created = self.client.post('/api/customer/orders', json=self.design_order([dict(quantity=2, brief='Print this')]))
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(created.json()['customer_address'], 'Saved address')
        order = self.db.get(Order, created.json()['order_id'])
        order.customer_address = None
        order.contact_phone = ''
        self.db.commit()
        self.actor = self.admin
        document = self.client.get(f'/api/press/orders/{order.order_id}/documents/invoice').json()['order']
        self.assertEqual(document['customer_address'], 'Saved address')
        self.assertEqual(document['contact_phone'], self.customer.phone)
        self.db.refresh(order)
        self.assertIsNone(order.customer_address)
        order.customer_address = 'Original order address'
        order.contact_phone = '999999'
        self.db.commit()
        displayed = self.client.get('/api/press/orders').json()[0]
        self.assertEqual(displayed['customer_address'], 'Original order address')
        self.assertEqual(displayed['contact_phone'], '999999')

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
