from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
from typing import Dict, Any
from app.models.models import Attempt, Event, AIInteraction, Run


class ReplayService:
    """Service for replaying student sessions."""
    
    @staticmethod
    async def get_replay_data(attempt_id: int, db: AsyncSession) -> Dict[str, Any]:
        """Get all data needed for replay."""
        # Get attempt
        result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
        attempt = result.scalar_one_or_none()
        
        if not attempt:
            return None
        
        # Get events
        result = await db.execute(
            select(Event)
            .where(Event.attempt_id == attempt_id)
            .order_by(Event.seq)
        )
        events = result.scalars().all()
        
        # Get AI interactions
        result = await db.execute(
            select(AIInteraction)
            .where(AIInteraction.attempt_id == attempt_id)
            .order_by(AIInteraction.created_at)
        )
        ai_interactions = result.scalars().all()
        
        # Get runs
        result = await db.execute(
            select(Run)
            .where(Run.attempt_id == attempt_id)
            .order_by(Run.created_at)
        )
        runs = result.scalars().all()
        
        return {
            "attempt": attempt,
            "events": events,
            "ai_interactions": ai_interactions,
            "runs": runs
        }
    
    @staticmethod
    def calculate_metrics(events: list) -> Dict[str, Any]:
        """Calculate engagement metrics from events."""
        if not events:
            return {
                "active_typing_time": 0,
                "paste_count": 0,
                "avg_paste_size": 0,
                "ai_interaction_count": 0,
                "run_count": 0,
                "session_length": 0
            }
        
        active_typing_time = 0
        paste_count = 0
        total_paste_size = 0
        ai_interaction_count = 0
        run_count = 0
        
        last_edit_time = None
        IDLE_THRESHOLD = 30  # seconds
        
        for event in events:
            try:
                payload = json.loads(event.payload_json)
            except (json.JSONDecodeError, TypeError):
                payload = {}
            
            if event.type == "edit":
                if last_edit_time is not None:
                    time_diff = event.t - last_edit_time
                    if time_diff < IDLE_THRESHOLD:
                        active_typing_time += time_diff
                last_edit_time = event.t
            
            elif event.type == "paste":
                paste_count += 1
                paste_size = payload.get("size", 0)
                total_paste_size += paste_size
            
            elif event.type in ["ai_prompt", "ai_response"]:
                ai_interaction_count += 1
            
            elif event.type == "run":
                run_count += 1
        
        avg_paste_size = total_paste_size / paste_count if paste_count > 0 else 0
        session_length = events[-1].t if events else 0
        
        return {
            "active_typing_time": active_typing_time,
            "paste_count": paste_count,
            "avg_paste_size": avg_paste_size,
            "ai_interaction_count": ai_interaction_count // 2,  # Divide by 2 (prompt + response)
            "run_count": run_count,
            "session_length": session_length
        }


replay_service = ReplayService()
