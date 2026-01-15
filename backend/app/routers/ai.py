from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import json
import logging
import instructor
from app.database import get_db
from app.models.models import AIInteraction, Attempt, User
from app.schemas.schemas import (
    AIChatRequest,
    AIChatResponse,
    AIInteractionResponse
)
from app.schemas.ai_schemas import LeadAndRevealResponse, TraceAndPredictResponse, ParsonsResponse
from app.auth_utils import get_current_user
from app.services.ai_proxy import ollama_service, ollama_client
from app.config import settings
from app.logging_config import ai_logger

router = APIRouter(prefix="/api/ai", tags=["AI"])
logger = logging.getLogger(__name__)
ai_log = ai_logger


@router.post("/chat", response_model=AIChatResponse)
async def chat(
    request: AIChatRequest,
    attempt_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Proxy chat request to Ollama and log the interaction."""
    logger.info(f" AI Chat Request - User: {current_user.username}, Model: {request.model}, Attempt: {attempt_id}")
    
    try:
        # Log request details
        logger.info(f"Calling Ollama API with model: {request.model}, temperature: {request.temperature}, max_tokens: {request.max_tokens}")
        logger.debug(f"Ollama API request messages: {json.dumps([msg.model_dump() for msg in request.messages], ensure_ascii=False)}")

        response_data = await ollama_service.chat_completion(
            messages=[msg.model_dump() for msg in request.messages],
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )

        logger.info(f"Ollama API response received successfully")
        logger.debug(f"Ollama API response: {json.dumps(response_data, ensure_ascii=False)}")

        # Log interaction if attempt_id provided
        if attempt_id:
            logger.info(f"Logging interaction to database for attempt_id: {attempt_id}")
            # Verify attempt exists and belongs to user
            result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
            attempt = result.scalar_one_or_none()

            if attempt and attempt.user_id == current_user.id:
                # Extract prompt and response
                prompt = request.messages[-1].content if request.messages else ""
                response_text = ""
                if response_data.get("choices"):
                    response_text = response_data["choices"][0].get("message", {}).get("content", "")

                # Create interaction record
                parameters = json.dumps({
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens
                })

                interaction = AIInteraction(
                    attempt_id=attempt_id,
                    prompt=prompt,
                    response=response_text,
                    model_name=request.model,
                    parameters=parameters,
                    tokens=response_data.get("usage", {}).get("total_tokens"),
                    hash=ollama_service.generate_hash(prompt, response_text)
                )

                db.add(interaction)
                await db.commit()
                logger.info(f"AI interaction logged successfully for attempt {attempt_id}")
            else:
                logger.warning(f"Attempt {attempt_id} not found or doesn't belong to user {current_user.username}")

        return response_data

    except Exception as e:
        logger.error(f"AI service error: {str(e)}", exc_info=True)
        logger.error(f"Request model: {request.model}, temperature: {request.temperature}, max_tokens: {request.max_tokens}")
        logger.error(f"Request messages: {json.dumps([msg.model_dump() for msg in request.messages], ensure_ascii=False)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}"
        )


@router.get("/interactions/{attempt_id}", response_model=List[AIInteractionResponse])
async def get_interactions(
    attempt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all AI interactions for an attempt."""
    # Verify attempt exists and check access
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
    
    if attempt.user_id != current_user.id and current_user.role.value != "Teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get interactions
    result = await db.execute(
        select(AIInteraction)
        .where(AIInteraction.attempt_id == attempt_id)
        .order_by(AIInteraction.created_at)
    )
    interactions = result.scalars().all()
    
    return interactions


@router.post("/lead-and-reveal", response_model=LeadAndRevealResponse)
async def lead_and_reveal(
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    problem = request.get("problem")
    attempt_id = request.get("attempt_id")
    model = request.get("model", "mistral")
    
    ai_log.info(f" Lead-and-Reveal Request - User: {current_user.username}, Model: {model}")
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt or attempt.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid attempt")
    prompt = f"Lead-and-Reveal: {problem}"
    
    try:
        ai_log.info(f"[DEBUG] Using pre-patched ollama_client for Lead-and-Reveal")
        response = await ollama_client.chat.completions.create(
            model=model,
            response_model=LeadAndRevealResponse,
            messages=[
                {"role": "system", "content": """You are implementing the Lead-and-Reveal teaching technique. 
Break the coding problem into 5-8 simple steps (one line of code per step).

IMPORTANT: Return ONLY valid JSON matching this exact structure:
{
  "steps": [
    {
      "question": "string",
      "context": "string", 
      "codeLine": "string",
      "explanation": "string"
    }
  ]
}

Each step must have exactly these 4 fields. Generate 5-8 steps total."""},
                {"role": "user", "content": f"Problem: {problem}"}
            ],
            temperature=0.3,
            max_retries=2,
            timeout=30.0
        )
    except Exception as e:
        ai_log.error(f"[ERROR] Exception during lead-and-reveal: {str(e)}", exc_info=True)
        raise
    
    interaction = AIInteraction(
        attempt_id=attempt_id,
        prompt=prompt,
        response=response.model_dump_json(),
        model_name=model,
        parameters=json.dumps({"temperature": 0.3, "structured_output": True}),
        hash=ollama_service.generate_hash(prompt, response.model_dump_json())
    )
    db.add(interaction)
    await db.commit()
    ai_log.info(f" Logged Lead-and-Reveal interaction for attempt {attempt_id}")
    return response


@router.post("/trace-and-predict", response_model=TraceAndPredictResponse)
async def trace_and_predict(
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    code = request.get("code")
    attempt_id = request.get("attempt_id")
    model = request.get("model", "mistral")
    
    ai_log.info(f" Trace-and-Predict Request - User: {current_user.username}, Model: {model}")
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt or attempt.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid attempt")
    prompt = f"Trace-and-Predict: {code[:200]}..."
    
    try:
        ai_log.info(f"[DEBUG] Using pre-patched ollama_client for Trace-and-Predict")
        response = await ollama_client.chat.completions.create(
            model=model,
            response_model=TraceAndPredictResponse,
            messages=[
                {"role": "system", "content": """You are implementing the Trace-and-Predict teaching technique.
For the given code, trace through execution line by line. For each significant line, analyze what happens.

IMPORTANT: Return ONLY valid JSON matching this exact structure:
{
  "steps": [
    {
      "lineNumber": integer,
      "codeLine": "string",
      "question": "string",
      "explanation": "string"
    }
  ]
}

Each step must have exactly these 4 fields. Generate 3-15 steps total."""},
                {"role": "user", "content": f"Code to trace:\n{code}"}
            ],
            temperature=0.3,
            max_retries=2,
            timeout=30.0
        )
    except Exception as e:
        ai_log.error(f"[ERROR] Exception during trace-and-predict: {str(e)}", exc_info=True)
        raise
    
    interaction = AIInteraction(
        attempt_id=attempt_id,
        prompt=prompt,
        response=response.model_dump_json(),
        model_name=model,
        parameters=json.dumps({"temperature": 0.3, "structured_output": True}),
        hash=ollama_service.generate_hash(prompt, response.model_dump_json())
    )
    db.add(interaction)
    await db.commit()
    ai_log.info(f" Logged Trace-and-Predict interaction for attempt {attempt_id}")
    return response


@router.post("/parsons", response_model=ParsonsResponse)
async def parsons_problem(
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    problem = request.get("problem")
    attempt_id = request.get("attempt_id")
    model = request.get("model", "mistral")
    
    ai_log.info(f" Parsons Problem Request - User: {current_user.username}, Model: {model}")
    
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt or attempt.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid attempt")
    prompt = f"Parsons: {problem}"
    
    try:
        ai_log.info(f"[DEBUG] Using pre-patched ollama_client for Parsons")
        response = await ollama_client.chat.completions.create(
            model=model,
            response_model=ParsonsResponse,
            messages=[
                {"role": "system", "content": """You are generating a Parsons problem for code learning.
Generate code blocks that solve the problem. Each block is a complete line/statement.

IMPORTANT: Return ONLY valid JSON matching this exact structure:
{
  "blocks": [
    {
      "code": "string",
      "indent": integer (0-3),
      "distractor": boolean
    }
  ],
  "explanation": "string"
}

Each block must have exactly these 3 fields: code, indent, distractor.
indent values: 0 (no indent), 1 (first level), 2 (second level), 3 (third level).
distractor: true if block is not needed, false if it's part of the solution.
Generate 5-10 blocks total, with 1-2 distractors."""},
                {"role": "user", "content": f"Create a Parsons problem for: {problem}"}
            ],
            temperature=0.3,
            max_retries=2,
            timeout=30.0
        )
    except Exception as e:
        ai_log.error(f"[ERROR] Exception during parsons problem: {str(e)}", exc_info=True)
        raise
    interaction = AIInteraction(
        attempt_id=attempt_id,
        prompt=prompt,
        response=response.model_dump_json(),
        model_name=model,
        parameters=json.dumps({"temperature": 0.3, "structured_output": True}),
        hash=ollama_service.generate_hash(prompt, response.model_dump_json())
    )
    db.add(interaction)
    await db.commit()
    ai_log.info(f" Logged Parsons problem for attempt {attempt_id}")
    return response
