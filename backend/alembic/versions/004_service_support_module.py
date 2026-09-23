"""Service and Support module schema: categories, subcategories, SLA policies, tickets, comments, attachments, status history, assignments, escalations

Revision ID: 004_service_support_module
Revises: 003_projects_qa_module
Create Date: 2026-09-18 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004_service_support_module'
down_revision: Union[str, None] = '003_projects_qa_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return insp.has_table(table_name)


def upgrade() -> None:
    # 1. Service Categories
    if not table_exists('service_categories'):
        op.create_table(
            'service_categories',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('name', sa.String(100), unique=True, nullable=False, index=True),
            sa.Column('code', sa.String(50), unique=True, nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, default=True, index=True),
            sa.Column('sort_order', sa.Integer(), nullable=False, default=0),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 2. Service Subcategories
    if not table_exists('service_subcategories'):
        op.create_table(
            'service_subcategories',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('category_id', sa.String(36), sa.ForeignKey('service_categories.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('name', sa.String(100), nullable=False, index=True),
            sa.Column('code', sa.String(50), nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, default=True, index=True),
            sa.Column('sort_order', sa.Integer(), nullable=False, default=0),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 3. SLA Policies
    if not table_exists('sla_policies'):
        op.create_table(
            'sla_policies',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('name', sa.String(150), unique=True, nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('priority', sa.String(50), nullable=False, default='ALL', index=True),
            sa.Column('severity', sa.String(50), nullable=False, default='ALL', index=True),
            sa.Column('first_response_minutes', sa.Integer(), nullable=False, default=60),
            sa.Column('resolution_minutes', sa.Integer(), nullable=False, default=480),
            sa.Column('business_hours_only', sa.Boolean(), nullable=False, default=True),
            sa.Column('active', sa.Boolean(), nullable=False, default=True, index=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 4. Tickets
    if not table_exists('tickets'):
        op.create_table(
            'tickets',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('ticket_number', sa.String(50), unique=True, nullable=False, index=True),
            sa.Column('subject', sa.String(255), nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('college_id', sa.String(36), sa.ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('contact_id', sa.String(36), sa.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('sales_order_id', sa.String(36), sa.ForeignKey('sales_orders.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('contract_id', sa.String(36), sa.ForeignKey('contracts.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('category_id', sa.String(36), sa.ForeignKey('service_categories.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('subcategory_id', sa.String(36), sa.ForeignKey('service_subcategories.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('priority', sa.String(50), nullable=False, default='MEDIUM', index=True),
            sa.Column('severity', sa.String(50), nullable=False, default='MEDIUM', index=True),
            sa.Column('source', sa.String(50), nullable=False, default='PORTAL', index=True),
            sa.Column('status', sa.String(50), nullable=False, default='NEW', index=True),
            sa.Column('assigned_to_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('assigned_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('service_team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('sla_policy_id', sa.String(36), sa.ForeignKey('sla_policies.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('first_response_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('first_response_due_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('due_at', sa.DateTime(timezone=True), nullable=True, index=True),
            sa.Column('sla_status', sa.String(50), nullable=False, default='ON_TRACK', index=True),
            sa.Column('sla_breached', sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column('sla_breached_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('sla_paused_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('total_paused_minutes', sa.Integer(), nullable=False, default=0),
            sa.Column('is_escalated', sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column('escalation_reason', sa.Text(), nullable=True),
            sa.Column('escalated_to_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('escalated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('resolution_summary', sa.Text(), nullable=True),
            sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('resolved_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('customer_confirmed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('customer_confirmed_by', sa.String(150), nullable=True),
            sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('closed_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('reopen_count', sa.Integer(), nullable=False, default=0),
            sa.Column('last_reopened_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_reopened_reason', sa.Text(), nullable=True),
            sa.Column('linked_bug_id', sa.String(36), sa.ForeignKey('bugs.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        )

    # 5. Ticket Comments
    if not table_exists('ticket_comments'):
        op.create_table(
            'ticket_comments',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('ticket_id', sa.String(36), sa.ForeignKey('tickets.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('comment_type', sa.String(50), nullable=False, default='CUSTOMER_REPLY', index=True),
            sa.Column('message', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 6. Ticket Attachments
    if not table_exists('ticket_attachments'):
        op.create_table(
            'ticket_attachments',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('ticket_id', sa.String(36), sa.ForeignKey('tickets.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('filename', sa.String(255), nullable=False),
            sa.Column('file_size', sa.Integer(), nullable=False, default=0),
            sa.Column('content_type', sa.String(100), nullable=False, default='application/octet-stream'),
            sa.Column('file_path', sa.String(500), nullable=False),
            sa.Column('uploaded_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 7. Ticket Status History
    if not table_exists('ticket_status_history'):
        op.create_table(
            'ticket_status_history',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('ticket_id', sa.String(36), sa.ForeignKey('tickets.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('old_status', sa.String(50), nullable=True),
            sa.Column('new_status', sa.String(50), nullable=False),
            sa.Column('changed_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 8. Ticket Assignments
    if not table_exists('ticket_assignments'):
        op.create_table(
            'ticket_assignments',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('ticket_id', sa.String(36), sa.ForeignKey('tickets.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('assigned_to_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('assigned_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='SET NULL'), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 9. Ticket Escalations
    if not table_exists('ticket_escalations'):
        op.create_table(
            'ticket_escalations',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('ticket_id', sa.String(36), sa.ForeignKey('tickets.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('escalated_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('escalated_to_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('reason', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )


def downgrade() -> None:
    if table_exists('ticket_escalations'):
        op.drop_table('ticket_escalations')
    if table_exists('ticket_assignments'):
        op.drop_table('ticket_assignments')
    if table_exists('ticket_status_history'):
        op.drop_table('ticket_status_history')
    if table_exists('ticket_attachments'):
        op.drop_table('ticket_attachments')
    if table_exists('ticket_comments'):
        op.drop_table('ticket_comments')
    if table_exists('tickets'):
        op.drop_table('tickets')
    if table_exists('sla_policies'):
        op.drop_table('sla_policies')
    if table_exists('service_subcategories'):
        op.drop_table('service_subcategories')
    if table_exists('service_categories'):
        op.drop_table('service_categories')
