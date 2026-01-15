from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime
from app.database import get_db
from app.models.models import Attempt, Assignment, Event, User
from app.schemas.schemas import (
    AttemptCreate,
    AttemptResponse,
    EventBatch,
    EventResponse
)
from app.auth_utils import get_current_user

router = APIRouter(prefix="/api", tags=["Attempts & Events"])


@router.post("/attempts", response_model=AttemptResponse, status_code=status.HTTP_201_CREATED)
async def create_attempt(
    attempt_data: AttemptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start a new attempt on an assignment."""
    # Verify assignment exists
    result = await db.execute(select(Assignment).where(Assignment.id == attempt_data.assignment_id))
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Create new attempt
    new_attempt = Attempt(
        assignment_id=attempt_data.assignment_id,
        user_id=current_user.id,
        mode=attempt_data.mode,
        student_ai_choice=attempt_data.student_ai_choice if hasattr(attempt_data, 'student_ai_choice') else 'none'
    )
    
    db.add(new_attempt)
    await db.commit()
    await db.refresh(new_attempt)
    
    return new_attempt


@router.get("/attempts/latest/{assignment_id}", response_model=AttemptResponse)
async def get_latest_attempt(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the latest attempt for the current user on this assignment."""
    query = (
        select(Attempt)
        .where(Attempt.assignment_id == assignment_id)
        .where(Attempt.user_id == current_user.id)
        .order_by(Attempt.started_at.desc())
        .limit(1)
    )
    
    result = await db.execute(query)
    attempt = result.scalar_one_or_none()
    
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No attempt found"
        )
    
    return attempt


@router.get("/attempts", response_model=List[AttemptResponse])
async def list_attempts(
    assignment_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List attempts. Students see their own, Teachers see all for assignment."""
    # Teachers can see all attempts for an assignment
    if current_user.role.value == "Teacher" and assignment_id:
        query = select(Attempt).where(Attempt.assignment_id == assignment_id)
    else:
        # Students only see their own attempts
        query = select(Attempt).where(Attempt.user_id == current_user.id)
        if assignment_id:
            query = query.where(Attempt.assignment_id == assignment_id)
    
    query = query.order_by(Attempt.started_at.desc())
    
    result = await db.execute(query)
    attempts = result.scalars().all()
    
    return attempts


@router.get("/attempts/{attempt_id}", response_model=AttemptResponse)
async def get_attempt(
    attempt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific attempt."""
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
    
    # Check ownership or teacher access
    if attempt.user_id != current_user.id and current_user.role.value != "Teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return attempt


@router.put("/attempts/{attempt_id}/finish")
async def finish_attempt(
    attempt_id: int,
    final_code: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark an attempt as finished."""
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
    
    if attempt.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    attempt.finished_at = datetime.utcnow()
    if final_code:
        attempt.final_code = final_code
    
    await db.commit()
    await db.refresh(attempt)
    
    return attempt


@router.put("/attempts/{attempt_id}/save")
async def save_attempt(
    attempt_id: int,
    code_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save the current state of an attempt without finishing it."""
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
    
    if attempt.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Update the code - accept both "code" key and direct value
    if "code" in code_data:
        attempt.final_code = code_data["code"]
    elif "files" in code_data:
        # Multi-file save format
        attempt.final_code = code_data["files"]
    else:
        # Fallback: entire payload is the code
        import json
        attempt.final_code = json.dumps(code_data)
    
    await db.commit()
    await db.refresh(attempt)
    
    return attempt


@router.post("/events", status_code=status.HTTP_201_CREATED)
async def log_events(
    event_batch: EventBatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Log a batch of events for an attempt."""
    # Verify attempt exists and belongs to user
    result = await db.execute(select(Attempt).where(Attempt.id == event_batch.attempt_id))
    attempt = result.scalar_one_or_none()
    
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
    
    if attempt.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Create events
    for event_data in event_batch.events:
        event = Event(
            attempt_id=event_batch.attempt_id,
            t=event_data.t,
            seq=event_data.seq,
            type=event_data.type,
            file_path=event_data.file_path,  # NEW: Support multi-file projects
            payload_json=event_data.payload_json
        )
        db.add(event)
    
    await db.commit()
    
    return {"message": f"Logged {len(event_batch.events)} events"}


@router.get("/events/{attempt_id}", response_model=List[EventResponse])
async def get_events(
    attempt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all events for an attempt."""
    # Verify attempt exists and check access
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
    
    if attempt.user_id != current_user.id and current_user.role.value != "Teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get events
    result = await db.execute(
        select(Event)
        .where(Event.attempt_id == attempt_id)
        .order_by(Event.seq)
    )
    events = result.scalars().all()
    
    return events
