# Instructor Integration Guide

This document explains how COGNICODE uses the Instructor library to get structured, validated outputs from LLMs.

---

## Server Configuration

**Ollama API Endpoint:**
```
https://chatucy.cs.ucy.ac.cy/ollama/v1/chat/completions
```

**Base URL for OpenAI Client:**
```
https://chatucy.cs.ucy.ac.cy/ollama/v1
```

**Supported Models:**
- `mistral`
- `qwen3`
- `llama3`

---

## Implementation Method

### 1. Client Setup (One-Time Initialization)

Located in: `backend/app/services/ai_proxy.py`

```python
from openai import AsyncOpenAI
import instructor
import httpx

# Create AsyncOpenAI client with custom base URL
ollama_client = AsyncOpenAI(
    base_url="https://chatucy.cs.ucy.ac.cy/ollama/v1",
    api_key="ollama",  # Can be any string for Ollama
    http_client=httpx.AsyncClient(verify=False)  # Disable SSL verification for self-signed certs
)

# Patch with instructor for structured outputs
ollama_client = instructor.patch(
    ollama_client,
    mode=instructor.Mode.JSON
)
```

**Key Points:**
- Uses OpenAI-compatible API format
- SSL verification disabled (`verify=False`) for self-signed certificates
- Instructor patches the client to add structured output capabilities

---

### 2. Define Pydantic Schemas

Located in: `backend/app/schemas/ai_schemas.py`

Define your expected response structure using Pydantic models:

```python
from pydantic import BaseModel, Field
from typing import List

class CodeStep(BaseModel):
    """A single step in the Lead-and-Reveal teaching process."""
    question: str = Field(description="A short question asking what needs to be done")
    context: str = Field(description="Brief context about what's been done")
    codeLine: str = Field(description="ONE line of code for this step")
    explanation: str = Field(description="How this line helps solve the problem")

class LeadAndRevealResponse(BaseModel):
    """Structured response for Lead-and-Reveal teaching technique."""
    steps: List[CodeStep] = Field(
        description="List of code steps",
        min_length=3,
        max_length=15
    )
```

**Available Schemas:**
- `LeadAndRevealResponse` - Step-by-step code guidance
- `TraceAndPredictResponse` - Line-by-line code execution tracing
- `ParsonsResponse` - Code block reordering puzzles

---

### 3. Make Structured API Calls

Located in: `backend/app/routers/ai.py`

Use the patched client to get validated, structured responses:

```python
response = await ollama_client.chat.completions.create(
    model="mistral",  # or "qwen3", "llama3"
    response_model=LeadAndRevealResponse,  # Pass your Pydantic model
    messages=[
        {
            "role": "system", 
            "content": """You are implementing the Lead-and-Reveal teaching technique. 
            Break the coding problem into 5-8 simple steps.
            
            IMPORTANT: Return ONLY valid JSON matching this structure:
            {
              "steps": [
                {
                  "question": "string",
                  "context": "string", 
                  "codeLine": "string",
                  "explanation": "string"
                }
              ]
            }"""
        },
        {"role": "user", "content": f"Problem: {problem}"}
    ],
    temperature=0.3,
    max_retries=2,
    timeout=30.0
)

# Response is now a typed LeadAndRevealResponse object
print(response.steps[0].codeLine)  # Access with full type safety
```

---

## How Instructor Works

1. **Automatic Schema Injection**: Instructor adds your Pydantic schema to the prompt
2. **JSON Mode**: Forces the LLM to output valid JSON
3. **Validation**: Parses and validates the response against your schema
4. **Retry Logic**: Automatically retries if validation fails (up to `max_retries`)
5. **Type Safety**: Returns a typed Python object instead of raw text

---

## Example Usage

### Lead-and-Reveal Endpoint

```python
@router.post("/lead-and-reveal", response_model=LeadAndRevealResponse)
async def lead_and_reveal(request: dict, db: AsyncSession, current_user: User):
    problem = request.get("problem")
    model = request.get("model", "mistral")
    
    response = await ollama_client.chat.completions.create(
        model=model,
        response_model=LeadAndRevealResponse,
        messages=[
            {"role": "system", "content": "System prompt..."},
            {"role": "user", "content": f"Problem: {problem}"}
        ],
        temperature=0.3,
        max_retries=2,
        timeout=30.0
    )
    
    # Log the interaction
    interaction = AIInteraction(
        prompt=f"Lead-and-Reveal: {problem}",
        response=response.model_dump_json(),
        model_name=model,
        parameters=json.dumps({"temperature": 0.3, "structured_output": True})
    )
    db.add(interaction)
    await db.commit()
    
    return response
```

---

## Benefits of This Approach

1. **Type Safety**: Get typed Python objects instead of parsing JSON manually
2. **Validation**: Automatic validation ensures responses match expected structure
3. **Retry Logic**: Built-in retries on validation failures
4. **Consistency**: Guaranteed structure across all AI interactions
5. **Logging**: Easy to serialize validated responses for database storage
6. **Developer Experience**: IDE autocomplete and type checking

---

## Configuration

Environment variables in `backend/app/config.py`:

```python
class Settings(BaseSettings):
    OLLAMA_API_URL: str = "https://chatucy.cs.ucy.ac.cy/ollama/v1/chat/completions"
    OLLAMA_BASE_URL: str = "https://chatucy.cs.ucy.ac.cy/ollama/v1"
    OLLAMA_API_KEY: str = ""  # Optional
```

---

## Dependencies

Required packages in `backend/requirements.txt`:

```
instructor>=1.0.0
openai>=1.0.0
httpx>=0.25.0
pydantic>=2.0.0
```

---

## Reusability for Other Projects

To use this pattern in another project:

1. **Install dependencies**: `pip install instructor openai httpx pydantic`
2. **Copy the setup code** from `ai_proxy.py`
3. **Define your Pydantic models** for expected responses
4. **Make API calls** using `response_model=YourModel`
5. **Adjust the base URL** to your Ollama server

The pattern works with any OpenAI-compatible API (Ollama, vLLM, OpenAI, etc.).

---

## Related Files

- `backend/app/services/ai_proxy.py` - Client setup and initialization
- `backend/app/schemas/ai_schemas.py` - Pydantic response models
- `backend/app/routers/ai.py` - API endpoints using structured outputs
- `backend/app/config.py` - Server configuration
