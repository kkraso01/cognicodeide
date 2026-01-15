from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./cognicode.db"
    
    # JWT
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Ollama AI
    #OLLAMA_API_URL: str = "http://127.0.0.1:11434/api/chat"
    OLLAMA_API_URL: str = "https://chatucy.cs.ucy.ac.cy/ollama/v1/chat/completions"
    OLLAMA_BASE_URL: str = "https://chatucy.cs.ucy.ac.cy/ollama/v1"
    OLLAMA_API_KEY: str = ""
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    # Application
    DEBUG: bool = True
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
