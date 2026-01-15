"""
Educational coding techniques powered by LLMs.
Ported from code-engagement-techniques-main/packages/server/routes/codex-*-router.ts
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import logging

from app.auth_utils import get_current_user
from app.models.models import User
from app.services.ai_proxy import ollama_service

router = APIRouter(prefix="/api/techniques", tags=["Educational Techniques"])
logger = logging.getLogger(__name__)


# ============================================================================
# Request/Response Models
# ============================================================================

class GenerateFeedbackRequest(BaseModel):
    prompt: str
    task: str


class TaskDescription(BaseModel):
    id: str
    description: str


class GenerateFeedbackResponse(BaseModel):
    matched: str  # "yes" or "no"
    accuracy_score: int  # 0-5
    matched_task_id: Optional[str] = None
    missing_specifications: List[str]


class GenerateRequest(BaseModel):
    description: str
    context: Optional[str] = None


class GenerateCodeRequest(BaseModel):
    description: str
    context: Optional[str] = None


class CodeWithLineResponse(BaseModel):
    code: str
    explain: str


class RevealGenerateQuestionRequest(BaseModel):
    code: str
    task: str


class SubgoalStep(BaseModel):
    mcq_question: str
    correct_choice: str
    incorrect_choice_1: str
    incorrect_choice_2: str
    incorrect_choice_3: str


class SubsubgoalItem(BaseModel):
    leading_questions: List[SubgoalStep]
    code_lines_to_be_revealed: List[int]


class Subgoal(BaseModel):
    title: str
    sub_subgoal_items: List[SubsubgoalItem]


class RevealGenerateQuestionResponse(BaseModel):
    subgoals: List[Subgoal]


# ============================================================================
# BASELINE TECHNIQUES: generateFeedback, generate, generatecode
# ============================================================================

@router.post("/baseline/generate-feedback", response_model=GenerateFeedbackResponse)
async def baseline_generate_feedback(
    request: GenerateFeedbackRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Compare student prompt with task descriptions. Score accuracy and extract missing specs.
    Ported from codex-baseline-router.ts:/generateFeedback
    """
    logger.info(f" Baseline generateFeedback - User: {current_user.username}")
    
    system_prompt = """
Given a set of tasks descriptions, compare the specifications provided in the [student-prompt] with the [task-descriptions]. 

First, try to find a matches description with the student prompt to the task description, 

if not found a match, return matched = no in the JSON.

if found the match, score how fully and accurately the [student-prompt] describes the [task-description] using a number from 0 (completely irrelevant or under-specified) to 5 (fully specified and accurate). also if it is under-specified, provide a list of bullet points about what needs to be added to the [student-prompt] so that it fully describes the [task-descriptions]. 

Include all the missing specifications in the response. If an example is missing, include the example in the missing specifications as well.

Use the following JSON template:
{
    "matched": <yes or no>,
    "accuracy_score": <number-0-to-5>,
    "matched_task_id": <taskID>,
    "missing_specifications": [
        "<10-15 word missing specification>",
        "<10-15 word missing specification>",
        ...
    ]
}
"""
    
    user_message = f"""[task-description]: {request.task}
[student-prompt]: {request.prompt}[end-student-prompt]"""
    
    try:
        response = await ollama_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="phi-3-mini",
            temperature=0.0,
            max_tokens=200
        )
        
        response_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.info(f" Baseline feedback generated")
        
        # Parse JSON response
        result = json.loads(response_text)
        return GenerateFeedbackResponse(**result)
    
    except Exception as e:
        logger.error(f" Baseline generateFeedback error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Feedback generation failed: {str(e)}"
        )


@router.post("/baseline/generate", response_model=CodeWithLineResponse)
async def baseline_generate(
    request: GenerateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generate Python code with line-by-line explanations for a problem description.
    Ported from codex-baseline-router.ts:/generate
    """
    logger.info(f" Baseline generate - User: {current_user.username}")
    
    system_prompt = """Generate the python code that solves the provided problem. Use the following format to provide explanations for each line.

[OUTPUT]
<line of code> ### <explanation of line of code in natural language, and how it is solving the problem, also explain important functions or syntax elements used>
<line of code> ### <explanation of line of code in natural language, and how it is solving the problem, also explain important functions or syntax elements used>
[END]

[OVERALL-EXPLANATION]
<now provide a holistic explanation in paragraphs about how the code is solving the problem>"""
    
    user_message = f"[intended-behavior]: {request.description}"
    if request.context:
        user_message += f"\n[context-code]:\n{request.context}"
    
    try:
        response = await ollama_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="phi-3-mini",
            temperature=0.0,
            max_tokens=2000
        )
        
        response_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.info(f" Baseline code generated")
        
        # Split into code and explanation
        end_code_index = response_text.find("[END]")
        if end_code_index > 0:
            code = response_text[:end_code_index].replace("[OUTPUT]", "").strip()
            explain = response_text[end_code_index + 5:].replace("[OVERALL-EXPLANATION]", "").strip()
            return CodeWithLineResponse(code=code, explain=explain)
        else:
            return CodeWithLineResponse(code=response_text, explain="")
    
    except Exception as e:
        logger.error(f" Baseline generate error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Code generation failed: {str(e)}"
        )


@router.post("/baseline/generate-code")
async def baseline_generate_code(
    request: GenerateCodeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generate Python code snippets for intended behaviors with optional context.
    Ported from codex-baseline-router.ts:/generatecode
    """
    logger.info(f" Baseline generatecode - User: {current_user.username}")
    
    system_prompt = "for each provided [intended-behavior] generate python [code] snippets"
    
    # Build messages with few-shot examples
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "[intended-behavior]: say hello world\n[code]:"},
        {"role": "assistant", "content": 'print("hello world")\n[end-code]'},
        {"role": "user", "content": "[intended-behavior]: ask the user for their name\n[code]:"},
        {"role": "assistant", "content": 'name = input("What is your name? ")\n[end-code]'},
        {"role": "user", "content": "[intended-behavior]: ask the user to enter a number\n[code]:"},
        {"role": "assistant", "content": 'number = int(input("Enter a number: "))\n[end-code]'},
        {"role": "user", "content": "[intended-behavior]: generate a random number\n[code]:"},
        {"role": "assistant", "content": 'import random\nnumber = random.randint(0, 100)\n[end-code]'},
        {"role": "user", "content": "[intended-behavior]: check if the number is greater than 50\n[code]:"},
        {"role": "assistant", "content": 'if number > 50:\n    print("The number is greater than 50")\n[end-code]'},
    ]
    
    # Add user's request
    if request.context and len(request.context) > 0:
        user_msg = f"[context-code]:\n{request.context}\n[intended-behavior]: use the above [context-code] as context and {request.description}\n[code]:"
    else:
        user_msg = f"[intended-behavior]: {request.description}\n[code]:"
    
    messages.append({"role": "user", "content": user_msg})
    
    try:
        response = await ollama_service.chat_completion(
            messages=messages,
            model="phi-3-mini",
            temperature=0.1,
            max_tokens=1000,
            stop=["[end-code]"]
        )
        
        code = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.info(f" Baseline code snippet generated")
        
        return {"code": code, "success": True}
    
    except Exception as e:
        logger.error(f" Baseline generatecode error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Code snippet generation failed: {str(e)}"
        )


# ============================================================================
# REVEAL TECHNIQUE: generateQuestion, feedbackFromRevealShortAnswer
# ============================================================================

def get_code_with_line_numbers(code: str) -> str:
    """Convert code to numbered lines for LLM analysis."""
    lines = code.split("\n")
    output = ""
    for i, line in enumerate(lines, 1):
        output += f"{i}. {line}\n"
    return output


@router.post("/reveal/generate-question", response_model=RevealGenerateQuestionResponse)
async def reveal_generate_question(
    request: RevealGenerateQuestionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Break code into subgoals and generate MCQ questions for lead-and-reveal learning.
    Ported from codex-reveal-router.ts:/generateQuestion
    """
    logger.info(f" Reveal generateQuestion - User: {current_user.username}")
    
    system_prompt = """# Overview:
you are helping novice programmers learn about coding. Look at the provided Python [solution-code] and the [task-description], then divide the provided code into a list of [subgoal] items. For each [subgoal], provide a concise [title] and then divide it into [sub-subgoal-items]. The student has only be given the [task-description] and cannot see the [solution-code], instead you, the assistant that is helping this novice student learn about coding by asking a series of leading questions. These leading questions are multiple-choice question about each sub-subgoal parts of the task.

# Important Notes:
[sub-subgoal-items] can be one line of code, can be a function definition, can be the `for item in items` part of a loop, can be a return statement.
[code-lines-to-be-revealed]: a comma separated list of numbers that represent the lines of code from [solution-code] related to that [sub-subgoal-item].

# Generate using the following JSON template precisely:
{
  "subgoals": [
    {
      "title": "<2-5 word concise title for this subgoal>",
      "sub_subgoal_items": [
        {
          "leading_questions": [
            {
              "mcq_question": "<multiple-choice question>",
              "correct_choice": "<7-15 word correct answer>",
              "incorrect_choice_1": "<7-15 word plausible distractor>",
              "incorrect_choice_2": "<7-15 word plausible distractor>",
              "incorrect_choice_3": "<7-15 word plausible distractor>"
            }
          ],
          "code_lines_to_be_revealed": [<comma separated code line numbers>]
        }
      ]
    }
  ]
}
"""
    
    code_with_lines = get_code_with_line_numbers(request.code)
    user_message = f"[task-description]: {request.task}\n[solution-code]: {code_with_lines}[end-solution-code]\n\nFocus a lot of the questions on the complex part of the algorithm. For those parts, you can include one question per line, or even two questions per line."
    
    try:
        response = await ollama_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="mistral-7b",
            temperature=0.25,
            max_tokens=4095
        )
        
        response_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.info(f" Reveal questions generated")
        
        # Parse JSON response
        result = json.loads(response_text)
        return RevealGenerateQuestionResponse(**result)
    
    except Exception as e:
        logger.error(f" Reveal generateQuestion error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Question generation failed: {str(e)}"
        )


@router.post("/reveal/feedback-from-short-answer")
async def reveal_feedback_from_short_answer(
    all_code: str,
    code: str,
    student_solution: str,
    ai_generated_solution: str,
    question: str,
    current_user: User = Depends(get_current_user)
):
    """
    Grade student's short answer to a reveal question and provide feedback.
    Ported from codex-reveal-router.ts:/feedbackFromRevealShortAnswer
    """
    logger.info(f" Reveal feedback - User: {current_user.username}")
    
    system_prompt = """I have been asked this [question] about the next part of the [not-revealed-code] that I haven't seen yet (so it's hidden to me). This is part of an exercise to help me think deeply about what this [not-revealed-code] is supposed to do and how it contributes to the [overall-code-solution]. Here is my [my-answer] to the [question]. Check if it makes sense based on the [overall-code-solution], [not-revealed-code], and the [sample-solution]

Please return a JSON object with the following format:
{
    "correctness": <0-5>,
    "feedback": "<20-30 word of explanation about what I got correctly and a small hint at what I am missing about the [not-revealed-code]>"
}"""
    
    user_message = f"""[question]: {question}
[my-answer]: {student_solution}

[sample-solution]: {ai_generated_solution}
[not-revealed-code]: {code}
[overall-code-solution]: {all_code}"""
    
    try:
        response = await ollama_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="phi-3-mini",
            temperature=0.25,
            max_tokens=256
        )
        
        response_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.info(f" Reveal feedback generated")
        
        result = json.loads(response_text)
        return {"response": result, "success": True}
    
    except Exception as e:
        logger.error(f" Reveal feedback error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Feedback generation failed: {str(e)}"
        )


# ============================================================================
# TRACING TECHNIQUE: linesToRewrite, generateQuestion, generateFeedback, generateHint
# ============================================================================

@router.post("/tracing/lines-to-rewrite")
async def tracing_lines_to_rewrite(
    code: str,
    context: str,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze code and context, return rewritten code with {new}, {old} markers.
    Ported from codex-tracing-router.ts:/linesToRewrite
    """
    logger.info(f" Tracing linesToRewrite - User: {current_user.username}")
    
    system_prompt = """given the below instructions, check if the code need to be rewritten for the given user's goal {prompt}, write out the correct implementation of the python code for novice Python learners. The format of the print out should be one of the following structures: {old}{new}{old}, {old1}{new}, or {new}{old}, or {new}. No exceptions, there can only be one {new} block. {old} are the part of the logic and code that is correct and do not need to be changed, {new} are the code that are newly generated or fixed. If the {context} are wrong, the fix of the {new} code should still follow the context's logic. The {new} code should be a whole excutable code."""
    
    user_message = f"{{code}}:{code}\n{{context}}:{context}"
    
    try:
        response = await ollama_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="phi-3-mini",
            temperature=0.3,
            max_tokens=1000
        )
        
        result_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.info(f" Tracing lines rewritten")
        
        return {"result": result_text, "success": True}
    
    except Exception as e:
        logger.error(f" Tracing linesToRewrite error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rewriting failed: {str(e)}"
        )


@router.post("/tracing/generate-question")
async def tracing_generate_question(
    code: str,
    context: str,
    current_user: User = Depends(get_current_user)
):
    """
    Generate tracing questions about variable changes.
    Ported from codex-tracing-router.ts:/generateQuestion
    """
    logger.info(f" Tracing generateQuestion - User: {current_user.username}")
    
    system_prompt = """Given the code snippet in python, the goal for showing these code is for novice python programmer to understand the changes of variables when tracing the code. By the given {excutionsteps} and {code}, generate a list of questions {step, variable} regarding the next value for tracing steps. for each question, generate the step number and trace step number. Only ask meaningful questions, for example, changes of object that will change value in each step. ask 2-3 questions per code snippet. Make sure do not include any questions involving the user input or random."""
    
    user_message = f"{{excutionSteps}}: {context}\n{{code}}: {code}"
    
    try:
        response = await ollama_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="phi-3-mini",
            temperature=0.1,
            max_tokens=256,
            stop=["[end]"]
        )
        
        result_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.info(f" Tracing questions generated")
        
        return {"response": result_text, "success": True}
    
    except Exception as e:
        logger.error(f" Tracing generateQuestion error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Question generation failed: {str(e)}"
        )


@router.post("/tracing/generate-feedback")
async def tracing_generate_feedback(
    code_block: str,
    current_frames: str,
    variable_name: str,
    user_answer: str,
    solution: str,
    number_of_attempts: int,
    previous_responses: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Grade variable trace answer and provide feedback.
    Ported from codex-tracing-router.ts:/generateFeedback
    """
    logger.info(f" Tracing generateFeedback - User: {current_user.username}")
    
    system_prompt = """You are an AI assistant that helps users understand programming concepts. 
Given the current frame state, the code block to be executed, the user's answer about what a variable will be, 
and the correct solution, provide feedback (less than 20 words) on why the answer is incorrect and how to find the correct solution.
The feedback should increase in engagement level according to the number of attempts."""
    
    user_message = f"""Current Frame: {current_frames}
Code Block: {code_block}
Variable Name: {variable_name}
User Answer: {user_answer}
Correct Solution: {solution}
Number of Attempts: {number_of_attempts}
Previous Responses: {previous_responses or 'None'}"""
    
    try:
        response = await ollama_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="phi-3-mini",
            temperature=0.25,
            max_tokens=256
        )
        
        feedback_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.info(f" Tracing feedback generated")
        
        return {"feedback": feedback_text, "success": True}
    
    except Exception as e:
        logger.error(f" Tracing generateFeedback error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Feedback generation failed: {str(e)}"
        )


# ============================================================================
# Additional techniques (pseudo, verify, token, etc.) - placeholder for now
# ============================================================================

@router.post("/pseudo/generate")
async def pseudo_generate(
    description: str,
    current_user: User = Depends(get_current_user)
):
    """
    Generate pseudocode for a given problem description.
    Ported from codex-pseudo-router.ts:/generate
    """
    logger.info(f" Pseudo generate - User: {current_user.username}")
    
    system_prompt = "Generate clear, structured pseudocode for the following problem description. Use logical control structures and meaningful variable names."
    
    try:
        response = await ollama_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": description}
            ],
            model="phi-3-mini",
            temperature=0.2,
            max_tokens=800
        )
        
        pseudo_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.info(f" Pseudocode generated")
        
        return {"pseudocode": pseudo_text, "success": True}
    
    except Exception as e:
        logger.error(f" Pseudo generate error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pseudocode generation failed: {str(e)}"
        )


@router.post("/verify/generate-issue")
async def verify_generate_issue(
    code: str,
    task: str,
    current_user: User = Depends(get_current_user)
):
    """
    Identify issues in code compared to task requirements.
    Ported from codex-verify-router.ts:/generateIssue
    """
    logger.info(f" Verify generateIssue - User: {current_user.username}")
    
    system_prompt = """Analyze the provided code and compare it to the task requirements. 
Identify any logical errors, missing functionality, or edge cases not handled. 
Return a JSON with: {"issues": [{"issue": "...", "severity": "high|medium|low"}]}"""
    
    user_message = f"Task: {task}\n\nCode:\n{code}"
    
    try:
        response = await ollama_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="phi-3-mini",
            temperature=0.2,
            max_tokens=500
        )
        
        result_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.info(f" Issues identified")
        
        try:
            result = json.loads(result_text)
        except:
            result = {"issues": [{"issue": result_text, "severity": "medium"}]}
        
        return {"response": result, "success": True}
    
    except Exception as e:
        logger.error(f" Verify generateIssue error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Issue identification failed: {str(e)}"
        )


# ============================================================================
# PLACEHOLDER STUBS FOR REMAINING TECHNIQUES (Future Implementation)
# ============================================================================

@router.post("/token/code-to-token")
async def token_code_to_token(
    code: str,
    current_user: User = Depends(get_current_user)
):
    """
    Tokenize code for token-based learning technique.
    Ported from codex-token-router.ts:/codetotoken
    """
    logger.info(f" Token codetotoken - User: {current_user.username}")
    return {"message": "Not yet implemented", "status": "pending"}


@router.post("/selfexplain/feedback")
async def selfexplain_feedback(
    code: str,
    explanation: str,
    current_user: User = Depends(get_current_user)
):
    """
    Grade self-explanation of code.
    Ported from codex-selfexplain-router.ts:/feedback
    """
    logger.info(f" SelfExplain feedback - User: {current_user.username}")
    return {"message": "Not yet implemented", "status": "pending"}


@router.post("/selfexplain/generate-question")
async def selfexplain_generate_question(
    code: str,
    task: str,
    current_user: User = Depends(get_current_user)
):
    """
    Generate self-explanation questions.
    Ported from codex-selfexplain-router.ts:/generateQuestion
    """
    logger.info(f" SelfExplain generateQuestion - User: {current_user.username}")
    return {"message": "Not yet implemented", "status": "pending"}


@router.post("/parsons/generate")
async def parsons_generate(
    task: str,
    current_user: User = Depends(get_current_user)
):
    """
    Generate Parsons problem (code rearrangement exercise).
    Ported from codex-parsons-router.ts:/generate
    """
    logger.info(f" Parsons generate - User: {current_user.username}")
    return {"message": "Not yet implemented", "status": "pending"}


@router.post("/hierarchical/code-to-pseudocode")
async def hierarchical_code_to_pseudocode(
    code: str,
    current_user: User = Depends(get_current_user)
):
    """
    Convert code to hierarchical pseudocode.
    Ported from codex-hierarchical-router.ts:/codetopseudocode
    """
    logger.info(f" Hierarchical codetopseudocode - User: {current_user.username}")
    return {"message": "Not yet implemented", "status": "pending"}


@router.post("/writeover/generate")
async def writeover_generate(
    code: str,
    current_user: User = Depends(get_current_user)
):
    """
    Generate write-over exercise (fill-in-the-blanks code).
    Ported from codex-writeover-router.ts:/generate
    """
    logger.info(f" WriteOver generate - User: {current_user.username}")
    return {"message": "Not yet implemented", "status": "pending"}
