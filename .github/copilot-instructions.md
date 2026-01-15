# COGNICODE - AI Coding Agent Instructions

## Project Overview
COGNICODE is an AI-assisted educational coding platform that records all student interactions for transparency and learning analysis. Teachers can replay sessions to assess engagement and AI reliance.

**Tech Stack:** React + TypeScript + Monaco Editor (frontend) | FastAPI + PostgreSQL (backend) | Docker (execution sandbox) | Ollama (remote AI)

---

## Codebase Structure

### Frontend (`frontend/`)
```
src/
 components/     # Reusable UI components (Editor, AIPanel, Replay)
 hooks/          # Custom React hooks (useSessionLogger, useAuth)
 pages/          # Route pages (Student, Teacher, Assignment)
 state/          # Zustand stores (auth, session, assignments)
 utils/          # Helper functions (api client, formatters)
```

### Backend (`backend/`)
```
app/
 routers/        # FastAPI route handlers (api/ai, api/assignments, etc.)
 models/         # SQLAlchemy ORM models (User, Assignment, Event)
 schemas/        # Pydantic schemas for request/response validation
 services/       # Business logic (ai_proxy, event_logger, sandbox)
```

---

## Architecture & Data Flow

### Core Components (see `architecture.puml`)
1. **Frontend (React + Monaco)**: Code editor with AI help panel, file explorer tree view, logs all user interactions with file_path tracking for multi-file projects
2. **Backend (FastAPI)**: Exposes `/api/ai`, `/api/assignments`, `/api/events`, `/api/replay`, `/api/execute`, `/api/techniques`, `/api/tasks`
3. **Storage**: PostgreSQL with async SQLAlchemy (users, assignments, attempts, events, ai_interactions, runs, user_technique_sequences, hint_levels)
4. **AI Proxy**: Routes requests to remote Ollama using OpenAI-compatible API at `settings.OLLAMA_API_URL` (supports mistral, qwen3, llama3)
5. **Execution Engine**: Subprocess-based code execution with optional build/run phases (30s timeout, configurable via build_command, run_command)

### Critical Data Models (from `RSD.md` & `models.py`)
- **users**: id, role (Student/Teacher), username, email, password_hash, logging_settings (JSON)
- **assignments**: id, title, description, language, ai_mode, starter_code (JSON), support_files (JSON), build_command, run_command, test_cases (JSON), logging_settings (per-assignment override), version_hash
- **attempts**: Links users to assignments with started_at, finished_at, mode, student_ai_choice (AIMode enum), total_score, final_code
- **events**: Timestamped log (attempt_id, t, seq, type, file_path, payload_json) with composite indexes for replay performance
- **ai_interactions**: Full prompt/response with model_name, parameters (JSON), tokens, created_at, hash for reproducibility
- **runs**: Code snapshots with stdout, stderr, exit_code, run_time (seconds)
- **user_technique_sequences**: Track friction technique rotation per student/assignment (baseline → lead-and-reveal → trace-and-predict → parsons)
- **hint_levels**: Tiered hints (3 levels) for each friction technique attempt

### Assignment File Structure
**Starter Code Files** (stored in `starter_code` JSON field):
- Actual code files that students edit (e.g., Main.java, Utils.py, App.tsx)
- Displayed as an interactive directory tree in the student workspace
- Students can create, edit, delete files within this structure
- Example: Teacher uploads OOP skeleton classes, students implement methods

**Support Files** (stored in `support_files` JSON field):
- Build/config files needed for execution (requirements.txt, Makefile, package.json, pom.xml)
- Also displayed as a directory tree, but typically read-only or less frequently edited
- Used by the execution engine during build phase
- Example: requirements.txt for pip, .h header files for C, test data files

Both file types are stored as JSON arrays with structure:
```json
[
  {"name": "Main.java", "path": "src/Main.java", "content": "..."},
  {"name": "Utils.java", "path": "src/Utils.java", "content": "..."}
]
```

### AI Modes (AIMode enum in models.py)
- `none`: No AI assistance
- `lead-and-reveal`: AI code shown only after student provides reasoning (default pedagogical pattern)
- `trace-and-predict`: Student traces code execution before revealing output
- `parsons`: Student orders shuffled code blocks to solve problem
- `full-access`: Free AI chat without friction constraints

### Friction Techniques System (models.py: FrictionTechnique enum)
**Purpose**: Rotate engagement techniques across student attempts to reduce AI reliance:
- `baseline`: Standard coding (no special friction)
- `lead-and-reveal`: AI hidden until reasoning provided
- `trace-and-predict`: Step through execution, predict outputs
- `parsons`: Rearrange pre-written code blocks
- `pseudo-code`: Write pseudocode first, then code
- `self-explain`: Annotate code with explanations
- `verification`: Verify code against test cases before submitting

Students progress through sequence automatically across attempts. Track via `user_technique_sequences` table with tiered hints in `hint_levels`.

---

## Frontend Conventions

### Component Structure
- Use functional components with TypeScript
- Keep components small and focused (single responsibility)
- Monaco editor integration in `src/components/CodeEditor.tsx`
- File explorer tree view in `src/components/FileExplorer.tsx` (displays starter code + support files)
- AI help panel as `src/components/AIHelpPanel.tsx` (conditional based on assignment `ai_mode`)
- Task pane in `src/components/TaskPane.tsx` (shows assignment description)

### State Management (Zustand)
```typescript
// Example: src/state/sessionStore.ts
interface SessionState {
  attemptId: string | null;
  events: Event[];
  addEvent: (event: Event) => void;
}
```

### Session Logging Hook
```typescript
// src/hooks/useSessionLogger.ts
// Captures keystrokes, cursor positions, paste events (with size detection)
// Batches events every 5 seconds with offline fallback
// Include sequence numbers and timestamps on every event
```

### Event Types to Log (with mandatory fields)
- `edit`: Code changes with diff, chars_added, chars_removed, **file_path** (for multi-file projects)
- `cursor`: Cursor position (line, column), **file_path**
- `paste`: Detect size to flag potential AI-generated content (>100 chars payload), **file_path**
- `run`: Code execution request (includes all files being executed as JSON)
- `ai_prompt`: Student's reasoning input (required before code reveal in lead-and-reveal)
- `ai_response`: AI's code suggestion with model metadata
- `file_create`: Student creates new file with path
- `file_delete`: Student deletes file from project
- `file_switch`: Student switches between files (tracks active file context)
- `hint_requested`: Student requests help hint at specific level (1/2/3)

---

## Backend Conventions

### API Structure & Key Routers
All routes prefixed with `/api`:
- `/api/auth` - JWT login/logout (Student, Teacher roles)
- `/api/assignments` - CRUD for assignments, upload starter/support files
- `/api/events` - Batched POST of student events (sequence numbers, file paths required)
- `/api/ai/chat` - Proxy to Ollama OpenAI-compatible API
- `/api/replay` - Fetch session replay data with reconstructed code state (Teacher-only)
- `/api/execute` - Run code with custom build/run commands (subprocess with resource limits)
- `/api/techniques` - Manage friction technique sequences and hint levels
- `/api/tasks` - Task/todo items for assignments
- `/api/teacher-settings` - Teacher logging preferences and student session analytics

### Async Endpoints (FastAPI)
```python
# Example: app/routers/ai.py
@router.post("/api/ai/chat")
async def chat(request: AIChatRequest, user: User = Depends(get_current_user)):
    response = await ollama_service.chat_completion(
        messages=[msg.model_dump() for msg in request.messages],
        model=request.model,
        temperature=request.temperature,
        max_tokens=request.max_tokens
    )
    # Log interaction to ai_interactions table
    return response
```

### Database (PostgreSQL + async SQLAlchemy)
**Critical patterns:**
- Use async sessions (`AsyncSession`) for all DB operations - see `app.database.get_db`
- Define ORM models in `app/models/models.py` with relationships for cascade deletes
- Add Pydantic schemas in `app/schemas/` for request/response validation
- **Performance**: Event table has composite indexes (idx_events_attempt_seq, idx_events_attempt_time, idx_events_file) for fast replay queries
- Use `enum.Enum` for enums (UserRole, AIMode, FrictionTechnique) - SQLAlchemy converts to string
- JSON fields stored as Text columns, parse/serialize in schemas or services

### AI Proxy Service (app/services/ai_proxy.py)
**OllamaService class pattern:**
```python
SUPPORTED_MODELS = ["mistral", "qwen3", "llama3"]
# Call: ollama_service.chat_completion(messages, model, temperature, max_tokens, response_format)
# Returns: dict with "choices"[0]["message"]["content"] (OpenAI-compatible format)
# Always log request/response with ai_logger (see app/logging_config.py)
```
**Key methods:**
- `chat_completion()` - Async call to Ollama, handles JSON schema formatting (instructor library for structured output)
- `generate_hash()` - SHA256 of prompt + response for reproducibility
- **Configuration**: Uses `settings.OLLAMA_API_URL` from `.env`, supports custom API keys
- **Timeout**: 120 seconds per request (see httpx.AsyncClient configuration)

---

## Environment Setup

### Docker Compose (`docker-compose.yml`)
```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: cognicode
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
```

**Note:** Ollama runs remotely at `https://194.42.17.230:443`  do NOT include in compose file.

### Environment Variables (`.env.example`)
```
DATABASE_URL=postgresql://postgres:password@db:5432/cognicode
JWT_SECRET=your-secret-key-here
OLLAMA_API_URL=https://194.42.17.230:443/v1/chat/completions
OLLAMA_API_KEY=optional-if-needed
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

## Development Workflows

### Frontend Development
```bash
cd frontend
npm install
npm run dev          # Starts Vite dev server on localhost:3000
npm run build        # Production build
npm run test         # Run vitest tests
```

### Backend Development
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload  # Starts on localhost:8000
pytest                         # Run tests
```

### Testing
- **Frontend**: Vitest for unit/component tests
- **Backend**: pytest with async test fixtures
- Test event logging with mock data
- Test AI proxy with mocked Ollama responses

---

## Security & Privacy

### Authentication & Authorization
- JWT-based with role differentiation (Student, Teacher)
- Teachers access only their assigned students' data
- Log all teacher access to student sessions
- Token refresh for long sessions

### Code Execution Security
- All student code runs in isolated subprocess with resource limits
- Resource limits: 256MB RAM maximum, 30s run timeout, 120s build timeout
- No network access in execution environment
- Safe command parsing with shlex to prevent injection
- Multi-file projects written to temp directories, cleaned up after execution
- Store code snapshots with run results for replay
- Custom build/run commands controlled by teachers only

### Session Logging
- **Continuous capture**: keystrokes, cursor positions, paste events, run requests, AI prompts/responses
- **Offline buffer**: 5s batching with offline fallback
- Include sequence numbers and timestamps on every event
- Detect paste size to flag potential AI-generated content (>100 chars)

### CORS & HTTPS
- Configure CORS for local dev (`localhost:3000`) and production domains
- HTTPS-only in production
- Secure cookies for JWT tokens

### Privacy Compliance
- Pseudonymized student data (GDPR/FERPA alignment)
- Transparent AI usage counter visible to students
- Consent prompt before recording
- Store assignment version hash for reproducibility

---

## AI Models & Integration

### Supported Models (via Ollama)
- **phi-3-mini**: Lightweight, fast responses
- **mistral-7b**: Balanced performance
- **llama-3**: Higher quality reasoning

### OpenAI-Compatible API
All requests to `https://194.42.17.230:443/v1/chat/completions` follow OpenAI format:
```json
{
  "model": "phi-3-mini",
  "messages": [{"role": "user", "content": "Explain recursion"}],
  "temperature": 0.7
}
```

### AI Interaction Logging
Record every AI request/response in `ai_interactions` table:
- `prompt`, `response`, `model_name`, `parameters` (JSON), `created_at`
- Store hash for reproducibility

---

## Replay System (Teacher-Only)

### Timeline Playback
- Fetch events from `/api/replay/{attempt_id}`
- Reconstruct code state at any timestamp using diffs
- Visualize: active typing time, paste count, AI interaction count, run frequency

### Engagement Metrics
- Active typing time (excluding idle periods >30s)
- Paste event count and average size
- AI interactions count and reasoning quality
- Run frequency and test pass rate
- Session length and submission time

---

## Critical Implementation Patterns

### Multi-File Project Tracking
When editing code logic, **always include file_path in event payloads**:
```typescript
// frontend: useSessionLogger.ts tracks active file
logEvent(EVENT_TYPES.EDIT, { file_path: currentFile.path, chars_added, chars_removed });
```
Events table has index on (attempt_id, file_path) for efficient reconstruction of per-file code states during replay.

### Async Database Operations
All backend database calls must use async patterns:
```python
# app/routers/ai.py example
result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
attempt = result.scalar_one_or_none()
```
Never use synchronous `db.query()` - use `select()` statements with AsyncSession.

### Friction Technique Rotation
When creating/updating attempts, check `user_technique_sequences` to assign technique:
```python
# After attempt creation, fetch UserTechniqueSequence and rotate to next technique
sequence = await db.execute(select(UserTechniqueSequence).where(...))
current_technique = sequence.scalar_one().current_technique  # e.g., "baseline"
```
Each attempt auto-rotates students through baseline → lead-and-reveal → trace-and-predict → parsons.

### Ollama API Error Handling
Always wrap Ollama calls with try-catch and graceful fallback:
```python
try:
    response = await ollama_service.chat_completion(messages, model=request.model)
except httpx.HTTPError as e:
    logger.error(f"Ollama API failed: {e}")
    raise HTTPException(status_code=503, detail="AI service unavailable")
```
Remote Ollama at settings.OLLAMA_API_URL may timeout - set client timeout to 120s.

### Event Batching & Offline Support
Frontend batches events every 5 seconds (BATCH_INTERVAL in constants.ts):
```typescript
// useSessionLogger.ts: offline queue syncs when reconnected
pendingEventsRef.current.push(event);
if (isOnlineRef.current && pendingEventsRef.current.length > 0) {
  await api.post('/api/events', { events: offlineQueueRef.current });
}
```

---

## Key Files & References
- `architecture.puml`: System component diagram
- `MVP.md`: Feature specifications and deliverables
- `RSD.md`: Complete functional requirements and database schema
- `TECHNIQUES_API.md`: Friction technique endpoint details
- `.env.example`: Required environment variables

## Teacher Workflow for Creating Assignments

1. **Create Assignment** - Navigate to `/teacher/create-assignment`
2. **Upload Starter Code** - Upload all code files students will edit (Java classes, Python modules, etc.)
   - Files displayed as directory tree structure
   - Example: For OOP assignment, upload skeleton classes with method stubs
3. **Upload Support Files** - Upload build/config files (requirements.txt, Makefile, test data)
   - Also displayed as directory tree
   - Used by execution engine during build phase
4. **Configure Build/Run Commands** (Optional)
   - Specify custom build command (e.g., `pip install -r requirements.txt`, `javac *.java`)
   - Specify custom run command (e.g., `python main.py`, `java Main`)
   - Leave empty to use language defaults
5. **Set AI Mode** - Choose: No AI, Lead-and-Reveal, or Full Access
6. **Publish** - Assignment becomes available to students

## Student Workflow for Completing Assignments

1. **Select Assignment** - Choose from available assignments list
2. **Choose AI Preference** - Modal prompts for AI usage choice (tracked for transparency)
3. **View Project Structure** - File explorer shows:
   - Starter code files (editable)
   - Support files (reference/context)
4. **Edit Code** - Use Monaco editor with syntax highlighting
   - Switch between files using file explorer
   - All edits logged with timestamps
5. **Run Code** - Click "Run" button
   - System builds project (if build_command specified)
   - Executes code with all files
   - Shows build output + execution output separately
6. **Get AI Help** (if enabled) - Provide reasoning first, then receive code suggestions
7. **Submit** - Finish attempt when complete

---

## Future Extensions (from `RSD.md`)
Multi-language support (Python/JS/C++), live pair programming, reflection questions, LMS integration (LTI 1.3), code visualization tools
