
# COGNICODE - Requirements Specification Document (RSD)

## 1. System Overview
COGNICODE is a human-centered coding platform designed to integrate AI responsibly in education. It logs all coding interactions, allowing teachers to review engagement and detect AI reliance via session replays.

---

## 2. Architecture
**Frontend:** React + TypeScript + Monaco Editor + Zustand  
**Backend:** FastAPI + SQLite (aiosqlite) + SQLAlchemy  
**Execution:** Subprocess with resource limits (256MB RAM, 30s timeout)  
**AI:** Remote Ollama (https://194.42.17.230:443)  
**Roles:** Student, Teacher

**Tech Stack Details:**
- React 18 with TypeScript for type safety
- Monaco Editor for code editing with IntelliSense
- Zustand for lightweight state management
- FastAPI for async API with automatic OpenAPI docs
- SQLite with async support for development simplicity
- subprocess-based execution with shlex for security
- JWT authentication with bcrypt password hashing

---

## 3. Functional Requirements

### F1 - Authentication
- JWT-based login (student/teacher)
- Teachers view assigned student data only

### F2 - Assignment Management
**Teacher Actions:**
- Create assignments with title, description, language, AI mode
- Upload starter code files (JSON array) - code files students will edit
- Upload support files (JSON array) - build/config files for execution
- Specify custom build/run commands (optional, defaults provided)
- Set AI mode: None, Lead-and-Reveal, or Full Access
- Edit and delete assignments

**Student Actions:**
- View available assignments
- Choose AI preference at start (tracked for transparency)
- See assignment description in task pane

**Starter Code vs Support Files:**
- **Starter Code**: Actual code files (.java, .py, .c) displayed as editable file tree
- **Support Files**: Build files (requirements.txt, Makefile, headers) for execution engine
- Both stored as JSON: `[{"name": "...", "path": "...", "content": "..."}]`

### F3 - Code Editor
**Features:**
- Monaco editor with syntax highlighting and IntelliSense
- File explorer with directory tree view (starter code + support files)
- Multi-file project support with file switching
- Students can create, edit, delete files
- Run code button with real execution output
- Task pane showing assignment description
- AI help panel (conditional based on ai_mode)

**File Management:**
- Click file in tree  opens in editor
- Edit code  changes logged with timestamps
- Switch files  current file saved automatically
- All edits tracked with file path for replay

**Memory Management:**
- Maximum 1000 events in memory
- 500ms throttle on edit events
- 5-second batch uploads to backend
- Offline fallback buffer

### F4 - Session Logging
**Events Recorded:**
- `edit`: Code changes with diff (includes file path for multi-file projects)
- `cursor`: Cursor position moves
- `paste`: Paste events with size detection (>100 chars flagged as potential AI content)
- `run`: Code execution request with all files included
- `ai_prompt`: Student's reasoning input before AI help
- `ai_response`: AI's code suggestion
- `file_create`: Student creates new file
- `file_delete`: Student deletes file
- `file_switch`: Student switches between files

**Event Structure:**
Each event includes:
- `attempt_id`: Links to student attempt
- `t`: Timestamp (milliseconds since attempt start)
- `type`: Event type from above
- `payload_json`: Event-specific data
- `sequence_number`: For ordering

**Batching:**
- Events batched every 5 seconds
- Maximum 1000 events in memory before forced upload
- Edit events throttled to 500ms to prevent flood

### F5 - AI Assistance
**AI Modes:**
- **None**: No AI assistance available
- **Lead-and-Reveal**: Student provides reasoning first, then AI reveals code
- **Full Access**: Student can request AI help freely

**Student AI Choice:**
- Modal appears when starting assignment
- Student explicitly chooses to use AI or not
- Choice tracked in `attempts.student_ai_choice` for transparency

**AI Integration:**
- Remote Ollama server at https://194.42.17.230:443
- OpenAI-compatible API format
- Supported models: phi-3-mini, mistral-7b, llama-3
- All interactions logged with model name, temperature, hash

**Lead-and-Reveal Flow:**
1. Student provides reasoning/explanation
2. AI analyzes reasoning
3. AI reveals code suggestion only after reasoning
4. Full interaction logged for teacher review

### F6 - Code Execution
**Execution Engine:**
- Subprocess-based execution (not Docker)
- Multi-file project support
- Separate build and run phases
- Custom commands or language defaults

**Resource Limits:**
- 256MB RAM maximum (RLIMIT_AS)
- 30-second timeout for run phase
- 120-second timeout for build phase
- No network access
- Isolated temp directory (cleaned after execution)

**Security:**
- Commands parsed with shlex.split() to prevent injection
- Subprocess with shell=False
- Temp directory per execution
- Automatic cleanup on completion or timeout

**Language Support:**
- **Python**: pip install  python main.py
- **Java**: javac *.java  java Main
- **C**: gcc *.c -o app  ./app
- **C++**: g++ *.cpp -o app  ./app

**Custom Commands:**
Teachers can override defaults:
- `build_command`: e.g., "pip install -r requirements.txt && npm install"
- `run_command`: e.g., "python -m pytest", "make run"

**Execution Flow:**
1. Write all starter code + support files to temp directory
2. Execute build command (if specified)
3. Execute run command with main file
4. Capture stdout, stderr, exit code, execution time
5. Return results with build output + run output separately
6. Clean up temp directory

**Output Format:**
```json
{
  "status": "success|error|timeout|compilation_error",
  "stdout": "program output",
  "stderr": "error messages",
  "exit_code": 0,
  "execution_time": 1.234,
  "build_output": {
    "stdout": "build output",
    "stderr": "build errors",
    "exit_code": 0,
    "execution_time": 2.345
  }
}
```

### F7 - Replay System (Teacher-Only)
**Features:**
- Timeline playback of student coding session
- Code state reconstruction at any timestamp using diffs
- File-by-file replay for multi-file projects
- Visualize student workflow across files

**Metrics Displayed:**
- Active typing time (excludes idle periods >30s)
- Paste event count and average size
- AI interaction count and reasoning quality
- Run frequency and success rate
- Session length and submission time
- Files created/deleted/modified

**Replay Controls:**
- Play/pause timeline
- Seek to specific timestamp
- Speed control (1x, 2x, 4x)
- Jump to events (pastes, AI interactions, runs)

**Teacher Insights:**
- Identify struggling points (long idle times)
- Detect potential AI-generated pastes (large size)
- Assess AI reliance vs independent work
- Review problem-solving approach across files
- View AI history, run results, and metrics
- Engagement visualization

### F8 - Engagement Metrics
- Active typing time
- Paste event count
- AI interactions count
- Run frequency and session length

---

## 4. Non-Functional Requirements
| Category | Description |
|-----------|-------------|
| Performance | 2s response under 100 users |
| Security | HTTPS, container isolation |
| Reliability | Offline buffered logs |
| Privacy | GDPR/FERPA alignment |
| Extensibility | Modular front-end components |
| Transparency | Visible AI usage count |

---

## 5. Database Schema

### users
```
id | role | username | email | password_hash
```

### assignments
```
id | title | description | language | ai_mode | version_hash
```

### attempts
```
id | assignment_id | user_id | started_at | finished_at | mode | total_score
```

### events
```
id | attempt_id | t | type | payload_json
```

### ai_interactions
```
id | attempt_id | prompt | response | model_name | parameters | created_at
```

### runs
```
id | attempt_id | code_snapshot | stdout | stderr | exit_code | run_time
```

---

## 6. Security
- Sandboxed code execution (Docker)
- HTTPS-only API
- Encrypted logs (pgcrypto)
- Teacher access logging

---

## 7. Deployment
| Component | Technology | Deployment |
|------------|-------------|-------------|
| Frontend | React/Vite | Nginx container |
| Backend | FastAPI | Docker container |
| DB | PostgreSQL | Docker |
| Object Storage | MinIO | Docker |
| Execution | Docker-in-Docker | Microservice |
| AI | Llama3 / Mistral | Local API |

---

## 7. Future Extensions

### Planned Features
- **Multi-language Support**: JavaScript/TypeScript, Go, Rust
- **Live Pair Programming**: Real-time collaborative editing
- **Reflection Questions**: Post-assignment metacognitive prompts
- **LMS Integration**: LTI 1.3 for Canvas, Moodle, Blackboard
- **Code Visualization**: AST visualization, execution flow diagrams
- **Automated Grading**: Test case execution with scoring
- **Plagiarism Detection**: Code similarity analysis
- **Docker Isolation**: Container-based execution for better security
- **PostgreSQL Migration**: Production database for scalability
- **Assignment Templates**: Pre-built assignment library
- **Student Dashboard**: Progress tracking, statistics
- **Code Review**: Teacher inline comments on student code
- **Video Recording**: Optional screen + webcam recording
- **Analytics Dashboard**: Class-wide engagement metrics
- **Export Features**: Session data export for research
- **Mobile Support**: Responsive design for tablets

### Current Limitations
- SQLite (single-writer limit for high concurrency)
- Subprocess execution (limited isolation vs Docker)
- No real-time collaboration
- No automated test execution
- Manual grading only
- Single language per assignment
- No code completion from AI during typing (only on-demand)

### Research Opportunities
- AI reliance detection algorithms
- Engagement pattern analysis
- Learning trajectory modeling
- Pedagogical AI prompt engineering
- Code comprehension assessment via replay analysis

---

## 9. Success Criteria
- Functional code editor with optional AI support
- Secure and reliable execution
- Full session replay for teacher review
- Transparent AI engagement tracking
