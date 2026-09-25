"""Role-scoped semantic search over catalog and historical invoices."""
from collections import defaultdict
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, load_only
from access import require_operator
from database import get_db
from models import Product, VendorPurchase, Vendor, InventoryItem, Order, OrderItem, User
from services.semantic_search import perform_semantic_search, SemanticSearchUnavailable
from services.search_intent import constrain_search

router = APIRouter(prefix="/api/search", tags=["Semantic Search"])


@router.get("/semantic")
def unified_semantic_search(
    q: str = Query(..., min_length=2, max_length=500),
    record_type: Literal["all", "product", "customer_invoice", "vendor_invoice"] = "all",
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    operator: User = Depends(require_operator),
    db: Session = Depends(get_db),
):
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(422, "Enter at least two non-space characters.")
    if record_type == "vendor_invoice" and operator.role != "admin":
        raise HTTPException(403, "Vendor invoices require administrator access.")

    # Each item has:
    #   search_text -> ONLY meaningful content, this is what gets embedded
    #   title/description/amount/status/date -> display fields returned to the UI
    items = []

    if record_type in {"all", "product"}:
        products = db.query(Product).options(
            load_only(Product.product_id, Product.name, Product.description,
                      Product.status, Product.price, Product.created_at)
        ).all()
        for p in products:
            items.append(dict(
                record_type="product",
                id=p.product_id,
                title=p.name,
                search_text=f"{p.name}. {p.description or ''}".strip(),
                description=p.description or "",
                amount=p.price / 100,
                status=p.status,
                date=p.created_at,
            ))

    if record_type in {"all", "customer_invoice"}:
        details = defaultdict(list)
        for item in db.query(OrderItem).all():
            details[item.order_id].append(
                f"{item.product_name}: {item.custom_description or ''}".strip()
            )
        for order in db.query(Order).all():
            number = f"INV-{order.order_id:06d}"
            lines = "; ".join(details[order.order_id])
            items.append(dict(
                record_type="customer_invoice",
                id=order.order_id,
                title=f"{number} · {order.customer_name}",
                customer_name=order.customer_name,
                search_text=f"{order.customer_name}. {lines}. {order.design_request_note or ''}".strip(),
                description=lines,
                amount=float(order.total_amount),
                status=order.payment_status,
                date=order.created_at,
            ))

    if operator.role == "admin" and record_type in {"all", "vendor_invoice"}:
        purchases = (
            db.query(VendorPurchase, Vendor.name, InventoryItem.name)
            .join(Vendor, Vendor.vendor_id == VendorPurchase.vendor_id)
            .join(InventoryItem, InventoryItem.item_id == VendorPurchase.item_id)
            .all()
        )
        for purchase, vendor, material in purchases:
            reference = purchase.invoice_reference or f"#{purchase.purchase_id}"
            items.append(dict(
                record_type="vendor_invoice",
                id=purchase.purchase_id,
                title=f"{reference} · {vendor}",
                vendor_name=vendor,
                search_text=f"{vendor}. {material}",
                description=f"{material} (quantity {purchase.quantity})",
                amount=float(purchase.cost),
                status="Purchased",
                date=purchase.purchase_date,
            ))

    try:
        candidates, residual, filters, price_order = constrain_search(query, items, record_type=record_type)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    try:
        if filters and not residual:
            results = [{**item, 'similarity_score': None, 'tags': []} for item in candidates]
        else:
            results = perform_semantic_search(residual or query, candidates, top_k=len(candidates))
    except SemanticSearchUnavailable as exc:
        raise HTTPException(
            503,
            "Smart Search is temporarily unavailable. Ask your administrator to check the local search model, then retry.",
        ) from exc

    ordering = price_order or ('date_desc' if filters and not residual else 'relevance')
    if price_order:
        if results:
            extreme = (min if price_order == 'price_min' else max)(item['amount'] for item in results)
            results = [item for item in results if item['amount'] == extreme]
            results.sort(key=lambda item: item['id'])
    elif ordering == 'date_desc':
        results.sort(key=lambda item: (str(item.get('date') or ''), item['id']), reverse=True)
    matched_count = len(results)
    results = results[offset:offset + limit]
    # Internal fields are not part of the public result schema.
    for r in results:
        r.pop("search_text", None)
        r.pop('customer_name', None)
        r.pop('vendor_name', None)

    return {"query": query, "results": results, "searched_count": len(items), "limit": limit,
            'offset': offset, 'matched_count': matched_count, 'has_more': offset + len(results) < matched_count,
            'filters': filters, 'ordering': ordering}
