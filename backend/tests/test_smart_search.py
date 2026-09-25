"""Isolated search authorization, schema, ranking and failure regressions."""
import os
os.environ["DATABASE_URL"] = "sqlite://"
import unittest
from datetime import date
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


if __name__ == '__main__':
    unittest.main()
