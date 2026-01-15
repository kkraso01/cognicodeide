"""
Code execution endpoints for COGNICODE.

Supports both Phase 1 (in-process) and Phase 2 (Redis) via QUEUE_BACKEND setting.

Phase 1: In-process queue
- POST /api/execute: Enqueue job (return run_id, 202)
- GET /api/execute/{run_id}: Poll status/results (200)

Phase 2: Redis + ARQ worker
- Same API, but jobs are processed by separate worker process

Design:
- Enqueue is fast (DB write + queue add)
- Worker processes jobs asynchronously
- Client polls for results
- All outputs persisted for replay/analytics
"""
import json
import hashlib
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth_utils import get_current_user
from app.database import get_db
from app.models.models import User, Run, RunStatus, Attempt
from app.schemas.execute_schemas import (
    ExecuteRequest, ExecuteEnqueueResponse, ExecuteResultResponse, ExecuteErrorResponse
)
from app.services.execution_queue import get_queue_manager, get_redis_pool
from app.config import settings

router = APIRouter(prefix="/api/execute", tags=["Execution"])
logger = logging.getLogger(__name__)


@router.post("", response_model=ExecuteEnqueueResponse, status_code=status.HTTP_202_ACCEPTED)
async def enqueue_execution(
    request: ExecuteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Enqueue a code execution job.
    
    Returns 202 Accepted with run_id immediately.
    Client polls GET /api/execute/{run_id} to get results.
    
    Status codes:
    - 202: Job enqueued successfully
    - 409: Run already in progress for this attempt (strict lock)
    - 429: Too many recent runs for this attempt (throttle)
    - 503: Queue overloaded
    - 400: Invalid request
    """
    
    # Validate attempt exists and user has access
    stmt = select(Attempt).where(Attempt.id == request.attempt_id)
    attempt = (await db.execute(stmt)).scalar_one_or_none()
    
    if not attempt:
        raise HTTPException(status_code=400, detail="Attempt not found")
    
    if attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Check for existing queued/running run (strict lock)
    stmt = select(Run).where(
        Run.attempt_id == request.attempt_id,
        Run.status.in_([RunStatus.QUEUED, RunStatus.RUNNING])
    )
    existing_run = (await db.execute(stmt)).scalar_one_or_none()
    
    if existing_run:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Run already in progress for this attempt (run_id={existing_run.id})"
        )
    
    # Check throttle (rate limit per attempt)
    stmt = select(Run).where(
        Run.attempt_id == request.attempt_id
    ).order_by(Run.created_at.desc()).limit(1)
    
    last_run = (await db.execute(stmt)).scalar_one_or_none()
    
    if last_run:
        time_since_last = datetime.utcnow() - last_run.created_at
        if time_since_last < timedelta(seconds=settings.RUN_ENQUEUE_THROTTLE):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {settings.RUN_ENQUEUE_THROTTLE}s between runs"
            )
    
    # Create Run record with queued status
    new_run = Run(
        attempt_id=request.attempt_id,
        status=RunStatus.QUEUED,
        created_at=datetime.utcnow()
    )
    
    db.add(new_run)
    await db.flush()  # Get the ID
    run_id = new_run.id
    
    # Prepare payload for queue
    payload = {
        'attempt_id': request.attempt_id,
        'language': request.language,
        'files': [f.dict() for f in request.files],
        'stdin': request.stdin or '',
        'build_command': request.build_command,
        'run_command': request.run_command,
    }
    
    # Store request JSON for reproducibility
    new_run.request_json = json.dumps(payload)
    
    # Compute snapshot hash
    files_json = json.dumps(
        [{'name': f.name, 'path': f.path, 'content': f.content} for f in request.files]
    )
    new_run.snapshot_hash = hashlib.sha256(files_json.encode()).hexdigest()
    
    # Store full snapshot if under size threshold
    snapshot_size = len(files_json.encode('utf-8'))
    if snapshot_size <= settings.SNAPSHOT_SIZE_THRESHOLD:
        new_run.code_snapshot = files_json
    
    await db.commit()
    
    # Enqueue job
    if settings.QUEUE_BACKEND == "redis":
        # Phase 2: Redis
        try:
            redis = await get_redis_pool()
            await redis.enqueue_job('execute_run_job', run_id)
            logger.info(f"Enqueued run {run_id} to Redis (attempt {request.attempt_id})")
            message = "Job queued for execution (Redis)"
        except Exception as e:
            logger.error(f"Failed to enqueue run {run_id} to Redis: {e}")
            new_run.status = RunStatus.ERROR
            new_run.stderr = f"Queue error: {str(e)}"
            new_run.finished_at = datetime.utcnow()
            await db.commit()
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Queue unavailable")
    else:
        # Phase 1: In-process
        queue_manager = get_queue_manager()
        success, message = await queue_manager.enqueue_job(run_id, payload)
        
        if not success:
            # If enqueue failed, mark run as error
            new_run.status = RunStatus.ERROR
            new_run.stderr = message
            new_run.finished_at = datetime.utcnow()
            await db.commit()
            
            if "overloaded" in message.lower():
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=message)
            else:
                raise HTTPException(status_code=400, detail=message)
        
        logger.info(f"Enqueued run {run_id} to in-process queue (attempt {request.attempt_id})")
    
    return ExecuteEnqueueResponse(
        run_id=run_id,
        status="queued",
        position=get_queue_manager().get_queue_position() if settings.QUEUE_BACKEND == "in-process" else None,
        message=message
    )


@router.get("/{run_id}", response_model=ExecuteResultResponse)
async def get_execution_result(
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Poll the status and results of a code execution job.
    
    Returns immediately (non-blocking):
    - If status is 'queued' or 'running': partial response
    - If status is terminal: full output
    
    Status codes:
    - 200: Run found (any status)
    - 404: Run not found
    - 403: Unauthorized
    """
    
    stmt = select(Run).where(Run.id == run_id)
    run = (await db.execute(stmt)).scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    # Check authorization
    stmt = select(Attempt).where(Attempt.id == run.attempt_id)
    attempt = (await db.execute(stmt)).scalar_one()
    
    if attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Compute total time
    total_time = None
    if run.finished_at and run.started_at:
        total_time = (run.finished_at - run.started_at).total_seconds()
    
    return ExecuteResultResponse(
        run_id=run.id,
        attempt_id=run.attempt_id,
        status=run.status.value,
        build_output={
            'stdout': run.build_stdout or '',
            'stderr': run.build_stderr or '',
            'exit_code': run.build_exit_code or 0,
            'execution_time': run.build_time or 0.0
        } if run.build_stdout or run.build_stderr else None,
        stdout=run.stdout,
        stderr=run.stderr,
        exit_code=run.exit_code,
        run_time=run.run_time,
        created_at=run.created_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
        total_time=total_time
    )

