"""
Schemas for code execution endpoints.
Handles enqueue requests and polling responses.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class RunStatus(str, Enum):
    """Status of a code execution job."""
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    COMPILATION_ERROR = "compilation_error"
    CANCELLED = "cancelled"


class FileData(BaseModel):
    """Represents a single file in a multi-file project."""
    name: str = Field(..., description="File name (e.g., 'Main.java')")
    path: str = Field(..., description="File path in project (e.g., 'src/Main.java')")
    content: str = Field(..., description="File content")
    is_main: bool = Field(False, description="Whether this is the main/entry file")


class ExecuteRequest(BaseModel):
    """Request to enqueue a code execution job."""
    language: str = Field(..., description="Language: python, java, c, cpp")
    files: List[FileData] = Field(
        ..., 
        description="List of files to execute"
    )
    attempt_id: int = Field(
        ..., 
        description="Attempt ID to link execution to"
    )
    build_command: Optional[str] = Field(
        None, 
        description="Custom build command (overrides default)"
    )
    run_command: Optional[str] = Field(
        None, 
        description="Custom run command (overrides default)"
    )
    stdin: Optional[str] = Field(
        None,
        description="Standard input for the program"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "language": "python",
                "files": [
                    {
                        "name": "main.py",
                        "path": "main.py",
                        "content": "print('Hello, World!')",
                        "is_main": True
                    }
                ],
                "attempt_id": 42,
                "build_command": None,
                "run_command": None,
                "stdin": None
            }
        }


class BuildOutput(BaseModel):
    """Output from the build phase."""
    stdout: str = Field(..., description="Build standard output")
    stderr: str = Field(..., description="Build standard error")
    exit_code: int = Field(..., description="Build exit code")
    execution_time: float = Field(..., description="Build execution time in seconds")


class ExecuteEnqueueResponse(BaseModel):
    """Response when a job is enqueued (202 Accepted)."""
    run_id: int = Field(..., description="Unique ID for this execution job")
    status: str = Field(default="queued", description="Initial status is always 'queued'")
    position: Optional[int] = Field(None, description="Position in queue (if available)")
    message: str = Field(
        default="Job queued for execution",
        description="Human-readable status message"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "run_id": 123,
                "status": "queued",
                "position": 2,
                "message": "Job queued for execution"
            }
        }


class ExecuteResultResponse(BaseModel):
    """Response from polling job status/results (200 OK)."""
    run_id: int = Field(..., description="Execution job ID")
    attempt_id: int = Field(..., description="Associated attempt ID")
    status: str = Field(..., description="Job status")
    
    # Build phase
    build_output: Optional[BuildOutput] = Field(
        None,
        description="Build phase output (if build was performed)"
    )
    
    # Run phase
    stdout: Optional[str] = Field(None, description="Program standard output")
    stderr: Optional[str] = Field(None, description="Program standard error")
    exit_code: Optional[int] = Field(None, description="Program exit code")
    run_time: Optional[float] = Field(None, description="Program execution time in seconds")
    
    # Metadata
    created_at: datetime = Field(..., description="Job creation timestamp")
    started_at: Optional[datetime] = Field(None, description="Execution start timestamp")
    finished_at: Optional[datetime] = Field(None, description="Execution completion timestamp")
    
    # Normalized total time
    total_time: Optional[float] = Field(
        None,
        description="Total elapsed time (build + run) in seconds"
    )
    
    class Config:
        from_attributes = True
        schema_extra = {
            "example": {
                "run_id": 123,
                "attempt_id": 42,
                "status": "success",
                "build_output": {
                    "stdout": "Collecting pip...",
                    "stderr": "",
                    "exit_code": 0,
                    "execution_time": 5.234
                },
                "stdout": "Hello, World!",
                "stderr": "",
                "exit_code": 0,
                "run_time": 0.123,
                "created_at": "2026-01-15T10:00:00",
                "started_at": "2026-01-15T10:00:02",
                "finished_at": "2026-01-15T10:00:07",
                "total_time": 5.357
            }
        }


class ExecuteErrorResponse(BaseModel):
    """Error response for execution endpoint."""
    detail: str = Field(..., description="Error message")
    status_code: int = Field(..., description="HTTP status code")
    run_id: Optional[int] = Field(None, description="Run ID if applicable")
    
    class Config:
        schema_extra = {
            "example": {
                "detail": "Run already in progress for this attempt",
                "status_code": 409,
                "run_id": None
            }
        }
