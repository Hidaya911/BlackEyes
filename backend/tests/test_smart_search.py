"""Isolated search authorization, schema, ranking and failure regressions."""
import os
os.environ["DATABASE_URL"] = "sqlite://"
import unittest
from datetime import date, datetime
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base, get_db
from main import app
from models import User, Product, Order, OrderItem, Vendor, VendorPurchase, InventoryItem
from sessions import current_user
from services.semantic_search import perform_semantic_search, SemanticSearchUnavailable, TOPICS
from services.search_intent import constrain_search


class Vector(list):
    def __matmul__(self, other):
        return sum(a * b for a, b in zip(self, other))


class SmartSearchTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.user = User(full_name='Operator', email='search@test.local', password_hash='unused', role='admin', status='active')
        self.product = Product(name='Business cards', description='Corporate stationery', price=1250, status='active')
        vendor = Vendor(name='Paper supplier')
        material = InventoryItem(name='Silk paper', type='paper', unit='sheet', quantity_on_hand=100, low_stock_threshold=5)
        self.db.add_all([self.user, self.product, vendor, material]); self.db.flush()
        order = Order(customer_id=self.user.user_id, customer_name='Ada', customer_email='ada@test.local', contact_phone='123', total_amount=25, request_key='search-order')
        self.db.add(order); self.db.flush()
        self.db.add(OrderItem(order_id=order.order_id, product_id=self.product.product_id, product_name='Business cards', custom_description='Blue foil', quantity=2, unit_price=12.5, subtotal=25))
        self.db.add(VendorPurchase(vendor_id=vendor.vendor_id, item_id=material.item_id, quantity=10, unit_price=2, cost=20, invoice_reference='SUP-42', purchase_date=date(2026, 1, 1), created_by=self.user.user_id, request_key='search-purchase'))
        self.db.commit()
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[current_user] = lambda: self.user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close(); app.dependency_overrides.clear(); self.db.close(); self.engine.dispose()

    def search(self, **params):
        return self.client.get('/api/search/semantic', params={'q': 'business printing', **params})

    @patch('routers.search.perform_semantic_search', side_effect=lambda query, items, **kw: items)
    def test_corpus_uses_real_fields_and_currency(self, search):
        response = self.search()
        self.assertEqual(response.status_code, 200, response.text)
        records = {r['record_type']: r for r in response.json()['results']}
        self.assertEqual(records['product']['amount'], 12.5)
        self.assertEqual(records['vendor_invoice']['amount'], 20)
        self.assertIn('SUP-42', records['vendor_invoice']['title'])
        self.assertIn('Blue foil', records['customer_invoice']['description'])
        self.assertEqual(records['customer_invoice']['amount'], 25)

    @patch('routers.search.perform_semantic_search', side_effect=lambda query, items, **kw: items)
    def test_roles_and_filters(self, search):
        self.user.role = 'staff'
        self.assertEqual(self.search().json()['searched_count'], 2)
        self.assertEqual(self.search(record_type='vendor_invoice').status_code, 403)
        self.assertEqual(self.search(record_type='product').json()['searched_count'], 1)
        self.user.role = 'customer'
        self.assertEqual(self.search().status_code, 403)

    def test_validation(self):
        for params in ({'q': '  '}, {'q': 'a'}, {'q': 'a' * 501}, {'limit': 101}, {'record_type': 'unknown'}):
            self.assertEqual(self.search(**params).status_code, 422)

    @patch('routers.search.perform_semantic_search', side_effect=SemanticSearchUnavailable('unavailable'))
    def test_model_failure(self, search):
        self.assertEqual(self.search().status_code, 503)

    def test_ranking_tags_threshold_and_no_mutation(self):
        items = [{'description': 'unrelated'}, {'description': 'business cards'}]
        vectors = [Vector([1, 0]), Vector([0, 1]), Vector([1, 0])] + [Vector([1, 0])] * len(TOPICS)
        with patch('services.semantic_search._embeddings', return_value=vectors):
            results = perform_semantic_search('stationery', items)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['description'], 'business cards')
        self.assertTrue(results[0]['tags'])
        self.assertNotIn('tags', items[1])
        self.assertEqual(perform_semantic_search('empty', []), [])

    def test_unauthenticated(self):
        del app.dependency_overrides[current_user]
        self.assertEqual(self.search().status_code, 401)

    def add_order(self, name, day, key, year=2026):
        order = Order(customer_id=self.user.user_id, customer_name=name, customer_email='buyer@test.local',
                      contact_phone='123', total_amount=25, request_key=key, created_at=datetime(year, 9, day, 14))
        self.db.add(order)
        self.db.flush()
        return order.order_id

    @patch('routers.search.perform_semantic_search', side_effect=AssertionError('Exact lookups must not need embeddings'))
    def test_customer_orders_are_complete_and_strict(self, semantic):
        expected = {self.add_order('Jana Smith', 16, 'jana-1'), self.add_order('Jana Smith', 18, 'jana-2')}
        self.add_order('Janan Smith', 16, 'other')
        for query in ['give me the orders of customer jana only', 'orders for Jana', 'orders of customer Jana Smith',
                      'can you show me Jana orders please']:
            response = self.search(q=query)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual({r['id'] for r in response.json()['results']}, expected)
            self.assertEqual(response.json()['matched_count'], 2)
        self.assertEqual(self.search(q='orders for Nobody').json()['results'], [])

    @patch('routers.search.perform_semantic_search', side_effect=AssertionError('Exact lookups must not need embeddings'))
    def test_dates_and_customer_constraints_intersect(self, semantic):
        expected = self.add_order('Jana Smith', 16, 'day-16')
        self.add_order('Jana Smith', 18, 'day-18')
        self.add_order('Jana Smith', 16, 'last-year', year=2025)
        self.add_order('Other customer', 16, 'other-customer')
        for value in ['16 September 2026', 'September 16, 2026', '2026-09-16', '16/09/2026']:
            response = self.search(q=f'orders for Jana on {value}')
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual([r['id'] for r in response.json()['results']], [expected])
        self.assertEqual(self.search(q='orders on 31 September 2026').status_code, 422)
        self.assertEqual(self.search(q='orders between 16 September and 18 September').status_code, 422)
        self.assertEqual(self.search(q='orders on 17 September 2026').json()['results'], [])
        item = {'record_type': 'customer_invoice', 'date': datetime(2026, 9, 16)}
        selected, _, filters, _ = constrain_search('orders on 16 september', [item], today=date(2026, 9, 25))
        self.assertEqual(selected, [item])
        self.assertIn('Date: 2026-09-16 (current year)', filters)

    @patch('routers.search.perform_semantic_search', side_effect=AssertionError('Price comparisons must not need embeddings'))
    def test_cheapest_uses_numeric_prices_and_active_products(self, semantic):
        cheap = Product(name='Plain paper', price=99, status='active')
        self.db.add_all([cheap, Product(name='Retired free sample', price=0, status='inactive'),
                         Product(name='Premium package', price=9000, status='active')])
        self.db.flush()
        response = self.search(q='i need the cheapest product').json()
        self.assertEqual(response['ordering'], 'price_min')
        self.assertEqual(response['results'][0]['id'], cheap.product_id)
        self.assertEqual([r['amount'] for r in response['results']], [0.99])
        self.assertEqual(response['matched_count'], 1)
        self.assertFalse(response['has_more'])
        self.assertTrue(all(r['record_type'] == 'product' for r in response['results']))
        self.assertIsNone(response['results'][0]['similarity_score'])
        highest = self.search(q='most expensive product').json()
        self.assertEqual([r['amount'] for r in highest['results']], [90])
        self.assertEqual(highest['ordering'], 'price_max')
        self.db.add(Product(name='Another cheap paper', price=99, status='active'))
        self.db.flush()
        tied = self.search(q='cheapest product').json()
        self.assertEqual([r['amount'] for r in tied['results']], [0.99, 0.99])

    @patch('routers.search.perform_semantic_search', side_effect=AssertionError('Vendor lookups must not use embeddings'))
    def test_vendor_name_and_date_are_hard_constraints(self, semantic):
        material = self.db.query(InventoryItem).first()
        expected = []
        for index, (name, day) in enumerate([('Cedar', 16), ('Cedar', 18), ('Cedars', 16), ('Other', 16)]):
            vendor = self.db.query(Vendor).filter_by(name=name).first()
            if vendor is None:
                vendor = Vendor(name=name)
                self.db.add(vendor)
                self.db.flush()
            purchase = VendorPurchase(vendor_id=vendor.vendor_id, item_id=material.item_id, quantity=1,
                                      unit_price=10, cost=10, invoice_reference=f'VEND-{index}',
                                      purchase_date=date(2026, 9, day), created_by=self.user.user_id,
                                      request_key=f'vendor-search-{index}')
            self.db.add(purchase)
            self.db.flush()
            if name == 'Cedar':
                expected.append(purchase.purchase_id)
        for query in ['invoices of vendor Cedar only', 'vendor Cedar invoices', 'supplier Cedar invoices',
                      'Cedar invoices', "Cedar's invoices"]:
            response = self.search(q=query)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual({r['id'] for r in response.json()['results']}, set(expected), query)
        for query in ['invoices from vendor Cedar on 16 September 2026',
                      'vendor Cedar invoices with date 2026-09-16',
                      'invoices for Cedar on September 16, 2026']:
            response = self.search(q=query, record_type='vendor_invoice')
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual([r['id'] for r in response.json()['results']], expected[:1], query)
        self.assertEqual(self.search(q='invoices for Cedar', record_type='vendor_invoice').json()['matched_count'], 2)
        self.assertEqual(self.search(q='invoices of vendor Missing').json()['results'], [])
        self.assertEqual(self.search(q='vendor Cedar invoices on 17 September 2026').json()['results'], [])
        self.user.role = 'staff'
        self.assertEqual(self.search(q='vendor Cedar invoices').json()['results'], [])
        self.assertEqual(self.search(q='Cedar invoices', record_type='vendor_invoice').status_code, 403)

    @patch('routers.search.perform_semantic_search', side_effect=AssertionError('Exact lookups must not need embeddings'))
    def test_pagination_does_not_drop_customer_orders(self, semantic):
        expected = {self.add_order('Jana', 16, f'page-{i}') for i in range(35)}
        first = self.search(q='orders for Jana').json()
        second = self.search(q='orders for Jana', offset=30).json()
        self.assertEqual(first['matched_count'], 35)
        self.assertTrue(first['has_more'])
        self.assertFalse(second['has_more'])
        self.assertEqual({r['id'] for r in first['results'] + second['results']}, expected)
        self.user.role = 'staff'
        self.assertEqual(self.search(q='vendor invoices').json()['results'], [])

    @patch('routers.search.perform_semantic_search', side_effect=lambda query, items, **kw: [{**r, 'tags': [], 'similarity_score': .8} for r in items])
    def test_descriptive_search_receives_only_constrained_records(self, semantic):
        expected = self.add_order('Jana', 16, 'semantic-jana')
        self.add_order('Other', 16, 'semantic-other')
        response = self.search(q='orders for Jana on 16 September 2026 about blue foil')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([r['id'] for r in response.json()['results']], [expected])
        self.assertEqual(semantic.call_args.args[0], 'blue foil')


if __name__ == '__main__':
    unittest.main()
