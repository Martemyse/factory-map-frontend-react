"""create_tables

Revision ID: f8474ef5e0da
Revises: 
Create Date: 2025-09-20 15:43:46.706420

"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2

revision = 'f8474ef5e0da'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create layers table
    op.create_table('layers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('z_index', sa.Integer(), nullable=False),
        sa.Column('visible', sa.Boolean(), nullable=False),
        sa.Column('editable', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    
    # Create features table
    op.create_table('features',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('layer_id', sa.Integer(), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('opomba', sa.String(), nullable=True),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.Column('depth', sa.Integer(), nullable=True),
        sa.Column('properties', sa.JSON(), nullable=False),
        sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=3857), nullable=False),
        sa.ForeignKeyConstraint(['layer_id'], ['layers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['features.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index on geom column
    op.create_index('idx_features_geom', 'features', ['geom'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_features_geom', table_name='features')
    op.drop_table('features')
    op.drop_table('layers')


