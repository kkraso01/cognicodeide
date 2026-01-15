
# COGNICODE - MVP Specification

## Project Vision
COGNICODE is an AI-assisted educational coding environment. It enables students to code with or without AI support while recording every interaction for transparency and learning analysis. Teachers can replay sessions to assess engagement, understanding, and AI reliance.

---

## MVP Goals

| Goal | Description |
|------|--------------|
| 1 | Students can write and run code in a browser editor. |
| 2 | All edits, pastes, and runs are recorded. |
| 3 | Optional AI support using Lead-and-Reveal. |
| 4 | Teachers can replay student sessions. |
| 5 | Secure sandbox for executing student code. |
| 6 | Role-based access control (Student, Teacher). |

---

## MVP Features

### Student Interface
- Monaco editor with syntax highlighting
- Run and Submit buttons
- Problem description panel
- Optional Lead-and-Reveal AI assistant
- Background session logging (keystrokes, runs, pastes)

### Teacher Interface
- Dashboard of student attempts
- Session replay viewer (timeline, diffs, metrics)
- AI usage summaries

---

## Backend Components
- **API Server (FastAPI)**  handles authentication, assignments, event logging, replay data.
- **Execution Service**  containerized code runner.
- **AI Service**  connects to local or remote open-source LLM.
- **Database (PostgreSQL)**  stores users, assignments, events, and AI logs.
- **Object Storage (MinIO)**  large event logs and replays.
- **Auth (JWT)**  role-based permissions.

---

## Non-Functional Requirements
| Category | Requirement |
|-----------|-------------|
| Security | Docker sandbox, HTTPS, limited resource containers |
| Privacy | Pseudonymized student data, consent prompt |
| Reliability | Offline buffer + 5s batching |
| Reproducibility | Store model version and assignment hash |
| Extensibility | Modular UI and plugin architecture |
| Ethics | Transparent AI use and recording policy |

---

## MVP Deliverables
- React frontend
- FastAPI backend
- Docker-based sandbox runner
- PostgreSQL and MinIO setup
- Replay viewer prototype
- Documentation and OpenAPI spec
