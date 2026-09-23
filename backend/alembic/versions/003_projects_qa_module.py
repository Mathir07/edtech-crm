"""Projects and QA module schema: projects, milestones, tasks, test suites, test cases, executions, bugs

Revision ID: 003_projects_qa_module
Revises: 002_sales_module
Create Date: 2026-09-18 22:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '003_projects_qa_module'
down_revision: Union[str, None] = '002_sales_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return insp.has_table(table_name)


def upgrade() -> None:
    # 1. Projects
    if not table_exists('projects'):
        op.create_table(
            'projects',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('project_number', sa.String(50), unique=True, nullable=False, index=True),
            sa.Column('name', sa.String(255), nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('college_id', sa.String(36), sa.ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('sales_order_id', sa.String(36), sa.ForeignKey('sales_orders.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('contract_id', sa.String(36), sa.ForeignKey('contracts.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('project_manager_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('status', sa.String(50), nullable=False, default='PLANNED', index=True),
            sa.Column('priority', sa.String(50), nullable=False, default='MEDIUM', index=True),
            sa.Column('start_date', sa.Date(), nullable=True),
            sa.Column('target_date', sa.Date(), nullable=True),
            sa.Column('actual_completion_date', sa.Date(), nullable=True),
            sa.Column('progress_percentage', sa.Numeric(5, 2), nullable=False, default=0.00),
            sa.Column('budget', sa.Numeric(12, 2), nullable=False, default=0.00),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('updated_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 2. Project Members
    if not table_exists('project_members'):
        op.create_table(
            'project_members',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('role', sa.String(50), nullable=False, default='Developer'),
            sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('removed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('active', sa.Boolean(), nullable=False, default=True, index=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 3. Milestones
    if not table_exists('milestones'):
        op.create_table(
            'milestones',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('sequence', sa.Integer(), nullable=False, default=1),
            sa.Column('status', sa.String(50), nullable=False, default='NOT_STARTED', index=True),
            sa.Column('start_date', sa.Date(), nullable=True),
            sa.Column('due_date', sa.Date(), nullable=True),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('completion_percentage', sa.Numeric(5, 2), nullable=False, default=0.00),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 4. Project Tasks
    if not table_exists('project_tasks'):
        op.create_table(
            'project_tasks',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('task_number', sa.String(50), nullable=False, index=True),
            sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('milestone_id', sa.String(36), sa.ForeignKey('milestones.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('title', sa.String(255), nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('assigned_to_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('status', sa.String(50), nullable=False, default='TODO', index=True),
            sa.Column('priority', sa.String(50), nullable=False, default='MEDIUM', index=True),
            sa.Column('estimated_hours', sa.Numeric(8, 2), nullable=False, default=0.00),
            sa.Column('actual_hours', sa.Numeric(8, 2), nullable=False, default=0.00),
            sa.Column('start_date', sa.Date(), nullable=True),
            sa.Column('due_date', sa.Date(), nullable=True),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 5. Test Suites
    if not table_exists('test_suites'):
        op.create_table(
            'test_suites',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('name', sa.String(255), nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('module', sa.String(100), nullable=True, index=True),
            sa.Column('status', sa.String(50), nullable=False, default='ACTIVE', index=True),
            sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 6. Test Cases
    if not table_exists('test_cases'):
        op.create_table(
            'test_cases',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('test_case_number', sa.String(50), unique=True, nullable=False, index=True),
            sa.Column('test_suite_id', sa.String(36), sa.ForeignKey('test_suites.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('title', sa.String(255), nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('preconditions', sa.Text(), nullable=True),
            sa.Column('test_steps', sa.Text(), nullable=True),
            sa.Column('expected_result', sa.Text(), nullable=True),
            sa.Column('priority', sa.String(50), nullable=False, default='MEDIUM', index=True),
            sa.Column('status', sa.String(50), nullable=False, default='NOT_EXECUTED', index=True),
            sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('assigned_to_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 7. Test Executions
    if not table_exists('test_executions'):
        op.create_table(
            'test_executions',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('test_case_id', sa.String(36), sa.ForeignKey('test_cases.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('executed_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('execution_date', sa.DateTime(timezone=True), nullable=False),
            sa.Column('result', sa.String(50), nullable=False, index=True),
            sa.Column('actual_result', sa.Text(), nullable=True),
            sa.Column('comments', sa.Text(), nullable=True),
            sa.Column('environment', sa.String(100), nullable=False, default='Staging'),
            sa.Column('build_version', sa.String(50), nullable=True),
        )

    # 8. Bugs
    if not table_exists('bugs'):
        op.create_table(
            'bugs',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('bug_number', sa.String(50), unique=True, nullable=False, index=True),
            sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('test_case_id', sa.String(36), sa.ForeignKey('test_cases.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('title', sa.String(255), nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('severity', sa.String(50), nullable=False, default='MEDIUM', index=True),
            sa.Column('priority', sa.String(50), nullable=False, default='MEDIUM', index=True),
            sa.Column('status', sa.String(50), nullable=False, default='OPEN', index=True),
            sa.Column('assigned_to_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('reported_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('environment', sa.String(100), nullable=False, default='Staging'),
            sa.Column('steps_to_reproduce', sa.Text(), nullable=True),
            sa.Column('expected_result', sa.Text(), nullable=True),
            sa.Column('actual_result', sa.Text(), nullable=True),
            sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 9. Bug Comments
    if not table_exists('bug_comments'):
        op.create_table(
            'bug_comments',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('bug_id', sa.String(36), sa.ForeignKey('bugs.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('comment', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )

    # 10. Bug Attachments
    if not table_exists('bug_attachments'):
        op.create_table(
            'bug_attachments',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('bug_id', sa.String(36), sa.ForeignKey('bugs.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('filename', sa.String(255), nullable=False),
            sa.Column('file_size', sa.Integer(), nullable=False, default=0),
            sa.Column('content_type', sa.String(100), nullable=False, default='application/octet-stream'),
            sa.Column('file_path', sa.String(500), nullable=False),
            sa.Column('uploaded_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )


def downgrade() -> None:
    if table_exists('bug_attachments'):
        op.drop_table('bug_attachments')
    if table_exists('bug_comments'):
        op.drop_table('bug_comments')
    if table_exists('bugs'):
        op.drop_table('bugs')
    if table_exists('test_executions'):
        op.drop_table('test_executions')
    if table_exists('test_cases'):
        op.drop_table('test_cases')
    if table_exists('test_suites'):
        op.drop_table('test_suites')
    if table_exists('project_tasks'):
        op.drop_table('project_tasks')
    if table_exists('milestones'):
        op.drop_table('milestones')
    if table_exists('project_members'):
        op.drop_table('project_members')
    if table_exists('projects'):
        op.drop_table('projects')
