"""Initial schema baseline

Revision ID: 0001
Revises: 
"""
from alembic import op
import sqlalchemy as sa


revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Frozen baseline: future changes belong in new revisions.
    op.create_table('inventory_items',
    sa.Column('item_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('unit', sa.String(length=30), nullable=False),
    sa.Column('quantity_on_hand', sa.Numeric(precision=14, scale=3), nullable=False),
    sa.Column('low_stock_threshold', sa.Numeric(precision=14, scale=3), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.CheckConstraint('low_stock_threshold >= 0', name='ck_inventory_threshold'),
    sa.CheckConstraint('quantity_on_hand >= 0', name='ck_inventory_quantity'),
    sa.PrimaryKeyConstraint('item_id')
    )
    op.create_index('uq_inventory_identity', 'inventory_items',
                    [sa.text('lower(name)'), 'type', sa.text('lower(unit)')], unique=True)
    op.create_table('products',
    sa.Column('product_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=True),
    sa.Column('price', sa.Integer(), nullable=False),
    sa.Column('wholesale_price', sa.Integer(), nullable=True),
    sa.Column('image_url', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('is_customizable', sa.Boolean(), server_default=sa.true(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.PrimaryKeyConstraint('product_id')
    )
    op.create_index(op.f('ix_products_product_id'), 'products', ['product_id'], unique=False)
    op.create_table('users',
    sa.Column('user_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('full_name', sa.String(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('password_hash', sa.String(), nullable=False),
    sa.Column('role', sa.String(), nullable=False),
    sa.Column('business_name', sa.String(length=255), nullable=True),
    sa.Column('phone', sa.String(), nullable=True),
    sa.Column('address', sa.String(), nullable=True),
    sa.Column('profile_image', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_user_id'), 'users', ['user_id'], unique=False)
    op.create_table('vendors',
    sa.Column('vendor_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('phone', sa.String(length=50), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.PrimaryKeyConstraint('vendor_id')
    )
    op.create_index(op.f('ix_vendors_vendor_id'), 'vendors', ['vendor_id'], unique=False)
    op.create_table('customer_special_prices',
    sa.Column('special_price_id', sa.Integer(), nullable=False),
    sa.Column('customer_id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('special_price', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('set_by', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.CheckConstraint('special_price >= 0', name='ck_special_price'),
    sa.ForeignKeyConstraint(['customer_id'], ['users.user_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['products.product_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['set_by'], ['users.user_id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('special_price_id'),
    sa.UniqueConstraint('customer_id', 'product_id', name='uq_customer_product_price')
    )
    op.create_table('product_materials',
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('quantity', sa.Numeric(precision=14, scale=3), nullable=False),
    sa.CheckConstraint('quantity > 0', name='ck_product_material_quantity'),
    sa.ForeignKeyConstraint(['item_id'], ['inventory_items.item_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['product_id'], ['products.product_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('product_id', 'item_id')
    )
    op.create_table('user_sessions',
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('token_hash')
    )
    op.create_index(op.f('ix_user_sessions_user_id'), 'user_sessions', ['user_id'], unique=False)
    op.create_table('vendor_orders',
    sa.Column('order_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('vendor_id', sa.Integer(), nullable=False),
    sa.Column('purchase_date', sa.Date(), nullable=False),
    sa.Column('invoice_reference', sa.String(length=100), nullable=True),
    sa.Column('created_by', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.user_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.vendor_id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('order_id')
    )
    op.create_index(op.f('ix_vendor_orders_vendor_id'), 'vendor_orders', ['vendor_id'], unique=False)
    op.create_table('walk_in_customers',
    sa.Column('customer_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('phone', sa.String(length=50), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('address', sa.String(length=500), nullable=True),
    sa.Column('created_by', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.user_id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('customer_id')
    )
    op.create_index(op.f('ix_walk_in_customers_full_name'), 'walk_in_customers', ['full_name'], unique=False)
    op.create_index(op.f('ix_walk_in_customers_phone'), 'walk_in_customers', ['phone'], unique=False)
    op.create_table('orders',
    sa.Column('order_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('customer_id', sa.Integer(), nullable=True),
    sa.Column('walk_in_customer_id', sa.Integer(), nullable=True),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('customer_address', sa.String(length=500), nullable=True),
    sa.Column('request_fingerprint', sa.String(length=64), nullable=True),
    sa.Column('staff_id', sa.Integer(), nullable=True),
    sa.Column('order_type', sa.String(length=20), nullable=False),
    sa.Column('design_request_note', sa.String(length=4000), nullable=True),
    sa.Column('production_stage', sa.String(length=40), nullable=False),
    sa.Column('is_rush', sa.Boolean(), nullable=False),
    sa.Column('rush_fee', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('total_amount', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('payment_status', sa.String(length=30), nullable=False),
    sa.Column('payment_method', sa.String(length=30), nullable=False),
    sa.Column('payment_timing', sa.String(length=20), nullable=False),
    sa.Column('contact_phone', sa.String(length=50), nullable=False),
    sa.Column('customer_name', sa.String(length=255), nullable=False),
    sa.Column('customer_email', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('request_key', sa.String(length=36), nullable=False),
    sa.CheckConstraint('(customer_id IS NOT NULL AND walk_in_customer_id IS NULL) OR (customer_id IS NULL AND walk_in_customer_id IS NOT NULL)', name='ck_order_customer_identity'),
    sa.CheckConstraint('total_amount >= 0', name='ck_order_total'),
    sa.ForeignKeyConstraint(['created_by'], ['users.user_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['customer_id'], ['users.user_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['staff_id'], ['users.user_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['walk_in_customer_id'], ['walk_in_customers.customer_id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('order_id'),
    sa.UniqueConstraint('request_key')
    )
    op.create_index(op.f('ix_orders_customer_id'), 'orders', ['customer_id'], unique=False)
    op.create_table('vendor_purchases',
    sa.Column('purchase_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=True),
    sa.Column('vendor_id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('quantity', sa.Numeric(precision=14, scale=3), nullable=False),
    sa.Column('unit_price', sa.Numeric(precision=18, scale=6), nullable=False),
    sa.Column('cost', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('invoice_reference', sa.String(length=100), nullable=True),
    sa.Column('purchase_date', sa.Date(), nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('request_key', sa.String(length=36), nullable=False),
    sa.CheckConstraint('quantity > 0', name='ck_purchase_quantity'),
    sa.CheckConstraint('unit_price >= 0 AND cost >= 0', name='ck_purchase_cost'),
    sa.ForeignKeyConstraint(['created_by'], ['users.user_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['item_id'], ['inventory_items.item_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['order_id'], ['vendor_orders.order_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.vendor_id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('purchase_id'),
    sa.UniqueConstraint('request_key')
    )
    op.create_index(op.f('ix_vendor_purchases_order_id'), 'vendor_purchases', ['order_id'], unique=False)
    op.create_index(op.f('ix_vendor_purchases_vendor_id'), 'vendor_purchases', ['vendor_id'], unique=False)
    op.create_table('customer_payment_transactions',
    sa.Column('transaction_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('method', sa.String(length=30), nullable=False),
    sa.Column('reference', sa.String(length=100), nullable=True),
    sa.Column('note', sa.String(length=1000), nullable=True),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('recorded_by', sa.Integer(), nullable=True),
    sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('request_key', sa.String(length=100), nullable=False),
    sa.Column('request_fingerprint', sa.String(length=64), nullable=True),
    sa.CheckConstraint('amount > 0', name='ck_customer_receipt_positive'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.order_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['recorded_by'], ['users.user_id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('transaction_id'),
    sa.UniqueConstraint('request_key')
    )
    op.create_index(op.f('ix_customer_payment_transactions_order_id'), 'customer_payment_transactions', ['order_id'], unique=False)
    op.create_table('inventory_transactions',
    sa.Column('transaction_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('purchase_id', sa.Integer(), nullable=True),
    sa.Column('order_id', sa.Integer(), nullable=True),
    sa.Column('movement_type', sa.String(length=20), nullable=False),
    sa.Column('quantity', sa.Numeric(precision=14, scale=3), nullable=False),
    sa.Column('changed_by', sa.Integer(), nullable=False),
    sa.Column('transaction_date', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.CheckConstraint('quantity > 0', name='ck_stock_movement_quantity'),
    sa.ForeignKeyConstraint(['changed_by'], ['users.user_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['item_id'], ['inventory_items.item_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['purchase_id'], ['vendor_purchases.purchase_id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('transaction_id'),
    sa.UniqueConstraint('purchase_id')
    )
    op.create_index(op.f('ix_inventory_transactions_item_id'), 'inventory_transactions', ['item_id'], unique=False)
    op.create_table('job_status_history',
    sa.Column('history_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('changed_by', sa.Integer(), nullable=False),
    sa.Column('stage', sa.String(length=40), nullable=False),
    sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['changed_by'], ['users.user_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.order_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('history_id')
    )
    op.create_index(op.f('ix_job_status_history_order_id'), 'job_status_history', ['order_id'], unique=False)
    op.create_table('order_items',
    sa.Column('order_item_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=True),
    sa.Column('product_name', sa.String(length=255), nullable=False),
    sa.Column('custom_description', sa.String(length=2000), nullable=True),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('unit_price', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('subtotal', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.CheckConstraint('quantity > 0', name='ck_order_item_quantity'),
    sa.CheckConstraint('unit_price >= 0 AND subtotal >= 0', name='ck_order_item_price'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.order_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['products.product_id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('order_item_id')
    )
    op.create_index(op.f('ix_order_items_order_id'), 'order_items', ['order_id'], unique=False)
    op.create_table('payments',
    sa.Column('payment_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('remaining', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('method', sa.String(length=30), nullable=False),
    sa.Column('reference', sa.String(length=100), nullable=True),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('payment_date', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('confirmed_by', sa.Integer(), nullable=True),
    sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint('amount >= 0 AND remaining >= 0', name='ck_order_payment_amount'),
    sa.ForeignKeyConstraint(['confirmed_by'], ['users.user_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.order_id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('payment_id'),
    sa.UniqueConstraint('order_id'),
    sa.UniqueConstraint('reference')
    )
    op.create_table('vendor_payments',
    sa.Column('vendor_payment_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_payment_key', sa.String(length=36), nullable=True),
    sa.Column('purchase_id', sa.Integer(), nullable=False),
    sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('method', sa.String(length=20), nullable=False),
    sa.Column('payment_date', sa.Date(), nullable=False),
    sa.Column('reference', sa.String(length=100), nullable=True),
    sa.Column('recorded_by', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('request_key', sa.String(length=36), nullable=False),
    sa.CheckConstraint('amount > 0', name='ck_vendor_payment_amount'),
    sa.ForeignKeyConstraint(['purchase_id'], ['vendor_purchases.purchase_id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['recorded_by'], ['users.user_id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('vendor_payment_id'),
    sa.UniqueConstraint('request_key')
    )
    op.create_index(op.f('ix_vendor_payments_order_payment_key'), 'vendor_payments', ['order_payment_key'], unique=False)
    op.create_index(op.f('ix_vendor_payments_purchase_id'), 'vendor_payments', ['purchase_id'], unique=False)
    op.create_table('order_item_designs',
    sa.Column('design_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_item_id', sa.Integer(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('brief', sa.String(length=4000), nullable=False),
    sa.CheckConstraint('quantity > 0', name='ck_order_design_quantity'),
    sa.ForeignKeyConstraint(['order_item_id'], ['order_items.order_item_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('design_id')
    )
    op.create_index(op.f('ix_order_item_designs_order_item_id'), 'order_item_designs', ['order_item_id'], unique=False)
    op.create_table('design_files',
    sa.Column('file_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('design_id', sa.Integer(), nullable=True),
    sa.Column('file_path', sa.String(length=100), nullable=False),
    sa.Column('original_name', sa.String(length=255), nullable=False),
    sa.Column('content_type', sa.String(length=50), nullable=False),
    sa.Column('size', sa.Integer(), nullable=False),
    sa.Column('content', sa.LargeBinary(), nullable=False),
    sa.Column('verification_status', sa.String(length=20), nullable=False),
    sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['design_id'], ['order_item_designs.design_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.order_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('file_id'),
    sa.UniqueConstraint('file_path')
    )
    op.create_index(op.f('ix_design_files_order_id'), 'design_files', ['order_id'], unique=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_design_files_order_id'), table_name='design_files')
    op.drop_table('design_files')
    op.drop_index(op.f('ix_order_item_designs_order_item_id'), table_name='order_item_designs')
    op.drop_table('order_item_designs')
    op.drop_index(op.f('ix_vendor_payments_purchase_id'), table_name='vendor_payments')
    op.drop_index(op.f('ix_vendor_payments_order_payment_key'), table_name='vendor_payments')
    op.drop_table('vendor_payments')
    op.drop_table('payments')
    op.drop_index(op.f('ix_order_items_order_id'), table_name='order_items')
    op.drop_table('order_items')
    op.drop_index(op.f('ix_job_status_history_order_id'), table_name='job_status_history')
    op.drop_table('job_status_history')
    op.drop_index(op.f('ix_inventory_transactions_item_id'), table_name='inventory_transactions')
    op.drop_table('inventory_transactions')
    op.drop_index(op.f('ix_customer_payment_transactions_order_id'), table_name='customer_payment_transactions')
    op.drop_table('customer_payment_transactions')
    op.drop_index(op.f('ix_vendor_purchases_vendor_id'), table_name='vendor_purchases')
    op.drop_index(op.f('ix_vendor_purchases_order_id'), table_name='vendor_purchases')
    op.drop_table('vendor_purchases')
    op.drop_index(op.f('ix_orders_customer_id'), table_name='orders')
    op.drop_table('orders')
    op.drop_index(op.f('ix_walk_in_customers_phone'), table_name='walk_in_customers')
    op.drop_index(op.f('ix_walk_in_customers_full_name'), table_name='walk_in_customers')
    op.drop_table('walk_in_customers')
    op.drop_index(op.f('ix_vendor_orders_vendor_id'), table_name='vendor_orders')
    op.drop_table('vendor_orders')
    op.drop_index(op.f('ix_user_sessions_user_id'), table_name='user_sessions')
    op.drop_table('user_sessions')
    op.drop_table('product_materials')
    op.drop_table('customer_special_prices')
    op.drop_index(op.f('ix_vendors_vendor_id'), table_name='vendors')
    op.drop_table('vendors')
    op.drop_index(op.f('ix_users_user_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_products_product_id'), table_name='products')
    op.drop_table('products')
    op.drop_table('inventory_items')
    # ### end Alembic commands ###
