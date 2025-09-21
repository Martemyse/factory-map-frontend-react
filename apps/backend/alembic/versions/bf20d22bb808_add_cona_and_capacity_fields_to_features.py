"""add cona and capacity fields to features

Revision ID: bf20d22bb808
Revises: 2409fe2b61a3
Create Date: 2025-09-21 15:57:24.660853

"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2

revision = 'bf20d22bb808'
down_revision = '2409fe2b61a3'
branch_labels = None
depends_on = None

def upgrade() -> None:
    pass


def downgrade() -> None:
    pass


