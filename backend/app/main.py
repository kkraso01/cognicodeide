from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from app.config import settings
from app.database import init_db
from app.services.execution_queue import get_queue_manager
from app.routers import auth, assignments, events, ai, replay, teacher_settings, techniques, tasks
from app.routers import execute

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle: startup and shutdown."""
    
    # Startup
    logger.info("Initializing COGNICODE API...")
    await init_db()
    
    # Start execution queue based on backend setting
    if settings.QUEUE_BACKEND == "redis":
        logger.info(f"Using Redis queue backend ({settings.REDIS_URL})")
        logger.info("Worker must be running separately: python -m arq app.workers.execution_worker.WorkerSettings")
        try:
            from app.services.execution_queue import get_redis_pool
            await get_redis_pool()
            logger.info("Connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}. Make sure Redis is running.")
    else:
        logger.info("Using in-process queue backend (Phase 1)")
        queue_manager = get_queue_manager()
        await queue_manager.start_workers(num_workers=2)
        logger.info("Execution queue workers started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down COGNICODE API...")
    if settings.QUEUE_BACKEND == "in-process":
        queue_manager = get_queue_manager()
        await queue_manager.shutdown()
        logger.info("Execution queue workers stopped")
    logger.info("COGNICODE API shut down complete")


# Create FastAPI app
app = FastAPI(
    title="COGNICODE API",
    description="Educational coding platform with AI assistance and session replay",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(assignments.router)
app.include_router(events.router)
app.include_router(ai.router)
app.include_router(replay.router)
app.include_router(execute.router)
app.include_router(teacher_settings.router)
app.include_router(techniques.router)
app.include_router(tasks.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "COGNICODE API",
        "version": "1.0.0",
        "docs": "/docs",
        "queue": {
            "max_concurrent": settings.MAX_CONCURRENT_EXECUTIONS,
            "max_queue_size": settings.QUEUE_MAX_SIZE,
            "throttle_seconds": settings.RUN_ENQUEUE_THROTTLE
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "queue_size": get_queue_manager().get_queue_position()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
