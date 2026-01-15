"""Pydantic models for structured AI responses.

These models define the schema for AI-generated teaching content.
They are used with Instructor (https://github.com/jxnl/instructor) to
guarantee valid, type-safe responses from Ollama via its OpenAI-compatible API.

Instructor handles:
- Automatic retry on validation failures
- JSON parsing and Pydantic validation
- Integration with OpenAI-compatible endpoints (like Ollama's /v1/chat/completions)
"""
from pydantic import BaseModel, Field
from typing import List


class CodeStep(BaseModel):
    """A single step in the Lead-and-Reveal teaching process."""
    question: str = Field(description="A short question asking what needs to be done at this step")
    context: str = Field(description="Brief context about what's been done and what's next")
    codeLine: str = Field(description="ONE line of code for this step")
    explanation: str = Field(description="How this line helps solve the problem")


class LeadAndRevealResponse(BaseModel):
    """Structured response for Lead-and-Reveal teaching technique."""
    steps: List[CodeStep] = Field(
        description="List of code steps, each with question, context, code, and explanation",
        min_length=3,
        max_length=15
    )


class TracePredictStep(BaseModel):
    """A single step in the Trace-and-Predict teaching process."""
    lineNumber: int = Field(description="Line number in the code")
    codeLine: str = Field(description="The actual line of code")
    question: str = Field(description="Question about what this line does or its output")
    explanation: str = Field(description="Explanation of what happens at this line")


class TraceAndPredictResponse(BaseModel):
    """Structured response for Trace-and-Predict teaching technique."""
    steps: List[TracePredictStep] = Field(
        description="List of trace steps through the code execution",
        min_length=2,
        max_length=25
    )


class ParsonsBlock(BaseModel):
    """A single code block in a Parsons problem."""
    code: str = Field(description="The line of code")
    indent: int = Field(description="Correct indentation level (0, 1, 2, etc.)")
    distractor: bool = Field(default=False, description="Whether this is a distractor block (not needed)")


class ParsonsResponse(BaseModel):
    """Structured response for Parsons problem generation."""
    blocks: List[ParsonsBlock] = Field(
        description="List of code blocks that need to be reordered and indented",
        min_length=3,
        max_length=20
    )
    explanation: str = Field(description="Brief explanation of what the code does")


