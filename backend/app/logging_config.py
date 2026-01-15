import logging
import logging.handlers
import os
from pathlib import Path

# Create logs directory if it doesn't exist
logs_dir = Path("./logs")
logs_dir.mkdir(exist_ok=True)

# Configure AI-specific logger
ai_logger = logging.getLogger("ai")
ai_logger.setLevel(logging.DEBUG)

# File handler for AI logs
ai_file_handler = logging.handlers.RotatingFileHandler(
    logs_dir / "ai.log",
    maxBytes=10_000_000,  # 10MB
    backupCount=5
)
ai_file_handler.setLevel(logging.DEBUG)

# Console handler for AI logs
ai_console_handler = logging.StreamHandler()
ai_console_handler.setLevel(logging.INFO)

# Formatter
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
ai_file_handler.setFormatter(formatter)
ai_console_handler.setFormatter(formatter)

# Add handlers
ai_logger.addHandler(ai_file_handler)
ai_logger.addHandler(ai_console_handler)

# Export the logger
__all__ = ['ai_logger']
