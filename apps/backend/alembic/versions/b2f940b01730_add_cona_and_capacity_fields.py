"""add cona and capacity fields

Revision ID: b2f940b01730
Revises: bf20d22bb808
Create Date: 2025-09-21 15:57:59.926658

"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2

revision = 'b2f940b01730'
down_revision = 'bf20d22bb808'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add cona column to features table
    op.add_column('features', sa.Column('cona', sa.String(), nullable=True))
    
    # Add capacity columns to features table
    op.add_column('features', sa.Column('max_capacity', sa.Integer(), nullable=True))
    op.add_column('features', sa.Column('taken_capacity', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove capacity columns
    op.drop_column('features', 'taken_capacity')
    op.drop_column('features', 'max_capacity')
    
    # Remove cona column
    op.drop_column('features', 'cona')


