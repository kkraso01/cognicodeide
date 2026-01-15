# AI Configuration

## Architecture

COGNICODE uses a **backend proxy architecture** for AI interactions to enable:
- **Logging**: All AI interactions are stored in the database with attempt context
- **Replay**: Teachers can review exactly what AI help students received  
- **Transparency**: Track model versions, parameters, and timestamps for reproducibility
- **Lead-and-Reveal**: Student reasoning is captured before AI responses

### Data Flow
```
Frontend  Backend /api/ai/chat  Remote Ollama API  Backend logs  Database  Frontend
```

The backend acts as a **transparent logging proxy**, not generating AI responses itself.

## Environment Variables

The application uses environment variables to configure the backend AI proxy endpoint.

### Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` to configure your AI settings:

   ```env
   # Backend API Configuration (Frontend connects to this)
   VITE_API_URL=http://localhost:8000

   # AI Model Selection (used by backend proxy)
   VITE_AI_MODEL=mistral:latest
   ```

### Backend Configuration (`.env` in backend/)

The backend needs to know where the remote Ollama API is located:

```env
# Remote Ollama API endpoint
OLLAMA_API_URL=https://194.42.17.230/api/send_message
OLLAMA_API_KEY=  # Optional, if API key is required
```

### Configuration Options

#### Frontend Configuration
The frontend only needs to know:
- `VITE_API_URL`: Where the backend is running (default: `http://localhost:8000`)
- `VITE_AI_MODEL`: Which model to request (default: `mistral:latest`)

#### Backend Configuration  
The backend handles the actual AI API communication:
- `OLLAMA_API_URL`: Remote Ollama endpoint (default: `https://194.42.17.230/api/send_message`)
- `OLLAMA_API_KEY`: Optional API key for authentication

#### Available Models
- `mistral:latest` - Microsoft's efficient model (default)
- `qwen3:latest` - Balanced performance
- `mistral:latest` - Higher quality reasoning
- `llama3:latest` - Meta's powerful model

### How It Works

The AI configuration follows this flow:

1. **Frontend** sends chat requests to backend at `/api/ai/chat` with `attemptId`
2. **Backend proxy** (`ai_proxy.py`) forwards to remote Ollama API
3. **Backend logs** the interaction to `ai_interactions` table (linked to attempt)
4. **Backend returns** the AI response to frontend
5. **Teacher replay** can review all logged AI interactions

Frontend components use the centralized API client in `src/utils/apiClient.ts`:

```typescript
// All AI requests go through backend
await api.chat({
  messages: [...],
  model: AI_MODEL,
  temperature: 0.7
}, attemptId);
```

All AI-related components use this pattern:
- `useAIInteraction.ts` - Full-access AI chat
- `LeadAndRevealPanel.tsx` - Lead-and-Reveal technique  
- `TraceAndPredictPanel.tsx` - Trace-and-Predict technique

### Switching Ollama Endpoints

#### Development (Local Ollama)
If running Ollama locally, update backend `.env`:
```bash
# Backend .env
OLLAMA_API_URL=http://127.0.0.1:11434/api/chat
```

Then restart backend:
```bash
cd backend
python -m uvicorn app.main:app --reload
```

#### Production (Remote)
```bash
# Backend .env
OLLAMA_API_URL=https://194.42.17.230/api/send_message
```

### Security Notes

-  **Never commit your `.env` file** - it's already in `.gitignore`
- Use `.env.example` to document available configuration options
- For production, use environment-specific variables
- Consider using API keys for authentication (add `VITE_AI_API_KEY` if needed)

### Troubleshooting

**AI not responding?**
1. Check the backend is running (`http://localhost:8000`)
2. Verify backend can reach Ollama API (check backend logs)
3. Check browser console for errors in frontend
4. Ensure `attemptId` exists (student must start an assignment)

**Model not found?**
- Verify the model is installed on the Ollama server:
  ```bash
  ollama list
  ollama pull mistral:latest  # If model is missing
  ```

**CORS errors?**
- Backend must allow frontend origin in `CORS_ORIGINS` setting
- Check `backend/app/config.py` for CORS configuration

**AI interactions not logging?**
- Verify `attemptId` is being passed to `api.chat()`
- Check backend logs for database errors
- Ensure `ai_interactions` table exists in database
