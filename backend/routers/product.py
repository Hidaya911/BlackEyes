"""Product API endpoints and request/response definitions."""

from typing import Literal
import base64
import os
import uuid
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from access import require_admin
from database import get_db
from models import OrderItem, Product

router = APIRouter()


class ProductRequest(BaseModel):
    admin_id: int
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    price: int = Field(ge=0)
    image_url: str | None = Field(default=None, max_length=2000000)
    status: Literal['active', 'retired'] = 'active'


class ProductResponse(BaseModel):
    product_id: int
    name: str
    description: str | None
    price: int
    image_url: str | None
    status: str


def store_product_image(value: str | None) -> str | None:
    if not value or not value.startswith('data:image/'):
        return value
    try:
        header, encoded = value.split(',', 1)
        mime = header.split(';')[0].split(':', 1)[1]
        extension = 'png' if mime == 'image/png' else 'jpg'
        bucket = os.getenv('SUPABASE_PRODUCT_BUCKET', 'product-images')
        project_url = os.environ['SUPABASE_URL'].rstrip('/')
        key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
        path = f'products/{uuid.uuid4().hex}.{extension}'
        request = Request(f'{project_url}/storage/v1/object/{bucket}/{path}', data=base64.b64decode(encoded), method='POST', headers={'Authorization': f'Bearer {key}', 'apikey': key, 'Content-Type': mime, 'x-upsert': 'false'})
        urlopen(request, timeout=30).read()
        return f'{project_url}/storage/v1/object/public/{bucket}/{path}'
    except Exception as error:
        raise HTTPException(status_code=502, detail=f'Image upload failed: {error}')


@router.get('/api/admin/products', response_model=list[ProductResponse])
def list_products(admin_id: int, db: Session=Depends(get_db)):
    require_admin(admin_id, db)
    return db.query(Product).order_by(Product.created_at.desc()).all()


@router.post('/api/admin/products', response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductRequest, db: Session=Depends(get_db)):
    require_admin(payload.admin_id, db)
    product = Product(name=payload.name.strip(), description=payload.description, price=payload.price, image_url=store_product_image(payload.image_url), status=payload.status)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put('/api/admin/products/{product_id}', response_model=ProductResponse)
def edit_product(product_id: int, payload: ProductRequest, db: Session=Depends(get_db)):
    require_admin(payload.admin_id, db)
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail='Product not found.')
    product.name = payload.name.strip()
    product.description = payload.description
    product.price = payload.price
    product.image_url = store_product_image(payload.image_url)
    product.status = payload.status
    db.commit()
    db.refresh(product)
    return product


@router.delete('/api/admin/products/{product_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, admin_id: int, db: Session=Depends(get_db)):
    require_admin(admin_id, db)
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail='Product not found.')
    if db.query(OrderItem).filter(OrderItem.product_id == product_id).first():
        raise HTTPException(status_code=409, detail='This product has orders. Retire it instead to preserve order history.')
    db.delete(product)
    db.commit()
