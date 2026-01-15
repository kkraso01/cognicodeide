
from openai import AsyncOpenAI
import instructor
import httpx
from app.config import settings
import hashlib
import logging
import json
from typing import Dict, Any, Optional, Type
from app.logging_config import ai_logger

logger = logging.getLogger(__name__)
# Use ai_logger for AI-specific logs
ai_log = ai_logger

SUPPORTED_MODELS = ["mistral", "qwen3", "llama3"]

class OllamaService:
	"""Minimal OpenAI-compatible proxy for Ollama API."""
	def __init__(self):
		self.base_url = settings.OLLAMA_API_URL
		self.api_key = settings.OLLAMA_API_KEY

	async def chat_completion(
		self,
		messages: list,
		model: str = "mistral",
		temperature: float = 0.7,
		max_tokens: int = None,
		response_format: Optional[Type] = None
	) -> Dict[str, Any]:
		"""
		Send a chat completion request to Ollama (OpenAI-compatible API). Returns the response as-is.
		"""
		if model not in SUPPORTED_MODELS:
			logger.warning(f"Unsupported model '{model}', using default 'mistral'")
			model = "mistral"
		headers = {"Content-Type": "application/json"}
		if self.api_key:
			headers["Authorization"] = f"Bearer {self.api_key}"
		payload = {
			"model": model,
			"messages": messages,
			"stream": False,
		}
		if response_format:
			schema = response_format.model_json_schema()
			payload["format"] = schema
		# Detailed logging for debugging
		ai_log.info(f"[OllamaService] Request URL: {self.base_url}")
		ai_log.info(f"[OllamaService] Request Headers: {headers}")
		ai_log.info(f"[OllamaService] Request Payload: {json.dumps(payload, ensure_ascii=False)}")
		try:
			async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
				response = await client.post(
					self.base_url,
					json=payload,
					headers=headers
				)
				response.raise_for_status()
				ai_log.info(f"Received response from Ollama (status: {response.status_code})")
				return response.json()
		except httpx.ConnectError as e:
			ai_log.error(f"Connection failed to {self.base_url}: {str(e)}")
			raise Exception(f"Cannot connect to Ollama API at {self.base_url}. Is Ollama running?")
		except httpx.TimeoutException as e:
			ai_log.error(f"Request timeout after 120s: {str(e)}")
			raise Exception(f"Ollama API request timed out after 120 seconds")
		except httpx.HTTPStatusError as e:
			ai_log.error(f"HTTP error {e.response.status_code}: {e.response.text}")
			raise Exception(f"Ollama API returned error {e.response.status_code}: {e.response.text}")
		except httpx.HTTPError as e:
			ai_log.error(f"HTTP error: {str(e)}", exc_info=True)
			raise Exception(f"Error communicating with Ollama API: {str(e)}")

	@staticmethod
	def generate_hash(prompt: str, response: str) -> str:
		"""Generate a hash for the interaction."""
		content = f"{prompt}:{response}"
		return hashlib.sha256(content.encode()).hexdigest()

# Global instance
ollama_service = OllamaService()

# Use manual AsyncOpenAI client creation with instructor.patch()
# instructor.from_provider() doesn't respect OLLAMA_BASE_URL env var, so we use patch instead
ai_log.info(f"[STARTUP] OLLAMA_API_URL (full endpoint): {settings.OLLAMA_API_URL}")
ai_log.info(f"[STARTUP] OLLAMA_BASE_URL: {settings.OLLAMA_BASE_URL}")

# Create AsyncOpenAI client with custom base URL and disabled SSL verification for self-signed certs
ollama_client = AsyncOpenAI(
	base_url=settings.OLLAMA_BASE_URL,
	api_key="ollama",
	http_client=httpx.AsyncClient(verify=False)  # Disable SSL verification
)
ai_log.info(f"[STARTUP] AsyncOpenAI client created with base_url: {ollama_client.base_url}")

# Patch it with instructor for structured outputs
ollama_client = instructor.patch(
	ollama_client,
	mode=instructor.Mode.JSON
)
ai_log.info(f"[STARTUP] AsyncOpenAI client patched with instructor (JSON mode)")
