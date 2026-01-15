from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    STUDENT = "Student"
    TEACHER = "Teacher"


class AIMode(str, enum.Enum):
    NONE = "none"
    LEAD_AND_REVEAL = "lead-and-reveal"
    TRACE_AND_PREDICT = "trace-and-predict"
    PARSONS = "parsons"
    FULL_ACCESS = "full-access"


class FrictionTechnique(str, enum.Enum):
    """Friction-induced cognitive engagement techniques."""
    BASELINE = "baseline"
    LEAD_AND_REVEAL = "lead-and-reveal"
    TRACE_AND_PREDICT = "trace-and-predict"
    PARSONS = "parsons"
    PSEUDO_CODE = "pseudo-code"
    SELF_EXPLAIN = "self-explain"
    VERIFICATION = "verification"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.STUDENT)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Logging settings for teachers (stored as JSON text)
    logging_settings = Column(Text, nullable=True)
    
    # Relationships
    attempts = relationship("Attempt", back_populates="user", cascade="all, delete-orphan")


class Assignment(Base):
    __tablename__ = "assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    language = Column(String(50), nullable=False)  # python, c, java
    ai_mode = Column(SQLEnum(AIMode), nullable=False, default=AIMode.NONE)
    version_hash = Column(String(64), nullable=True)
    
    # Starter code: JSON array of code files students will edit
    # Example: [{"name": "Main.java", "path": "src/Main.java", "content": "class Main {...}"}]
    starter_code = Column(Text, nullable=True)
    
    test_cases = Column(Text, nullable=True)  # JSON string
    
    # Support files: JSON array of build/config files for execution engine  
    # Example: [{"name": "requirements.txt", "path": "requirements.txt", "content": "numpy==1.21.0"}]
    support_files = Column(Text, nullable=True)
    
    # Custom build and run commands (optional, defaults used if not specified)
    run_command = Column(Text, nullable=True)  # e.g., "python main.py", "make && ./app"
    build_command = Column(Text, nullable=True)  # e.g., "pip install -r requirements.txt"
    
    # Logging settings for this assignment (overrides teacher's base settings if set)
    # If null, inherits from teacher's logging_settings
    logging_settings = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    attempts = relationship("Attempt", back_populates="assignment", cascade="all, delete-orphan")


class Attempt(Base):
    __tablename__ = "attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    mode = Column(String(50), nullable=True)  # practice, graded, etc.
    total_score = Column(Float, nullable=True)
    final_code = Column(Text, nullable=True)
    student_ai_choice = Column(SQLEnum(AIMode), nullable=True)  # Student's AI preference
    
    # Relationships
    assignment = relationship("Assignment", back_populates="attempts")
    user = relationship("User", back_populates="attempts")
    events = relationship("Event", back_populates="attempt", cascade="all, delete-orphan")
    ai_interactions = relationship("AIInteraction", back_populates="attempt", cascade="all, delete-orphan")
    runs = relationship("Run", back_populates="attempt", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"), nullable=False)
    t = Column(Float, nullable=False)  # timestamp in seconds since attempt start
    seq = Column(Integer, nullable=False)  # sequence number
    type = Column(String(50), nullable=False)  # edit, cursor, paste, run, ai_prompt, ai_response
    file_path = Column(String(500), nullable=True)  # NEW: For multi-file project support
    payload_json = Column(Text, nullable=False)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    attempt = relationship("Attempt", back_populates="events")
    
    # Performance indexes - CRITICAL for fast replay queries
    __table_args__ = (
        # Composite index for replay: SELECT * FROM events WHERE attempt_id = X ORDER BY seq
        # This makes replay queries 10-100 faster (index scan vs full table scan)
        Index('idx_events_attempt_seq', 'attempt_id', 'seq'),
        
        # Index for time-based queries: WHERE attempt_id = X AND t <= Y
        Index('idx_events_attempt_time', 'attempt_id', 't'),
        
        # Index for event type filtering: WHERE type = 'paste'
        Index('idx_events_type', 'type'),
        
        # Index for multi-file queries: WHERE attempt_id = X AND file_path = 'src/main.py'
        Index('idx_events_file', 'file_path'),
    )


class AIInteraction(Base):
    __tablename__ = "ai_interactions"
    
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"), nullable=False)
    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    model_name = Column(String(100), nullable=False)
    parameters = Column(Text, nullable=True)  # JSON string (temperature, etc.)
    tokens = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    hash = Column(String(64), nullable=True)
    
    # Relationships
    attempt = relationship("Attempt", back_populates="ai_interactions")


class RunStatus(str, enum.Enum):
    """Status of a code execution job."""
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    COMPILATION_ERROR = "compilation_error"
    CANCELLED = "cancelled"


class Run(Base):
    __tablename__ = "runs"
    
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"), nullable=False, index=True)
    
    # Job state
    status = Column(SQLEnum(RunStatus), nullable=False, default=RunStatus.QUEUED, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    
    # Build phase output
    build_stdout = Column(Text, nullable=True)
    build_stderr = Column(Text, nullable=True)
    build_exit_code = Column(Integer, nullable=True)
    build_time = Column(Float, nullable=True)
    
    # Run phase output
    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    exit_code = Column(Integer, nullable=True)
    run_time = Column(Float, nullable=True)  # execution time in seconds
    
    # Snapshots & metadata
    code_snapshot = Column(Text, nullable=True)  # Full code snapshot if ≤256KB
    snapshot_hash = Column(String(64), nullable=True)  # SHA256 of files
    request_json = Column(Text, nullable=True)  # Full request payload for reproducibility
    
    # Relationships
    attempt = relationship("Attempt", back_populates="runs")
    
    # Performance indexes
    __table_args__ = (
        Index('idx_runs_attempt_status', 'attempt_id', 'status'),
        Index('idx_runs_created', 'created_at'),
    )


class UserTechniqueSequence(Base):
    """Tracks which techniques are assigned to which students for structured sequencing."""
    __tablename__ = "user_technique_sequences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)
    
    # Current technique for this user on this assignment
    current_technique = Column(SQLEnum(FrictionTechnique), nullable=False, default=FrictionTechnique.BASELINE)
    current_technique_index = Column(Integer, default=0)  # Position in sequence
    
    # Sequence of techniques (comma-separated enum values, e.g., "baseline,lead-and-reveal,parsons")
    # Rotates through these techniques for different attempts
    technique_sequence = Column(String(255), nullable=False, default="baseline,lead-and-reveal,trace-and-predict,parsons")
    
    # Track progress
    attempts_completed = Column(Integer, default=0)
    last_technique_changed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    assignment = relationship("Assignment")


class HintLevel(Base):
    """Store tiered hints for friction techniques."""
    __tablename__ = "hint_levels"
    
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"), nullable=False, index=True)
    technique = Column(SQLEnum(FrictionTechnique), nullable=False)
    
    # Hint content for each level (escalating guidance)
    level_1_hint = Column(Text, nullable=False)  # Shallow hint (e.g., "Consider using a loop")
    level_2_hint = Column(Text, nullable=False)  # Deeper hint (e.g., "You'll need to iterate 5 times")
    level_3_hint = Column(Text, nullable=False)  # Full solution hint (e.g., "for i in range(5): ...")
    
    # Track which hints were used
    hints_requested = Column(Integer, default=0)  # 0, 1, 2, or 3
    last_hint_requested_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    attempt = relationship("Attempt")
