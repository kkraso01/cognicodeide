"""
Phase 2: ARQ worker for Redis-backed execution queue.

Run as separate process:
  python -m arq app.workers.execution_worker.WorkerSettings

This worker consumes jobs from Redis and executes them, persisting results to DB.
"""
import logging
import json
import hashlib
from datetime import datetime
from typing import Dict, Any
from arq import cron
from arq.worker import Worker
from sqlalchemy import select
from app.config import settings
from app.database import async_session_maker
from app.models.models import Run, RunStatus, Attempt
from app.services.executor_service import ExecutorService

logger = logging.getLogger(__name__)


async def execute_run_job(ctx: Dict[str, Any], run_id: int) -> Dict[str, Any]:
    """
    ARQ job function: Execute a single run.
    
    Called by Redis when job is dequeued.
    Persists results back to database.
    """
    logger.info(f"[Worker] Starting execution of run {run_id}")
    
    async with async_session_maker() as session:
        try:
            # Load run + request from DB
            stmt = select(Run).where(Run.id == run_id)
            db_run = (await session.execute(stmt)).scalar_one_or_none()
            
            if not db_run:
                logger.error(f"[Worker] Run {run_id} not found in DB")
                return {"status": "error", "message": "Run not found"}
            
            # Parse request payload
            try:
                payload = json.loads(db_run.request_json)
            except Exception as e:
                logger.error(f"[Worker] Failed to parse request for run {run_id}: {e}")
                db_run.status = RunStatus.ERROR
                db_run.stderr = f"Invalid request JSON: {str(e)}"
                db_run.finished_at = datetime.utcnow()
                await session.commit()
                return {"status": "error", "message": f"Invalid request: {str(e)}"}
            
            # Update status to running
            db_run.status = RunStatus.RUNNING
            db_run.started_at = datetime.utcnow()
            await session.commit()
            
            # Execute the code
            result = await ExecutorService.run_project(
                language=payload['language'],
                files=payload['files'],
                stdin=payload.get('stdin', ''),
                build_command=payload.get('build_command'),
                run_command=payload.get('run_command'),
            )
            
            # Determine final status
            status_map = {
                'success': RunStatus.SUCCESS,
                'error': RunStatus.ERROR,
                'timeout': RunStatus.TIMEOUT,
                'compilation_error': RunStatus.COMPILATION_ERROR,
            }
            final_status = status_map.get(result['status'], RunStatus.ERROR)
            
            # Store snapshot if under threshold
            snapshot_json = json.dumps([
                {'name': f['name'], 'path': f['path'], 'content': f['content']}
                for f in payload['files']
            ])
            snapshot_size = len(snapshot_json.encode('utf-8'))
            code_snapshot = snapshot_json if snapshot_size <= settings.SNAPSHOT_SIZE_THRESHOLD else None
            snapshot_hash = hashlib.sha256(snapshot_json.encode()).hexdigest()
            
            # Calculate times
            build_time = result.get('build_result', {}).get('execution_time') if result.get('build_result') else None
            run_time = result.get('execution_time')
            total_time = (build_time or 0) + (run_time or 0)
            
            # Update run with results
            db_run.status = final_status
            db_run.finished_at = datetime.utcnow()
            db_run.code_snapshot = code_snapshot
            db_run.snapshot_hash = snapshot_hash
            
            # Build output
            if result.get('build_result'):
                db_run.build_stdout = result['build_result'].get('stdout')
                db_run.build_stderr = result['build_result'].get('stderr')
                db_run.build_exit_code = result['build_result'].get('exit_code')
                db_run.build_time = build_time
            
            # Run output
            db_run.stdout = result.get('stdout')
            db_run.stderr = result.get('stderr')
            db_run.exit_code = result.get('exit_code')
            db_run.run_time = run_time
            
            await session.commit()
            
            logger.info(
                f"[Worker] Run {run_id} completed with status {final_status.value} "
                f"(total_time={total_time:.2f}s)"
            )
            
            return {
                "status": final_status.value,
                "run_id": run_id,
                "total_time": total_time
            }
        
        except Exception as e:
            logger.error(f"[Worker] Error executing run {run_id}: {e}", exc_info=True)
            
            # Mark as error
            stmt = select(Run).where(Run.id == run_id)
            db_run = (await session.execute(stmt)).scalar_one_or_none()
            
            if db_run:
                db_run.status = RunStatus.ERROR
                db_run.stderr = f"Worker error: {str(e)}"
                db_run.finished_at = datetime.utcnow()
                await session.commit()
            
            return {"status": "error", "message": f"Execution failed: {str(e)}"}


async def startup(ctx: Dict[str, Any]) -> None:
    """Called when worker starts."""
    logger.info(f"[Worker] Starting ARQ worker (redis={settings.REDIS_URL})")


async def shutdown(ctx: Dict[str, Any]) -> None:
    """Called when worker shuts down."""
    logger.info("[Worker] Shutting down ARQ worker")


class WorkerSettings:
    """ARQ worker configuration."""
    
    functions = [execute_run_job]
    on_startup = startup
    on_shutdown = shutdown
    
    # Redis connection
    redis_settings = {
        'host': settings.REDIS_HOST,
        'port': settings.REDIS_PORT,
        'database': settings.REDIS_DB,
    }
    
    # Worker behavior
    allow_abort_jobs = True
    job_timeout = settings.EXECUTION_TIMEOUT + 30  # 30s buffer for cleanup
    keep_result = 3600  # Keep results 1 hour
    max_jobs = 10  # Max concurrent jobs per worker
