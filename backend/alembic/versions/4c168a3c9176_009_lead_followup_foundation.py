"""009_lead_followup_foundation

Revision ID: 4c168a3c9176
Revises: f5711f63c736
Create Date: 2026-09-20 21:15:10.013644

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c168a3c9176'
down_revision: Union[str, None] = 'f5711f63c736'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('leads', sa.Column('contact_name', sa.String(length=150), nullable=True))
    op.add_column('leads', sa.Column('contact_email', sa.String(length=255), nullable=True))
    op.add_column('leads', sa.Column('contact_phone', sa.String(length=50), nullable=True))
    op.add_column('leads', sa.Column('company_name', sa.String(length=255), nullable=True))
    op.add_column('leads', sa.Column('business_segment', sa.String(length=50), nullable=True))
    op.add_column('leads', sa.Column('next_action', sa.String(length=255), nullable=True))
    op.add_column('leads', sa.Column('next_follow_up_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('leads', sa.Column('last_activity_at', sa.DateTime(timezone=True), nullable=True))

    op.create_index('ix_leads_business_segment', 'leads', ['business_segment'], unique=False)
    op.create_index('ix_leads_next_follow_up_date', 'leads', ['next_follow_up_date'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_leads_next_follow_up_date', table_name='leads')
    op.drop_index('ix_leads_business_segment', table_name='leads')

    with op.batch_alter_table('leads') as batch_op:
        batch_op.drop_column('last_activity_at')
        batch_op.drop_column('next_follow_up_date')
        batch_op.drop_column('next_action')
        batch_op.drop_column('business_segment')
        batch_op.drop_column('company_name')
        batch_op.drop_column('contact_phone')
        batch_op.drop_column('contact_email')
        batch_op.drop_column('contact_name')
