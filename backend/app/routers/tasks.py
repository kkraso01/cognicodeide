"""
Task orchestration router for friction-induced cognitive engagement.
Handles task assignment, technique sequencing, and submission tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from typing import Optional
import logging

from app.database import get_db
from app.models.models import (
    User, Assignment, Attempt, UserTechniqueSequence, HintLevel,
    FrictionTechnique, AIMode, Event
)
from app.auth_utils import get_current_user
from app.services.ai_proxy import ollama_service
from pydantic import BaseModel

router = APIRouter(prefix="/api/tasks", tags=["Task Orchestration"])
logger = logging.getLogger(__name__)


# ============================================================================
# Request/Response Models
# ============================================================================

class TechniqueValidationRequest(BaseModel):
    """Validate that student's chosen technique is allowed for this assignment."""
    assignment_id: int
    chosen_technique: str  # Student's choice from modal


class TaskAssignmentResponse(BaseModel):
    """Response when validating student's technique choice."""
    status: str
    chosen_technique: str
    assignment_id: int
    is_valid: bool
    
    class Config:
        from_attributes = True


class TaskSubmissionRequest(BaseModel):
    """Submit a task/attempt."""
    attempt_id: int
    final_code: Optional[str] = None
    score: Optional[float] = None
    notes: Optional[str] = None


class HintResponse(BaseModel):
    """Return a tiered hint."""
    level: int  # 1, 2, or 3
    hint: str
    next_level_available: bool


# ============================================================================
# Task Orchestration Endpoints
# ============================================================================

@router.post("/next")
async def get_next_task(
    request: TechniqueValidationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> TaskAssignmentResponse:
    """
    Validate the student's chosen friction technique for this assignment.
    Student selected their preferred technique from the modal.
    This endpoint confirms it's valid for the assignment.
    """
    logger.info(f" Validating technique - User: {current_user.username}, Chosen: {request.chosen_technique}")
    
    if current_user.role.value != "Student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can start tasks"
        )
    
    # Get assignment
    result = await db.execute(select(Assignment).where(Assignment.id == request.assignment_id))
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Validate technique is one of the allowed values
    valid_techniques = [t.value for t in FrictionTechnique]
    if request.chosen_technique not in valid_techniques:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid technique. Must be one of: {', '.join(valid_techniques)}"
        )
    
    logger.info(f" Student {current_user.username} chose technique: {request.chosen_technique}")
    
    return TaskAssignmentResponse(
        status="valid",
        chosen_technique=request.chosen_technique,
        assignment_id=request.assignment_id,
        is_valid=True
    )


@router.post("/hint")
async def request_hint(
    attempt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> HintResponse:
    """
    Request the next tier of hint for current task.
    Level 1  Level 2  Level 3 (solution).
    """
    logger.info(f" Hint request - User: {current_user.username}, Attempt: {attempt_id}")
    
    # Verify attempt belongs to user
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    
    if not attempt or attempt.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid attempt"
        )
    
    # Get hint level record
    hint_result = await db.execute(
        select(HintLevel).where(HintLevel.attempt_id == attempt_id)
    )
    hint_level = hint_result.scalar_one_or_none()
    
    if not hint_level:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hints available for this attempt"
        )
    
    # Determine which hint to return
    current_level = hint_level.hints_requested
    
    if current_level >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum hints already provided"
        )
    
    next_level = current_level + 1
    
    if next_level == 1:
        hint_text = hint_level.level_1_hint
    elif next_level == 2:
        hint_text = hint_level.level_2_hint
    else:  # next_level == 3
        hint_text = hint_level.level_3_hint
    
    # Update hint tracking
    hint_level.hints_requested = next_level
    hint_level.last_hint_requested_at = datetime.utcnow()
    
    await db.commit()
    
    logger.info(f" Returned hint level {next_level} for attempt {attempt_id}")
    
    # Log hint request as event
    event = Event(
        attempt_id=attempt_id,
        t=0,  # Will be set by frontend
        seq=0,  # Will be set by frontend
        type="hint_requested",
        payload_json=f'{{"level": {next_level}, "technique": "{hint_level.technique.value}"}}'
    )
    db.add(event)
    await db.commit()
    
    return HintResponse(
        level=next_level,
        hint=hint_text,
        next_level_available=(next_level < 3)
    )


@router.post("/submit")
async def submit_task(
    request: TaskSubmissionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a completed task.
    Student finishes their attempt and can choose a different technique for the next attempt.
    """
    logger.info(f" Task submission - User: {current_user.username}, Attempt: {request.attempt_id}")
    
    # Verify attempt belongs to user
    result = await db.execute(select(Attempt).where(Attempt.id == request.attempt_id))
    attempt = result.scalar_one_or_none()
    
    if not attempt or attempt.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid attempt"
        )
    
    # Update attempt with submission
    attempt.finished_at = datetime.utcnow()
    attempt.final_code = request.final_code
    attempt.total_score = request.score
    
    # Log submission
    event = Event(
        attempt_id=request.attempt_id,
        t=0,
        seq=0,
        type="task_submitted",
        payload_json=f'{{"score": {request.score}, "notes": "{request.notes or ""}"}}'
    )
    db.add(event)
    
    await db.commit()
    
    logger.info(f" Attempt {request.attempt_id} submitted with score {request.score}")
    
    return {"status": "submitted", "attempt_id": request.attempt_id}


@router.get("/stats/{assignment_id}")
async def get_assignment_stats(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics for student on this assignment.
    Shows attempts by technique type and completion status.
    """
    if current_user.role.value != "Student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can view their stats"
        )
    
    # Get all attempts by this student on this assignment
    result = await db.execute(
        select(Attempt).where(
            Attempt.user_id == current_user.id,
            Attempt.assignment_id == assignment_id
        )
    )
    attempts = result.scalars().all()
    
    # Group by technique
    attempts_by_technique = {}
    completed_count = 0
    
    for attempt in attempts:
        technique = attempt.student_ai_choice or "baseline"
        if technique not in attempts_by_technique:
            attempts_by_technique[technique] = []
        attempts_by_technique[technique].append(attempt)
        if attempt.finished_at:
            completed_count += 1
    
    return {
        "total_attempts": len(attempts),
        "completed_attempts": completed_count,
        "attempts_by_technique": {
            tech: {
                "count": len(atts),
                "completed": sum(1 for a in atts if a.finished_at)
            }
            for tech, atts in attempts_by_technique.items()
        }
    }
