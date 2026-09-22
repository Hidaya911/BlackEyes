# from fastapi import APIRouter, Depends, Query
# from sqlalchemy.orm import Session
# from database import get_db
# from models import Product, VendorPurchase, OrderItem  # Add your Order model here if you have one
# from services.semantic_search import perform_semantic_search

# router = APIRouter(prefix="/api/search", tags=["Semantic Search"])

# @router.get("/semantic")
# def unified_semantic_search(
#     q: str = Query(..., min_length=2, description="Natural language search query"),
#     db: Session = Depends(get_db)
# ):
#     corpus_items = []

#     # 1. Fetch and format Products
#     products = db.query(Product).all()
#     for p in products:
#         corpus_items.append({
#             "record_type": "product",
#             "id": p.product_id,
#             "title": p.name,
#             "description": f"Product: {p.name}. Description: {p.description or 'No description'}. Status: {p.status}.",
#             "price": p.price
#         })

#     # 2. Fetch and format Historical Vendor Purchases / Invoices
#     purchases = db.query(VendorPurchase).all()
#     for vp in purchases:
#         corpus_items.append({
#             "record_type": "vendor_invoice",
#             "id": vp.purchase_id,
#             "title": f"Vendor Invoice #{vp.purchase_id}",
#             "description": f"Vendor purchase invoice. Notes: {vp.notes or 'None'}. Total: {vp.total_amount}.",
#         })

#     # 3. Fetch and format Customer Invoices / Orders
#     # (Assuming you have an Order or OrderItem model, adjust fields to match your models)
#     order_items = db.query(OrderItem).all()
#     for item in order_items:
#         corpus_items.append({
#             "record_type": "customer_invoice",
#             "id": item.order_item_id if hasattr(item, 'order_item_id') else item.id,
#             "title": f"Customer Order Item #{item.product_id}",
#             "description": f"Customer order invoice item. Quantity: {item.quantity}. Price: {item.price}.",
#         })

#     # 4. Perform semantic search across the entire combined corpus
#     matched_results = perform_semantic_search(
#         query=q, 
#         items=corpus_items, 
#         text_key="description", 
#         top_k=5
#     )
# # 
#     return {
#         "query": q,
#         "results": matched_results
#     }