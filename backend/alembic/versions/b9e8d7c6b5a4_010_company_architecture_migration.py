"""010_company_architecture_migration

Revision ID: b9e8d7c6b5a4
Revises: 4c168a3c9176
Create Date: 2026-09-21 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9e8d7c6b5a4'
down_revision: Union[str, None] = '4c168a3c9176'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHILD_TABLES = [
    ("contacts", True),
    ("leads", False),
    ("opportunities", True),
    ("quotations", True),
    ("sales_orders", True),
    ("contracts", True),
    ("projects", True),
    ("tickets", True),
    ("invoices", True),
    ("customer_payments", True),
    ("journal_lines", False),
    ("email_threads", False),
    ("communication_messages", False),
]

COMPANY_INDEXES = [
    ("ix_companies_organization_name", "organization_name", False),
    ("ix_companies_code", "code", True),
    ("ix_companies_city", "city", False),
    ("ix_companies_state", "state", False),
    ("ix_companies_status", "status", False),
    ("ix_companies_owner_id", "owner_id", False),
    ("ix_companies_is_deleted", "is_deleted", False),
]

LEGACY_COLLEGE_INDEXES = [
    "ix_colleges_organization_name",
    "ix_colleges_code",
    "ix_colleges_city",
    "ix_colleges_state",
    "ix_colleges_status",
    "ix_colleges_owner_id",
    "ix_colleges_is_deleted",
]


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Rename table colleges -> companies
    op.rename_table('colleges', 'companies')

    # 2. Recreate indexes on companies
    for old_idx in LEGACY_COLLEGE_INDEXES:
        try:
            op.drop_index(old_idx, table_name='companies')
        except Exception:
            pass

    for idx_name, col_name, is_unique in COMPANY_INDEXES:
        op.create_index(idx_name, 'companies', [col_name], unique=is_unique)

    # 3. Rename college_id -> company_id on all 13 child tables
    for tbl, not_null in CHILD_TABLES:
        with op.batch_alter_table(tbl) as batch_op:
            batch_op.alter_column('college_id', new_column_name='company_id')
        # Recreate index
        try:
            op.drop_index(f'ix_{tbl}_college_id', table_name=tbl)
        except Exception:
            pass
        op.create_index(f'ix_{tbl}_company_id', tbl, ['company_id'], unique=False)

    # 4. Migrate permission codes in permissions table
    perm_updates = [
        ("crm.colleges.view", "crm.companies.view", "View Companies & Accounts"),
        ("crm.colleges.create", "crm.companies.create", "Create New Companies"),
        ("crm.colleges.edit", "crm.companies.edit", "Edit Company Details"),
        ("crm.colleges.delete", "crm.companies.delete", "Delete Companies"),
    ]
    for old_code, new_code, new_name in perm_updates:
        conn.execute(
            sa.text("UPDATE permissions SET code=:new_code, name=:new_name WHERE code=:old_code"),
            {"new_code": new_code, "new_name": new_name, "old_code": old_code}
        )

    # 5. Migrate polymorphic related_entity_type references
    for polymorphic_table in ['activities', 'tasks', 'meetings', 'notes']:
        conn.execute(
            sa.text(f"UPDATE {polymorphic_table} SET related_entity_type = 'company' WHERE related_entity_type = 'college'")
        )


def downgrade() -> None:
    conn = op.get_bind()

    # 0. Revert polymorphic related_entity_type references
    for polymorphic_table in ['activities', 'tasks', 'meetings', 'notes']:
        conn.execute(
            sa.text(f"UPDATE {polymorphic_table} SET related_entity_type = 'college' WHERE related_entity_type = 'company'")
        )

    # 1. Revert permissions
    perm_reverts = [
        ("crm.companies.view", "crm.colleges.view", "View Colleges & Institutions"),
        ("crm.companies.create", "crm.colleges.create", "Create New Colleges"),
        ("crm.companies.edit", "crm.colleges.edit", "Edit College Details"),
        ("crm.companies.delete", "crm.colleges.delete", "Delete Colleges"),
    ]
    for new_code, old_code, old_name in perm_reverts:
        conn.execute(
            sa.text("UPDATE permissions SET code=:old_code, name=:old_name WHERE code=:new_code"),
            {"old_code": old_code, "old_name": old_name, "new_code": new_code}
        )

    # 2. Revert columns on child tables
    for tbl, not_null in CHILD_TABLES:
        with op.batch_alter_table(tbl) as batch_op:
            batch_op.alter_column('company_id', new_column_name='college_id')
        try:
            op.drop_index(f'ix_{tbl}_company_id', table_name=tbl)
        except Exception:
            pass
        op.create_index(f'ix_{tbl}_college_id', tbl, ['college_id'], unique=False)

    # 3. Recreate old indexes on colleges
    for idx_name, _, _ in COMPANY_INDEXES:
        try:
            op.drop_index(idx_name, table_name='companies')
        except Exception:
            pass

    # 4. Rename companies back to colleges
    op.rename_table('companies', 'colleges')

    for old_idx, col, is_unique in [
        ("ix_colleges_organization_name", "organization_name", False),
        ("ix_colleges_code", "code", True),
        ("ix_colleges_city", "city", False),
        ("ix_colleges_state", "state", False),
        ("ix_colleges_status", "status", False),
        ("ix_colleges_owner_id", "owner_id", False),
        ("ix_colleges_is_deleted", "is_deleted", False),
    ]:
        op.create_index(old_idx, 'colleges', [col], unique=is_unique)
