"""
Execution queue manager supporting both Phase 1 (in-process) and Phase 2 (Redis).

Phase 1: Uses asyncio.Queue + worker pool (single server)
Phase 2: Uses Redis + ARQ (distributed, multi-server)

Set QUEUE_BACKEND in .env to switch:
  QUEUE_BACKEND=in-process   # Phase 1
  QUEUE_BACKEND=redis        # Phase 2
"""
import asyncio
import json
import hashlib
import logging
from typing import Dict, Optional, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.models.models import Run, RunStatus, Attempt
from app.services.executor_service import ExecutorService

logger = logging.getLogger(__name__)


class ExecutionJob:
    """Internal representation of a job in the queue."""
    def __init__(self, run_id: int, payload: Dict):
        self.run_id = run_id
        self.payload = payload
        self.attempt_id = payload['attempt_id']
        self.created_at = datetime.utcnow()


class ExecutionQueueManager:
    """
    Manages in-process execution queue with worker pool.
    Designed for single-server deployment (Phase 1).
    """
    
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=settings.QUEUE_MAX_SIZE)
        self.semaphore: asyncio.Semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_EXECUTIONS)
        self.workers_running = False
        self.worker_tasks = []
        self.last_enqueue_time: Dict[int, float] = {}  # attempt_id -> timestamp
    
    async def enqueue_job(self, run_id: int, payload: Dict) -> Tuple[bool, str]:
        """
        Enqueue a job for execution.
        
        Returns:
            (success: bool, message: str)
        """
        try:
            job = ExecutionJob(run_id, payload)
            await asyncio.wait_for(
                self.queue.put(job),
                timeout=1.0
            )
            logger.info(f"Enqueued run {run_id} (attempt {job.attempt_id})")
            return True, f"Job enqueued (position: {self.queue.qsize()})"
        except asyncio.TimeoutError:
            logger.error(f"Queue full, rejecting run {run_id}")
            return False, "Execution queue overloaded"
        except Exception as e:
            logger.error(f"Failed to enqueue run {run_id}: {e}")
            return False, f"Enqueueing failed: {str(e)}"
    
    def get_queue_position(self) -> int:
        """Get current queue size."""
        return self.queue.qsize()
    
    async def start_workers(self, num_workers: int = 2) -> None:
        """Start worker tasks."""
        if self.workers_running:
            logger.warning("Workers already running")
            return
        
        self.workers_running = True
        self.worker_tasks = [
            asyncio.create_task(self._worker_loop(i))
            for i in range(num_workers)
        ]
        logger.info(f"Started {num_workers} execution workers")
    
    async def shutdown(self) -> None:
        """Shutdown workers gracefully."""
        self.workers_running = False
        
        # Wait for workers to finish current jobs
        if self.worker_tasks:
            await asyncio.gather(*self.worker_tasks, return_exceptions=True)
        
        logger.info("Execution workers shut down")
    
    async def _worker_loop(self, worker_id: int) -> None:
        """Worker coroutine that processes jobs from the queue."""
        logger.info(f"Worker {worker_id} started")
        
        while self.workers_running:
            try:
                # Get next job (with timeout to check shutdown flag)
                job = await asyncio.wait_for(
                    self.queue.get(),
                    timeout=1.0
                )
                
                async with self.semaphore:
                    await self._execute_job(job, worker_id)
                
                self.queue.task_done()
            
            except asyncio.TimeoutError:
                # No job available; check shutdown flag and continue
                continue
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
        
        logger.info(f"Worker {worker_id} stopped")
    
    async def _execute_job(self, job: ExecutionJob, worker_id: int) -> None:
        """Execute a single job and persist results."""
        run_id = job.run_id
        attempt_id = job.attempt_id
        
        logger.info(f"Worker {worker_id} executing run {run_id}")
        
        # Import here to avoid circular dependency
        from app.database import async_session_maker
        
        async with async_session_maker() as session:
            try:
                # Mark as running
                await self._update_run_status(
                    session, run_id, RunStatus.RUNNING, started_at=datetime.utcnow()
                )
                
                # Execute the code
                result = await ExecutorService.run_project(
                    language=job.payload['language'],
                    files=job.payload['files'],
                    stdin=job.payload.get('stdin', ''),
                    build_command=job.payload.get('build_command'),
                    run_command=job.payload.get('run_command'),
                )
                
                # Determine final status
                status = result['status']
                if status == 'timeout':
                    final_status = RunStatus.TIMEOUT
                elif status == 'compilation_error':
                    final_status = RunStatus.COMPILATION_ERROR
                elif status == 'error' and result.get('exit_code') != 0:
                    final_status = RunStatus.ERROR
                else:
                    final_status = RunStatus.SUCCESS
                
                # Persist snapshot if under size threshold
                snapshot_json = json.dumps([
                    {'name': f['name'], 'path': f['path'], 'content': f['content']}
                    for f in job.payload['files']
                ])
                snapshot_size = len(snapshot_json.encode('utf-8'))
                code_snapshot = snapshot_json if snapshot_size <= settings.SNAPSHOT_SIZE_THRESHOLD else None
                
                # Compute hash
                snapshot_hash = hashlib.sha256(snapshot_json.encode()).hexdigest()
                
                # Build total time
                build_time = result.get('build_result', {}).get('execution_time')
                run_time = result.get('execution_time')
                total_time = (build_time or 0) + (run_time or 0)
                
                # Update run with results
                stmt = select(Run).where(Run.id == run_id)
                db_run = (await session.execute(stmt)).scalar_one()
                
                db_run.status = final_status
                db_run.finished_at = datetime.utcnow()
                db_run.code_snapshot = code_snapshot
                db_run.snapshot_hash = snapshot_hash
                db_run.request_json = json.dumps(job.payload)
                
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
                    f"Run {run_id} completed with status {final_status.value} "
                    f"(total_time={total_time:.2f}s)"
                )
            
            except Exception as e:
                logger.error(f"Error executing run {run_id}: {e}", exc_info=True)
                
                # Mark as error
                stmt = select(Run).where(Run.id == run_id)
                db_run = (await session.execute(stmt)).scalar_one_or_none()
                
                if db_run:
                    db_run.status = RunStatus.ERROR
                    db_run.stderr = f"Internal execution error: {str(e)}"
                    db_run.finished_at = datetime.utcnow()
                    await session.commit()
    
    @staticmethod
    async def _update_run_status(
        session: AsyncSession,
        run_id: int,
        status: RunStatus,
        started_at: Optional[datetime] = None,
    ) -> None:
        """Update run status in database."""
        stmt = select(Run).where(Run.id == run_id)
        run = (await session.execute(stmt)).scalar_one()
        
        run.status = status
        if started_at:
            run.started_at = started_at
        
        await session.commit()


# Global queue manager instance
_queue_manager: Optional[ExecutionQueueManager] = None
_redis_pool: Optional[object] = None


def get_queue_manager() -> ExecutionQueueManager:
    """Get or create global queue manager."""
    global _queue_manager
    if _queue_manager is None:
        _queue_manager = ExecutionQueueManager()
    return _queue_manager


async def get_redis_pool():
    """Get or create Redis pool for Phase 2."""
    global _redis_pool
    if _redis_pool is None:
        try:
            from arq.connections import create_pool
            _redis_pool = await create_pool(settings.REDIS_URL)
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    return _redis_pool
