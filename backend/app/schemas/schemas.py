from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    STUDENT = "Student"
    TEACHER = "Teacher"


class AIMode(str, Enum):
    NONE = "none"
    LEAD_AND_REVEAL = "lead-and-reveal"
    TRACE_AND_PREDICT = "trace-and-predict"
    PARSONS = "parsons"
    FULL_ACCESS = "full-access"


# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None


# Assignment Schemas
class SupportFile(BaseModel):
    name: str
    content: str
    path: Optional[str] = None


class AssignmentBase(BaseModel):
    title: str
    description: str
    language: str
    ai_mode: AIMode
    starter_code: Optional[str] = None  # JSON string of file array
    test_cases: Optional[str] = None
    support_files: Optional[str] = None  # JSON string of file array
    run_command: Optional[str] = None
    build_command: Optional[str] = None
    logging_settings: Optional[str] = None  # JSON string of logging settings (overrides teacher base if set)


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    ai_mode: Optional[AIMode] = None
    starter_code: Optional[str] = None  # JSON string of file array
    test_cases: Optional[str] = None
    support_files: Optional[str] = None  # JSON string of file array
    run_command: Optional[str] = None
    build_command: Optional[str] = None
    logging_settings: Optional[str] = None  # JSON string of logging settings


class AssignmentResponse(AssignmentBase):
    id: int
    version_hash: Optional[str] = None
    created_at: datetime
    created_by: Optional[int] = None
    
    class Config:
        from_attributes = True


# Attempt Schemas
class AttemptBase(BaseModel):
    assignment_id: int
    mode: Optional[str] = "practice"
    student_ai_choice: Optional[AIMode] = None  # Student's AI preference


class AttemptCreate(AttemptBase):
    pass


class AttemptResponse(AttemptBase):
    id: int
    user_id: int
    started_at: datetime
    finished_at: Optional[datetime] = None
    total_score: Optional[float] = None
    final_code: Optional[str] = None
    
    class Config:
        from_attributes = True


# Event Schemas
class EventCreate(BaseModel):
    t: float
    seq: int
    type: str
    file_path: Optional[str] = None  # NEW: For multi-file project support
    payload_json: str


class EventBatch(BaseModel):
    attempt_id: int
    events: List[EventCreate]


class EventResponse(BaseModel):
    id: int
    attempt_id: int
    t: float
    seq: int
    type: str
    file_path: Optional[str] = None  # NEW: For multi-file project support
    payload_json: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# AI Interaction Schemas
class AIMessage(BaseModel):
    role: str
    content: str


class AIChatRequest(BaseModel):
    messages: List[AIMessage]
    model: str = "mistral"
    temperature: float = 0.7
    max_tokens: Optional[int] = None


class AIChatResponse(BaseModel):
    id: str
    model: str
    choices: List[Dict[str, Any]]
    usage: Optional[Dict[str, int]] = None


class AIInteractionCreate(BaseModel):
    attempt_id: int
    prompt: str
    model_name: str = "mistral"
    parameters: Optional[str] = None


class AIInteractionResponse(BaseModel):
    id: int
    attempt_id: int
    prompt: str
    response: str
    model_name: str
    tokens: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Run Schemas
class RunCreate(BaseModel):
    attempt_id: int
    code_snapshot: str


class RunResponse(BaseModel):
    id: int
    attempt_id: int
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    exit_code: Optional[int] = None
    run_time: Optional[float] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Replay Schemas
class ReplayData(BaseModel):
    attempt: AttemptResponse
    events: List[EventResponse]
    ai_interactions: List[AIInteractionResponse]
    runs: List[RunResponse]


class ReplayMetrics(BaseModel):
    active_typing_time: float
    paste_count: int
    avg_paste_size: float
    ai_interaction_count: int
    run_count: int
    session_length: float
