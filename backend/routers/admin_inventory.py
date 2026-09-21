"""Product recipes and current inventory alerts."""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from models import InventoryItem, Product, ProductMaterial
from routers.admin_customers import admin_session
from utilities.database import commit

router = APIRouter(prefix="/api/admin/inventory", tags=["Inventory"])


class MaterialInput(BaseModel):
    item_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)


@router.get("/alerts")
def alerts(admin=Depends(admin_session), db: Session = Depends(get_db)):
    return [dict(item_id=i.item_id, name=i.name, quantity=float(i.quantity_on_hand), unit=i.unit)
        for i in db.query(InventoryItem).filter(InventoryItem.quantity_on_hand <= InventoryItem.low_stock_threshold).order_by(InventoryItem.name).all()]


@router.get("")
def inventory(admin=Depends(admin_session), db: Session = Depends(get_db)):
    return {
        "items": [dict(item_id=i.item_id, name=i.name, unit=i.unit, quantity=float(i.quantity_on_hand),
            threshold=float(i.low_stock_threshold), low=i.quantity_on_hand <= i.low_stock_threshold)
            for i in db.query(InventoryItem).order_by(InventoryItem.name).all()],
        "products": [dict(product_id=p.product_id, name=p.name) for p in db.query(Product).order_by(Product.name).all()],
        "materials": [dict(product_id=m.product_id, item_id=m.item_id, quantity=float(m.quantity)) for m in db.query(ProductMaterial).all()]}


@router.put("/products/{product_id}")
def set_materials(product_id: int, payload: list[MaterialInput], admin=Depends(admin_session), db: Session = Depends(get_db)):
    if not payload:
        raise HTTPException(422, "Add a material and its quantity per product before saving.")
    if not db.query(Product).filter(Product.product_id == product_id).with_for_update().first():
        raise HTTPException(404, "Product not found.")
    ids = [m.item_id for m in payload]
    if len(ids) != len(set(ids)) or db.query(InventoryItem).filter(InventoryItem.item_id.in_(ids)).count() != len(ids):
        raise HTTPException(422, "Select distinct, existing inventory items.")
    db.query(ProductMaterial).filter(ProductMaterial.product_id == product_id).delete()
    for material in payload:
        db.add(ProductMaterial(product_id=product_id, **material.model_dump()))
    commit(db)
    return {"message": "Material usage saved. Applies to new orders only."}
