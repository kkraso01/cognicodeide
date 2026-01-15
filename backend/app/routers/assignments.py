from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import hashlib
import json
from app.database import get_db
from app.models.models import Assignment, User
from app.schemas.schemas import (
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentResponse
)
from app.auth_utils import get_current_user, get_current_teacher

router = APIRouter(prefix="/api/assignments", tags=["Assignments"])


def generate_version_hash(assignment: Assignment) -> str:
    """Generate a version hash for an assignment."""
    content = f"{assignment.title}:{assignment.description}:{assignment.language}:{assignment.starter_code}"
    return hashlib.sha256(content.encode()).hexdigest()


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    assignment_data: AssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Create a new assignment (teachers only)."""
    # logging_settings comes as JSON string, keep it as is (or None)
    logging_settings_str = assignment_data.logging_settings if assignment_data.logging_settings else None
    
    new_assignment = Assignment(
        title=assignment_data.title,
        description=assignment_data.description,
        language=assignment_data.language,
        ai_mode=assignment_data.ai_mode,
        starter_code=assignment_data.starter_code or "",
        test_cases=assignment_data.test_cases,
        support_files=assignment_data.support_files or "",
        build_command=assignment_data.build_command,
        run_command=assignment_data.run_command,
        logging_settings=logging_settings_str,  # Store as JSON string (or None to inherit)
        created_by=current_user.id
    )
    
    db.add(new_assignment)
    await db.flush()
    
    # Generate version hash
    new_assignment.version_hash = generate_version_hash(new_assignment)
    
    await db.commit()
    await db.refresh(new_assignment)
    
    return new_assignment


@router.get("", response_model=List[AssignmentResponse])
async def list_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all assignments."""
    result = await db.execute(select(Assignment).order_by(Assignment.created_at.desc()))
    assignments = result.scalars().all()
    return assignments


@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific assignment."""
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    return assignment


@router.put("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: int,
    assignment_data: AssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Update an assignment (teachers only)."""
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Update fields (support_files and starter_code are already JSON strings)
    update_data = assignment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(assignment, field, value)
    
    # Regenerate version hash
    assignment.version_hash = generate_version_hash(assignment)
    
    await db.commit()
    await db.refresh(assignment)
    
    return assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Delete an assignment (teachers only)."""
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    await db.delete(assignment)
    await db.commit()
    
    return None
