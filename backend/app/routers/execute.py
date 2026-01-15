from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.auth_utils import get_current_user
from app.models.models import User
from app.services.executor_service import CodeExecutor

router = APIRouter(prefix="/api/execute", tags=["Execution"])


class FileData(BaseModel):
    name: str
    content: str
    is_main: bool = False


class ExecuteRequest(BaseModel):
    language: str
    code: Optional[str] = None  # For single-file backward compatibility
    files: Optional[List[FileData]] = None  # For multi-file projects
    input_data: str = ""
    build_command: Optional[str] = None
    run_command: Optional[str] = None


class BuildOutput(BaseModel):
    stdout: str
    stderr: str
    time: float


class ExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float
    total_time: Optional[float] = None
    status: str
    build_output: Optional[BuildOutput] = None


@router.post("", response_model=ExecuteResponse)
async def execute_code(
    request: ExecuteRequest,
    current_user: User = Depends(get_current_user)
):
    """Execute code and return results. Supports both single-file and multi-file projects."""
    
    # Convert to files format
    if request.files:
        files = [f.dict() for f in request.files]
    elif request.code:
        # Single file backward compatibility
        ext_map = {'python': 'py', 'java': 'java', 'c': 'c', 'cpp': 'cpp'}
        ext = ext_map.get(request.language.lower(), 'txt')
        files = [{'name': f'main.{ext}', 'content': request.code, 'is_main': True}]
    else:
        raise HTTPException(status_code=400, detail="Either 'code' or 'files' must be provided")
    
    result = await CodeExecutor.execute_project(
        request.language,
        files,
        request.input_data,
        request.build_command,
        request.run_command
    )
    return result
