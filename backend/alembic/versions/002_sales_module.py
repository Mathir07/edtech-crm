"""Sales module schema: products, quotations, contracts, orders

Revision ID: 002_sales_module
Revises: 001_initial_schema
Create Date: 2026-09-18 21:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002_sales_module'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return insp.has_table(table_name)


def upgrade() -> None:
    # 1. Product Categories
    if not table_exists('product_categories'):
        op.create_table(
            'product_categories',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('name', sa.String(100), unique=True, nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('status', sa.String(50), nullable=False, default='Active', index=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 2. Products & Services
    if not table_exists('products'):
        op.create_table(
            'products',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('category_id', sa.String(36), sa.ForeignKey('product_categories.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('name', sa.String(255), nullable=False, index=True),
            sa.Column('code', sa.String(50), unique=True, nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('type', sa.String(50), nullable=False, default='Product', index=True),
            sa.Column('unit', sa.String(50), nullable=False, default='Unit'),
            sa.Column('base_price', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('tax_rate', sa.Numeric(5, 2), nullable=False, default=18.00),
            sa.Column('status', sa.String(50), nullable=False, default='Active', index=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 3. Number Sequences
    if not table_exists('number_sequences'):
        op.create_table(
            'number_sequences',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('entity_type', sa.String(50), nullable=False, index=True),
            sa.Column('year', sa.Integer(), nullable=False, index=True),
            sa.Column('current_val', sa.Integer(), nullable=False, default=0),
            sa.Column('prefix', sa.String(10), nullable=False, default='QT'),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        )

    # 4. Quotations
    if not table_exists('quotations'):
        op.create_table(
            'quotations',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('quotation_number', sa.String(50), unique=True, nullable=False, index=True),
            sa.Column('college_id', sa.String(36), sa.ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('contact_id', sa.String(36), sa.ForeignKey('contacts.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('opportunity_id', sa.String(36), sa.ForeignKey('opportunities.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('quotation_date', sa.Date(), nullable=False),
            sa.Column('valid_until', sa.Date(), nullable=True),
            sa.Column('status', sa.String(50), nullable=False, default='Draft', index=True),
            sa.Column('currency', sa.String(10), nullable=False, default='INR'),
            sa.Column('subtotal', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('discount_amount', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('tax_amount', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('total_amount', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('terms', sa.Text(), nullable=True),
            sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('approved_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 5. Quotation Items
    if not table_exists('quotation_items'):
        op.create_table(
            'quotation_items',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('quotation_id', sa.String(36), sa.ForeignKey('quotations.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('product_id', sa.String(36), sa.ForeignKey('products.id', ondelete='SET NULL'), nullable=True),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('quantity', sa.Numeric(10, 2), nullable=False, default=1.00),
            sa.Column('unit_price', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('discount', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('tax_rate', sa.Numeric(5, 2), nullable=False, default=18.00),
            sa.Column('tax_amount', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('line_total', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('sort_order', sa.Integer(), nullable=False, default=0),
        )

    # 6. Contracts
    if not table_exists('contracts'):
        op.create_table(
            'contracts',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('contract_number', sa.String(50), unique=True, nullable=False, index=True),
            sa.Column('college_id', sa.String(36), sa.ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('contact_id', sa.String(36), sa.ForeignKey('contacts.id', ondelete='SET NULL'), nullable=True),
            sa.Column('opportunity_id', sa.String(36), sa.ForeignKey('opportunities.id', ondelete='SET NULL'), nullable=True),
            sa.Column('quotation_id', sa.String(36), sa.ForeignKey('quotations.id', ondelete='SET NULL'), nullable=True),
            sa.Column('title', sa.String(255), nullable=False, index=True),
            sa.Column('start_date', sa.Date(), nullable=False),
            sa.Column('end_date', sa.Date(), nullable=False),
            sa.Column('contract_value', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('currency', sa.String(10), nullable=False, default='INR'),
            sa.Column('status', sa.String(50), nullable=False, default='Draft', index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('terms', sa.Text(), nullable=True),
            sa.Column('signed_date', sa.Date(), nullable=True),
            sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('approved_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 7. Sales Orders
    if not table_exists('sales_orders'):
        op.create_table(
            'sales_orders',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('order_number', sa.String(50), unique=True, nullable=False, index=True),
            sa.Column('college_id', sa.String(36), sa.ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('contact_id', sa.String(36), sa.ForeignKey('contacts.id', ondelete='SET NULL'), nullable=True),
            sa.Column('opportunity_id', sa.String(36), sa.ForeignKey('opportunities.id', ondelete='SET NULL'), nullable=True),
            sa.Column('quotation_id', sa.String(36), sa.ForeignKey('quotations.id', ondelete='SET NULL'), nullable=True),
            sa.Column('contract_id', sa.String(36), sa.ForeignKey('contracts.id', ondelete='SET NULL'), nullable=True),
            sa.Column('order_date', sa.Date(), nullable=False),
            sa.Column('status', sa.String(50), nullable=False, default='Draft', index=True),
            sa.Column('currency', sa.String(10), nullable=False, default='INR'),
            sa.Column('subtotal', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('discount_amount', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('tax_amount', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('total_amount', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('confirmed_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 8. Sales Order Items
    if not table_exists('sales_order_items'):
        op.create_table(
            'sales_order_items',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('sales_order_id', sa.String(36), sa.ForeignKey('sales_orders.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('product_id', sa.String(36), sa.ForeignKey('products.id', ondelete='SET NULL'), nullable=True),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('quantity', sa.Numeric(10, 2), nullable=False, default=1.00),
            sa.Column('unit_price', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('discount', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('tax_rate', sa.Numeric(5, 2), nullable=False, default=18.00),
            sa.Column('tax_amount', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('line_total', sa.Numeric(12, 2), nullable=False, default=0.00),
        )


def downgrade() -> None:
    if table_exists('sales_order_items'):
        op.drop_table('sales_order_items')
    if table_exists('sales_orders'):
        op.drop_table('sales_orders')
    if table_exists('contracts'):
        op.drop_table('contracts')
    if table_exists('quotation_items'):
        op.drop_table('quotation_items')
    if table_exists('quotations'):
        op.drop_table('quotations')
    if table_exists('number_sequences'):
        op.drop_table('number_sequences')
    if table_exists('products'):
        op.drop_table('products')
    if table_exists('product_categories'):
        op.drop_table('product_categories')
