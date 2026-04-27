"""Baseline schema using existing bootstrap logic.

Revision ID: 20260423_000001
Revises:
Create Date: 2026-04-23
"""

from typing import Sequence, Union

from services.db import init_db

# revision identifiers, used by Alembic.
revision: str = "20260423_000001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reuse existing idempotent schema bootstrap and data seed logic.
    init_db()


def downgrade() -> None:
    # Baseline downgrade is intentionally a no-op to avoid destructive behavior.
    pass
