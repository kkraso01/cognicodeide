"""
Teacher settings endpoints for configuring logging preferences.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
from app.database import get_db
from app.models.models import User, UserRole, Assignment
from app.auth_utils import get_current_user

router = APIRouter()


# Default logging settings
DEFAULT_SETTINGS = {
    "log_level": "standard",
    "track_keystrokes": True,
    "track_cursor_moves": True,
    "track_paste_events": True,
    "track_ai_interactions": True,
    "track_run_events": True,
    "cursor_tracking_interval": 5000,
    "batch_interval": 5,
}


@router.get("/api/teacher/logging-settings")
async def get_logging_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current teacher's base logging settings (used as defaults for all assignments).
    Returns default settings if none are saved.
    """
    if current_user.role != UserRole.Teacher:
        raise HTTPException(status_code=403, detail="Only teachers can access logging settings")
    
    # Parse JSON string from database
    if current_user.logging_settings:
        try:
            settings = json.loads(current_user.logging_settings)
        except json.JSONDecodeError:
            settings = DEFAULT_SETTINGS
    else:
        settings = DEFAULT_SETTINGS
    
    return settings


@router.put("/api/teacher/logging-settings")
async def update_logging_settings(
    settings: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the current teacher's logging settings.
    """
    if current_user.role != UserRole.Teacher:
        raise HTTPException(status_code=403, detail="Only teachers can update logging settings")
    
    # Validate settings structure
    required_fields = [
        "log_level", "track_keystrokes", "track_cursor_moves",
        "track_paste_events", "track_ai_interactions", "track_run_events",
        "cursor_tracking_interval", "batch_interval"
    ]
    
    for field in required_fields:
        if field not in settings:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Validate log_level
    if settings["log_level"] not in ["verbose", "standard", "minimal"]:
        raise HTTPException(status_code=400, detail="Invalid log_level. Must be 'verbose', 'standard', or 'minimal'")
    
    # Validate intervals
    if not (1000 <= settings["cursor_tracking_interval"] <= 10000):
        raise HTTPException(status_code=400, detail="cursor_tracking_interval must be between 1000 and 10000")
    
    if not (3 <= settings["batch_interval"] <= 30):
        raise HTTPException(status_code=400, detail="batch_interval must be between 3 and 30")
    
    # Update user's logging settings (serialize to JSON string)
    current_user.logging_settings = json.dumps(settings)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    return {"message": "Settings updated successfully", "settings": settings}


@router.get("/api/teacher/logging-settings/{teacher_id}")
async def get_teacher_logging_settings_for_student(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a teacher's base logging settings (for student sessions).
    DEPRECATED: Use /api/assignments/{assignment_id}/logging-settings instead
    to get the effective settings for a specific assignment.
    """
    # Fetch teacher
    result = await db.execute(select(User).where(User.id == teacher_id))
    teacher = result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    if teacher.role != UserRole.Teacher:
        raise HTTPException(status_code=400, detail="User is not a teacher")
    
    # Return teacher's logging settings or defaults
    if teacher.logging_settings:
        try:
            settings = json.loads(teacher.logging_settings)
        except json.JSONDecodeError:
            settings = DEFAULT_SETTINGS
    else:
        settings = DEFAULT_SETTINGS
    
    return settings


@router.get("/api/assignments/{assignment_id}/logging-settings")
async def get_assignment_logging_settings(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the effective logging settings for a specific assignment.
    This endpoint returns:
    1. Assignment-specific settings if set (overrides)
    2. Teacher's base settings if assignment settings are null (inheritance)
    3. System defaults if neither are set
    
    Students use this endpoint when starting an assignment to know what to log.
    """
    # Fetch assignment
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # If assignment has specific settings, use those (override)
    if assignment.logging_settings:
        try:
            settings = json.loads(assignment.logging_settings)
            return {
                "settings": settings,
                "source": "assignment"  # Indicates these are assignment-specific
            }
        except json.JSONDecodeError:
            pass
    
    # Otherwise, inherit from teacher's base settings
    if assignment.created_by:
        result = await db.execute(select(User).where(User.id == assignment.created_by))
        teacher = result.scalar_one_or_none()
        
        if teacher and teacher.logging_settings:
            try:
                settings = json.loads(teacher.logging_settings)
                return {
                    "settings": settings,
                    "source": "teacher"  # Indicates these are inherited from teacher
                }
            except json.JSONDecodeError:
                pass
    
    # Fallback to system defaults
    return {
        "settings": DEFAULT_SETTINGS,
        "source": "default"  # Indicates these are system defaults
    }


@router.put("/api/assignments/{assignment_id}/logging-settings")
async def update_assignment_logging_settings(
    assignment_id: int,
    settings: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Override logging settings for a specific assignment.
    Set to null/empty to inherit from teacher's base settings.
    """
    if current_user.role != UserRole.Teacher:
        raise HTTPException(status_code=403, detail="Only teachers can update assignment settings")
    
    # Fetch assignment
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Verify ownership
    if assignment.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="You can only modify your own assignments")
    
    # If settings is empty dict or has "inherit" flag, set to null (inherit from teacher)
    if not settings or settings.get("inherit") is True:
        assignment.logging_settings = None
        db.add(assignment)
        await db.commit()
        return {
            "message": "Assignment will now inherit teacher's base logging settings",
            "settings": None
        }
    
    # Validate settings structure
    required_fields = [
        "log_level", "track_keystrokes", "track_cursor_moves",
        "track_paste_events", "track_ai_interactions", "track_run_events",
        "cursor_tracking_interval", "batch_interval"
    ]
    
    for field in required_fields:
        if field not in settings:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Validate log_level
    if settings["log_level"] not in ["verbose", "standard", "minimal"]:
        raise HTTPException(status_code=400, detail="Invalid log_level. Must be 'verbose', 'standard', or 'minimal'")
    
    # Validate intervals
    if not (1000 <= settings["cursor_tracking_interval"] <= 10000):
        raise HTTPException(status_code=400, detail="cursor_tracking_interval must be between 1000 and 10000")
    
    if not (3 <= settings["batch_interval"] <= 30):
        raise HTTPException(status_code=400, detail="batch_interval must be between 3 and 30")
    
    # Update assignment's logging settings (override) - serialize to JSON string
    assignment.logging_settings = json.dumps(settings)
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    
    return {
        "message": "Assignment-specific logging settings updated successfully",
        "settings": settings
    }
