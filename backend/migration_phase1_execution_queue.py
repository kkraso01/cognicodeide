"""
Alembic migration for Phase 1 execution queue.
Extends Run table with job state fields.

Revision ID: 002_phase1_execution_queue
Revises: 001_initial_schema  # Update to match your actual down_revision
Create Date: 2026-01-15
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_phase1_execution_queue'
down_revision = None  # IMPORTANT: Update this to your latest migration ID
branch_labels = None
depends_on = None


def upgrade():
    """Apply migration."""
    
    # 1. Create RunStatus enum type (PostgreSQL)
    # For SQLite, this will be handled as text
    
    # 2. Add new columns to runs table
    op.add_column('runs', sa.Column('status', sa.String(50), nullable=False, server_default='queued'))
    op.add_column('runs', sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))
    op.add_column('runs', sa.Column('started_at', sa.DateTime(), nullable=True))
    op.add_column('runs', sa.Column('finished_at', sa.DateTime(), nullable=True))
    
    # Build phase columns
    op.add_column('runs', sa.Column('build_stdout', sa.Text(), nullable=True))
    op.add_column('runs', sa.Column('build_stderr', sa.Text(), nullable=True))
    op.add_column('runs', sa.Column('build_exit_code', sa.Integer(), nullable=True))
    op.add_column('runs', sa.Column('build_time', sa.Float(), nullable=True))
    
    # Add hash and snapshot columns
    op.add_column('runs', sa.Column('snapshot_hash', sa.String(64), nullable=True))
    op.add_column('runs', sa.Column('request_json', sa.Text(), nullable=True))
    
    # 3. Rename code_snapshot to be optional (already exists, just update constraints)
    # This is implicit: code_snapshot was NOT NULL, now it becomes nullable
    # You may need to manually update this in your DB if it's marked NOT NULL
    
    # 4. Create indexes for job querying
    op.create_index('idx_runs_attempt_status', 'runs', ['attempt_id', 'status'])
    op.create_index('idx_runs_created', 'runs', ['created_at'])


def downgrade():
    """Revert migration."""
    
    # Remove indexes
    op.drop_index('idx_runs_created', table_name='runs')
    op.drop_index('idx_runs_attempt_status', table_name='runs')
    
    # Remove new columns
    op.drop_column('runs', 'request_json')
    op.drop_column('runs', 'snapshot_hash')
    op.drop_column('runs', 'build_time')
    op.drop_column('runs', 'build_exit_code')
    op.drop_column('runs', 'build_stderr')
    op.drop_column('runs', 'build_stdout')
    op.drop_column('runs', 'finished_at')
    op.drop_column('runs', 'started_at')
    op.drop_column('runs', 'created_at')
    op.drop_column('runs', 'status')
