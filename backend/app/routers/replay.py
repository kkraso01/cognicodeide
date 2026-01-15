from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.models.models import Attempt, User
from app.schemas.schemas import ReplayData, ReplayMetrics, AttemptResponse
from app.auth_utils import get_current_teacher
from app.services.replay_service import replay_service

router = APIRouter(prefix="/api/replay", tags=["Replay"])


@router.get("/{attempt_id}", response_model=ReplayData)
async def get_replay(
    attempt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Get replay data for an attempt (teachers only)."""
    replay_data = await replay_service.get_replay_data(attempt_id, db)
    
    if not replay_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
    
    return replay_data


@router.get("/{attempt_id}/metrics", response_model=ReplayMetrics)
async def get_replay_metrics(
    attempt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Get engagement metrics for an attempt (teachers only)."""
    replay_data = await replay_service.get_replay_data(attempt_id, db)
    
    if not replay_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
    
    metrics = replay_service.calculate_metrics(replay_data["events"])
    return metrics


@router.get("/student/{student_id}", response_model=List[AttemptResponse])
async def get_student_attempts(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Get all attempts for a student (teachers only)."""
    result = await db.execute(
        select(Attempt)
        .where(Attempt.user_id == student_id)
        .order_by(Attempt.started_at.desc())
    )
    attempts = result.scalars().all()
    
    return attempts
