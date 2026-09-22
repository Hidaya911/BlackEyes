"""Model registry: importing this package registers every database table."""

from database import Base
from .user import User
from .session import UserSession
from .vendor import Vendor
from .product import Product
from .inventory import InventoryItem, InventoryTransaction
from .purchase import VendorPurchase
from .payment import VendorPayment, OrderPayment
from .customer_price import CustomerSpecialPrice
from .order import Order, OrderItem
from .design_file import DesignFile
from .job_status import JobStatusHistory
from .customer import WalkInCustomer
from .product_material import ProductMaterial
from .order_design import OrderItemDesign
from .customer_payment import CustomerPayment

__all__ = [
    "Base",
    "User",
    "UserSession",
    "Vendor",
    "Product",
    "InventoryItem",
    "InventoryTransaction",
    "VendorPurchase",
    "VendorPayment",
    "OrderPayment",
    "CustomerPayment",
    "CustomerSpecialPrice",
    "Order",
    "OrderItem",
    "DesignFile",
    "JobStatusHistory",
    "WalkInCustomer",
]
