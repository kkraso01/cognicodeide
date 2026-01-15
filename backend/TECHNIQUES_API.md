# Educational Techniques API

This document describes all LLM-powered educational techniques available in the COGNICODE backend. These endpoints were ported from the Node.js `code-engagement-techniques-main` repository and are now available as FastAPI endpoints.

## Overview

The techniques are organized into categories based on their pedagogical approach:

- **Baseline**: Code generation and feedback
- **Reveal**: Lead-and-reveal learning with MCQ questions
- **Tracing**: Variable tracing and execution visualization
- **Pseudo**: Pseudocode generation
- **Verify**: Code verification and issue detection
- **Token**: Token-based learning (placeholder)
- **SelfExplain**: Self-explanation exercises (placeholder)
- **Parsons**: Parsons problem generation (placeholder)
- **Hierarchical**: Hierarchical pseudocode (placeholder)
- **WriteOver**: Fill-in-the-blanks exercises (placeholder)

---

## Base URL

```
http://localhost:8000/api/techniques
```

## Authentication

All endpoints require JWT Bearer token authentication:

```
Authorization: Bearer <your-jwt-token>
```

---

## BASELINE TECHNIQUES

### 1. Generate Feedback

Compares student prompt with task descriptions to score accuracy and extract missing specifications.

**Endpoint**: `POST /baseline/generate-feedback`

**Request Body**:
```json
{
  "prompt": "Write a function that merges overlapping intervals",
  "task": "Write a function that takes a list of intervals (e.g., ranges of numbers) and merges any overlapping intervals."
}
```

**Response**:
```json
{
  "matched": "yes",
  "accuracy_score": 4,
  "matched_task_id": "1",
  "missing_specifications": [
    "Should handle edge case of empty interval list",
    "Should return a new list, not modify original"
  ]
}
```

**Use Case**: Assess how well a student understands the problem before starting to code.

---

### 2. Generate Code

Generate Python code with line-by-line explanations for a problem description.

**Endpoint**: `POST /baseline/generate`

**Request Body**:
```json
{
  "description": "Write a function to calculate the sum of even numbers in a list",
  "context": null
}
```

**Response**:
```json
{
  "code": "def sum_even(numbers):\n    total = 0\n    for num in numbers:\n        if num % 2 == 0:\n            total += num\n    return total",
  "explain": "The function iterates through each number in the list. For each number, it checks if it's even (divisible by 2). If even, it adds it to the running total. Finally, it returns the sum of all even numbers."
}
```

**Use Case**: Provide reference solutions with explanations.

---

### 3. Generate Code Snippet

Generate Python code snippets for specific intended behaviors.

**Endpoint**: `POST /baseline/generate-code`

**Request Body**:
```json
{
  "description": "ask the user for their name and age",
  "context": null
}
```

**Response**:
```json
{
  "code": "name = input('What is your name? ')\nage = int(input('How old are you? '))",
  "success": true
}
```

**Use Case**: Generate quick code examples for teaching specific programming concepts.

---

## REVEAL TECHNIQUES (Lead-and-Reveal Learning)

### 1. Generate Reveal Questions

Break code into subgoals and generate MCQ questions to guide students through code understanding.

**Endpoint**: `POST /reveal/generate-question`

**Request Body**:
```json
{
  "code": "def merge_intervals(intervals):\n    sorted_intervals = sorted(intervals, key=lambda x: x[0])\n    merged = [sorted_intervals[0]]\n    for current in sorted_intervals:\n        last = merged[-1]\n        if current[0] <= last[1]:\n            merged[-1] = (last[0], max(last[1], current[1]))\n        else:\n            merged.append(current)\n    return merged",
  "task": "Write a function that merges overlapping intervals"
}
```

**Response**:
```json
{
  "subgoals": [
    {
      "title": "Sort intervals",
      "sub_subgoal_items": [
        {
          "leading_questions": [
            {
              "mcq_question": "Why do we sort the intervals first?",
              "correct_choice": "To ensure intervals are processed in order",
              "incorrect_choice_1": "To make the code run faster",
              "incorrect_choice_2": "To reduce memory usage",
              "incorrect_choice_3": "It doesn't matter, sorting is optional"
            }
          ],
          "code_lines_to_be_revealed": [1, 2]
        }
      ]
    }
  ]
}
```

**Use Case**: Implement lead-and-reveal learning where students answer questions before seeing code.

---

### 2. Feedback from Reveal Answer

Grade student's short answer to a reveal question and provide feedback.

**Endpoint**: `POST /reveal/feedback-from-short-answer`

**Request Body**:
```json
{
  "all_code": "...",
  "code": "merged[-1] = (last[0], max(last[1], current[1]))",
  "student_solution": "We update the last interval's end to be the maximum",
  "ai_generated_solution": "We merge overlapping intervals by updating the last interval's end value to the maximum of the current and last end values",
  "question": "What does this line do?"
}
```

**Response**:
```json
{
  "response": {
    "correctness": 4,
    "feedback": "Good! You correctly identified the update. Consider mentioning it's updating to the maximum end value."
  },
  "success": true
}
```

**Use Case**: Evaluate student understanding before revealing code.

---

## TRACING TECHNIQUES

### 1. Lines to Rewrite

Analyze code and context, return rewritten code with {new}, {old} markers.

**Endpoint**: `POST /tracing/lines-to-rewrite`

**Request Body**:
```json
{
  "code": "Write a function that generates a Fibonacci sequence of a given length",
  "context": "def generate_fibonacci(n):\n    \n    n = int(input('Enter a number: '))\n    if n <= 2:"
}
```

**Response**:
```json
{
  "result": "{new}def generate_fibonacci(n):\n    if n <= 0:\n        return []\n    elif n == 1:\n        return [0]\n    elif n == 2:\n        return [0, 1]\n    else:\n        fib = [0, 1]\n        while len(fib) < n:\n            fib.append(fib[-1] + fib[-2])\n        return fib{old}\n\nn = int(input('Enter a number: '))\n...",
  "success": true
}
```

**Use Case**: Show what needs to be fixed and what stays the same.

---

### 2. Tracing Questions

Generate questions about variable changes during code execution.

**Endpoint**: `POST /tracing/generate-question`

**Request Body**:
```json
{
  "code": "fib = [0, 1]\nfor i in range(2, 5):\n    fib.append(fib[i-1] + fib[i-2])",
  "context": "[...execution steps...]"
}
```

**Response**:
```json
{
  "response": "step: 8, variable: i\nstep: 11, variable: fib",
  "success": true
}
```

**Use Case**: Generate step-by-step questions for code tracing exercises.

---

### 3. Tracing Feedback

Grade variable trace answer and provide feedback.

**Endpoint**: `POST /tracing/generate-feedback`

**Request Body**:
```json
{
  "code_block": "fib.append(fib[i-1] + fib[i-2])",
  "current_frames": "[n=5, fib=[0,1], i=2]",
  "variable_name": "fib",
  "user_answer": "[0, 1]",
  "solution": "[0, 1, 1]",
  "number_of_attempts": 2
}
```

**Response**:
```json
{
  "feedback": "You're close! The append() method adds fib[-1] + fib[-2] to the list.",
  "success": true
}
```

**Use Case**: Give targeted feedback on tracing exercises.

---

## VERIFY TECHNIQUES

### 1. Generate Issue

Identify issues in code compared to task requirements.

**Endpoint**: `POST /verify/generate-issue`

**Request Body**:
```json
{
  "code": "def sum_even(numbers):\n    total = 0\n    for num in numbers:\n        if num % 2 == 0:\n            total += num\n    return total",
  "task": "Write a function to calculate the sum of even numbers in a list. Handle edge case of empty list."
}
```

**Response**:
```json
{
  "response": {
    "issues": [
      {
        "issue": "Does not handle empty list edge case",
        "severity": "medium"
      }
    ]
  },
  "success": true
}
```

**Use Case**: Identify bugs and missing functionality in student code.

---

## PSEUDO TECHNIQUE

### 1. Generate Pseudocode

Generate pseudocode for a given problem description.

**Endpoint**: `POST /pseudo/generate`

**Request Body**:
```json
{
  "description": "Write a function that finds the largest element in a list"
}
```

**Response**:
```json
{
  "pseudocode": "FUNCTION findLargest(list):\n    max = list[0]\n    FOR each element in list:\n        IF element > max:\n            max = element\n    RETURN max\nEND",
  "success": true
}
```

**Use Case**: Help students plan their code with pseudocode first.

---

## TASK ORCHESTRATION & FRICTION TECHNIQUES

### 1. Validate Chosen Technique

Validate the student's chosen friction technique for this assignment.
The student selects their preferred technique from the AIPreferenceModal, and this endpoint confirms it's available.

**Endpoint**: `POST /api/tasks/next`

**Request Body**:
```json
{
  "assignment_id": 5,
  "chosen_technique": "lead-and-reveal"
}
```

**Response**:
```json
{
  "status": "valid",
  "chosen_technique": "lead-and-reveal",
  "assignment_id": 5,
  "is_valid": true
}
```

**Use Case**: When student clicks "Start Assignment" after selecting a technique from the modal, system validates the choice is allowed for that assignment.

**Valid Technique Values:**
- `none` - No AI assistance (student works independently)
- `baseline` - Standard AI code generation
- `lead-and-reveal` - AI reveals code ONLY after student answers reasoning questions
- `trace-and-predict` - Student traces variables before seeing execution results
- `parsons` - Student reorders shuffled code blocks and fixes indentation
- `pseudo-code` - Student writes pseudocode first
- `self-explain` - Student explains their code reasoning
- `verification` - Student finds bugs before AI helps

---

### 2. Request Hint (Tiered Help System)

Request a hint at the current difficulty level. Returns escalating hints (level 1  2  3) for the current task.

**Endpoint**: `POST /api/tasks/hint`

**Request Body**:
```json
{
  "attempt_id": 42,
  "technique": "lead_and_reveal"
}
```

**Response (Level 1 - Shallow hint)**:
```json
{
  "level": 1,
  "hint": "Think about the structure of the output. Do you need to process elements in order?",
  "next_level_available": true
}
```

**Response (Level 2 - Deeper insight)**:
```json
{
  "level": 2,
  "hint": "Consider sorting the input first. This ensures you can process overlapping intervals linearly.",
  "next_level_available": true
}
```

**Response (Level 3 - Solution-oriented)**:
```json
{
  "level": 3,
  "hint": "Sort by start point, then iterate through checking if current interval overlaps with last merged interval. If overlap, update end point to max(last_end, current_end).",
  "next_level_available": false
}
```

**Use Case**: Provide progressive scaffolding without immediately revealing the solution. Students must request help 3 times to see the full solution approach.

---

### 3. Submit Task

Submit a completed task. Student finishes their attempt with their chosen technique.
The next attempt will allow them to choose a different technique if desired.

**Endpoint**: `POST /api/tasks/submit`

**Request Body**:
```json
{
  "attempt_id": 42,
  "final_code": "def merge_intervals(intervals):\n    sorted_intervals = sorted(intervals, key=lambda x: x[0])\n    merged = [sorted_intervals[0]]\n    for current in sorted_intervals:\n        last = merged[-1]\n        if current[0] <= last[1]:\n            merged[-1] = (last[0], max(last[1], current[1]))\n        else:\n            merged.append(current)\n    return merged",
  "score": 95,
  "notes": "Student completed with one hint"
}
```

**Response**:
```json
{
  "status": "submitted",
  "attempt_id": 42
}
```

**Use Case**: Mark attempt as complete. Student can then start a new attempt and choose the same or a different friction technique.

---

### 4. Get Task Statistics

Retrieve student's progress on an assignment, broken down by technique choice.

**Endpoint**: `GET /api/tasks/stats/{assignment_id}`

**Response**:
```json
{
  "total_attempts": 3,
  "completed_attempts": 2,
  "attempts_by_technique": {
    "lead-and-reveal": {
      "count": 2,
      "completed": 2
    },
    "parsons": {
      "count": 1,
      "completed": 0
    }
  }
}
```

**Use Case**: Display student progress dashboard showing how many times they've attempted each friction technique and how many they completed.

---

### 5. Generate Hints (Batch Pre-generation)

Pre-generate all 3 levels of hints for a specific attempt using LLM. Runs asynchronously and stores hints in database.

**Endpoint**: `POST /api/tasks/generate-hints`

**Request Body**:
```json
{
  "attempt_id": 42,
  "task_description": "Write a function that merges overlapping intervals",
  "technique": "lead_and_reveal",
  "model": "phi-3-mini"
}
```

**Response**:
```json
{
  "status": "hints_generated",
  "level_1": "Think about the structure of the output. Do you need to process elements in order?",
  "level_2": "Consider sorting the input first. This ensures you can process overlapping intervals linearly.",
  "level_3": "Sort by start point, then iterate through checking if current interval overlaps with last merged interval. If overlap, update end point to max(last_end, current_end)."
}
```

**Use Case**: Teachers can pre-generate hints when creating assignments. System automatically generates these when students start an attempt.

---

## PARSONS PROBLEMS (Code Reordering & Indentation)

### 1. Generate Parsons Problem

Generate a shuffled code problem where students must reorder lines and fix indentation. Returns blocks with original positions hidden.

**Endpoint**: `POST /api/ai/parsons`

**Request Body**:
```json
{
  "problem": "Write a function that merges overlapping intervals",
  "attempt_id": 42,
  "model": "phi-3-mini"
}
```

**Response**:
```json
{
  "blocks": [
    {
      "code": "merged[-1] = (last[0], max(last[1], current[1]))",
      "indent": 2,
      "distractor": false
    },
    {
      "code": "merged.append(current)",
      "indent": 2,
      "distractor": false
    },
    {
      "code": "sorted_intervals = sorted(intervals, key=lambda x: x[0])",
      "indent": 1,
      "distractor": false
    },
    {
      "code": "for current in sorted_intervals:",
      "indent": 1,
      "distractor": false
    },
    {
      "code": "return x  # Wrong variable!",
      "indent": 1,
      "distractor": true
    },
    {
      "code": "def merge_intervals(intervals):",
      "indent": 0,
      "distractor": false
    },
    {
      "code": "if current[0] <= last[1]:",
      "indent": 2,
      "distractor": false
    },
    {
      "code": "merged = [sorted_intervals[0]]",
      "indent": 1,
      "distractor": false
    },
    {
      "code": "else:",
      "indent": 2,
      "distractor": false
    }
  ],
  "explanation": "This problem requires reordering code statements and fixing indentation to implement interval merging. One block is a distractor."
}
```

**Use Case**: Implement Parsons problems as a friction technique. Students must:
1. Drag code blocks into correct execution order
2. Fix indentation using indent/outdent buttons
3. Identify and skip distractor lines
4. Submit for validation

**Front-end Component**: `ParsonsPanel.tsx` handles drag-drop, indentation, and validation.

---

## DATABASE MODELS FOR FRICTION TECHNIQUES

### UserTechniqueSequence (Optional - For Future Analysis)

This model is optional and can be used by teachers to define which techniques are available for an assignment. Currently, all friction techniques are available to all students.

```python
class UserTechniqueSequence(Base):
    __tablename__ = "user_technique_sequences"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    
    # For future use: teachers can restrict which techniques are available
    technique_sequence = Column(String, default="baseline,lead-and-reveal,trace-and-predict,parsons")
    
    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
```

**Note**: This model is kept for future extensibility (e.g., if teachers want to restrict which techniques students can choose). Currently, all friction techniques are available to all students via AIPreferenceModal.

---

### HintLevel

Stores the 3-tier hints for each attempt, with tracking of which level the student has accessed.

```python
class HintLevel(Base):
    __tablename__ = "hint_levels"
    
    id = Column(Integer, primary_key=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"), nullable=False)
    
    # Friction technique for this hint set
    technique = Column(Enum(FrictionTechnique), nullable=False)
    
    # Three levels of escalating hints
    level_1_hint = Column(String, nullable=False)
    level_2_hint = Column(String, nullable=False)
    level_3_hint = Column(String, nullable=False)
    
    # Tracking usage
    hints_requested = Column(Integer, default=0)  # 0-3
    last_hint_requested_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

**Purpose**: Store pre-generated hints and track how many levels the student has used, enabling progression from guided hints to solution details.

---

## PLACEHOLDER ENDPOINTS (Implementation Pending)

These endpoints are registered but not yet implemented. They return a pending status.

- `POST /token/code-to-token` - Tokenize code for token-based learning
- `POST /selfexplain/feedback` - Grade self-explanations
- `POST /selfexplain/generate-question` - Generate self-explanation questions
- `POST /hierarchical/code-to-pseudocode` - Convert code to hierarchical pseudocode
- `POST /writeover/generate` - Generate fill-in-the-blanks exercises

---

## Testing the API

### Using curl

```bash
# Get a JWT token first
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","password":"password123"}'

# Student selects technique and validates it
curl -X POST http://localhost:8000/api/tasks/next \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "assignment_id": 5,
    "chosen_technique": "lead-and-reveal"
  }'

# Request a hint
curl -X POST http://localhost:8000/api/tasks/hint \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "attempt_id": 42,
    "technique": "lead-and-reveal"
  }'

# Generate a Parsons problem
curl -X POST http://localhost:8000/api/ai/parsons \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "problem": "Write a function that merges overlapping intervals",
    "attempt_id": 42,
    "model": "phi-3-mini"
  }'

# Submit completed attempt
curl -X POST http://localhost:8000/api/tasks/submit \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "attempt_id": 42,
    "final_code": "def merge_intervals(intervals):\n    ...",
    "score": 95,
    "notes": "Student completed successfully"
  }'

# Get student's attempt stats by technique
curl -X GET http://localhost:8000/api/tasks/stats/5 \
  -H "Authorization: Bearer <your-jwt-token>"

# Use traditional technique endpoints
curl -X POST http://localhost:8000/api/techniques/baseline/generate-feedback \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a function that merges overlapping intervals",
    "task": "Write a function that takes a list of intervals and merges any overlapping intervals."
  }'
```

### Using Python requests

```python
import requests

BASE_URL = "http://localhost:8000"
TOKEN = "<your-jwt-token>"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# Test baseline generate-feedback
response = requests.post(
    f"{BASE_URL}/api/techniques/baseline/generate-feedback",
    headers=headers,
    json={
        "prompt": "Write a function that merges overlapping intervals",
        "task": "Write a function that takes a list of intervals and merges any overlapping intervals."
    }
)

print(response.json())
```

### Using Swagger UI

Navigate to `http://localhost:8000/docs` and use the interactive Swagger interface to test all endpoints.

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200`: Success
- `400`: Bad request (missing fields)
- `401`: Unauthorized (invalid or missing token)
- `403`: Forbidden (insufficient permissions)
- `500`: Internal server error (LLM service issue)

Example error response:

```json
{
  "detail": "Code generation failed: Connection timeout to LLM service"
}
```

---

## LLM Configuration

All techniques use the Ollama service configured in `app/services/ai_proxy.py`. The default model is `phi-3-mini`, but you can customize:

- Model name (in each endpoint, the `model` parameter)
- Temperature (controls randomness: 0 = deterministic, 1 = random)
- Max tokens (output length limit)

---

## Architecture

```
backend/
 routers/
    techniques.py           Classic LLM-based techniques (Reveal, Tracing, etc.)
    tasks.py                NEW: Task orchestration & technique rotation
    ai.py                   Parsons problem generation + other AI endpoints
 services/
    ai_proxy.py             LLM integration (Ollama/OpenAI-compatible)
    executor_service.py     Code execution sandbox
 models/
    models.py               Database ORM models
        FrictionTechnique   NEW: Enum of 7 friction techniques
        UserTechniqueSequence  NEW: Tracks technique rotation per student
        HintLevel           NEW: Stores 3-tier hints per attempt
 main.py                     FastAPI app registration
```

**New Components:**
- **Task Orchestration Layer** (`routers/tasks.py`): Manages technique assignment and rotation per student/assignment
- **Tiered Hint System** (`HintLevel` model): Stores pre-generated hints at 3 escalating levels
- **Friction Technique Enum**: Standardized technique types (BASELINE, LEAD_AND_REVEAL, TRACE_AND_PREDICT, PARSONS, PSEUDO_CODE, SELF_EXPLAIN, VERIFICATION)

---

## Future Enhancements

1. **Caching**: Cache LLM responses for identical prompts
2. **Batch Processing**: Support batch requests for multiple questions
3. **Analytics**: Track which techniques are most effective
4. **Custom Prompts**: Allow teachers to customize LLM system prompts
5. **Multi-Language**: Support for Python, Java, C++, JavaScript
6. **Streaming**: Stream LLM responses for real-time feedback

---

## FRICTION-INDUCED COGNITIVE ENGAGEMENT FRAMEWORK

COGNICODE implements friction-based learning techniques where **students actively choose** which friction technique to use for each attempt. This empowers student autonomy while collecting data on how different techniques affect engagement and learning.

### Core Concepts

**Friction Techniques** are pedagogical interventions that add productive struggle. Students select which technique they want to use:

1. **No AI** (Baseline): Students write code independently with no AI assistance (control condition)
2. **Lead-and-Reveal**: AI reveals code ONLY after student provides reasoning (MCQ-based)
3. **Trace-and-Predict**: Students trace variable changes before seeing execution results
4. **Parsons Problems**: Students reorder and indent code blocks (syntax vs. semantics)
5. **Pseudo-Code**: Students write pseudocode first before implementation
6. **Self-Explanation**: Students explain their reasoning for each code section
7. **Verification**: Students find bugs before receiving AI hints
8. **Full AI Access**: Students get direct AI assistance without friction constraints

### Student Choice Flow

**Step 1: Student Selects Technique**
```
Student clicks "Start Assignment"

AIPreferenceModal appears with all friction techniques

Student selects their preferred technique

Modal submits choice: "lead-and-reveal"
```

**Step 2: System Validates**
```
POST /api/tasks/next
{
  "assignment_id": 5,
  "chosen_technique": "lead-and-reveal"
}

System validates technique is allowed for this assignment

Response: { "status": "valid", "chosen_technique": "lead-and-reveal" }
```

**Step 3: Student Works and Submits**
```
Student edits code using their chosen technique

AI panel shows lead-and-reveal interface (MCQs before code reveal)

Student finishes and clicks "Submit"

POST /api/tasks/submit with final code and score
```

**Step 4: Next Attempt Allows New Choice**
```
Student can start another attempt

Same modal appears again

Student can choose same technique OR try a different one

System logs all attempts and technique choices
```

### Benefits of Student-Chosen Techniques

 **Autonomy**: Students feel in control of their learning experience
 **Variety**: Prevents boredom from repetitive friction methods
 **Choice Data**: Teachers can see which techniques students prefer
 **Engagement**: Students often try different techniques to compare
 **Transparency**: Clear that AI usage level is student's decision
 **Reproducibility**: Each attempt explicitly records which technique was used

### Event Logging for Friction Analysis

All friction interactions are logged with timestamps and sequence numbers:

**New Event Types:**
- `HINT_REQUESTED`: Student clicked "Request Hint" (level tracked)
- `HINT_RECEIVED`: Backend returned hint at specific level
- `TECHNIQUE_TRANSITION`: Student moved to different technique choice
- `PARSONS_DRAG`: Student dragged code block in Parsons problem
- `PARSONS_DROP`: Student dropped code block in new position
- `ANSWER_SUBMITTED`: Student submitted task solution
- `ANSWER_FEEDBACK`: AI provided feedback on submitted answer

**Use by Teachers:**
Teachers can replay sessions and observe:
- Which friction technique student chose for each attempt
- How long students struggled with each technique
- Which hint levels they accessed (indication of difficulty)
- Engagement with drag-drop interactions (Parsons)
- Submission quality and AI feedback received
- Preferences: Does student tend to choose harder techniques or easier ones?

### Engagement Metrics

The system computes per-attempt engagement scores:

```
engagement_score = (
  coding_time_seconds * 0.3 +           # Active typing
  hint_requests_count * 0.2 +           # Help-seeking behavior
  paste_event_count * 0.1 -             # Potential copying (negative)
  run_count * 0.15 +                    # Testing/debugging
  final_score * 0.25                    # Solution quality
)
```

Higher engagement indicates students are thinking deeply rather than copy-pasting or giving up.

Engagement by technique shows which frictions are most effective:
- **No AI**: Highest struggle, lowest paste events
- **Lead-and-Reveal**: Good engagement, students must reason
- **Trace-and-Predict**: Medium engagement, forces prediction
- **Parsons**: Unique engagement pattern (drag/drop instead of typing)
- **Full AI**: Lowest struggle, highest paste events

---

## References

- Original Node.js implementation: `code-engagement-techniques-main/packages/server/routes/`
- Friction-Induced Cognitive Engagement Paper: Research foundation for technique design
- FastAPI documentation: https://fastapi.tiangolo.com/
- Ollama documentation: https://ollama.ai/
- OpenAI API documentation: https://platform.openai.com/docs/
