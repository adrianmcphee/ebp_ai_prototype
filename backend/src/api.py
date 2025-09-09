import re
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .cache import MockCache, RedisCache
from .config import settings
from .database import Database, MockDatabase
from .entity_extractor import EntityExtractor
from .intent_classifier import IntentClassifier
from .llm_client import create_llm_client
from .mock_banking import MockBankingService
from .pipeline import IntentPipeline
from .state_manager import ConversationStateManager
from .validator import EntityValidator


# Request/Response Models
class ProcessRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    session_id: Optional[str] = None
    skip_resolution: bool = False
    ui_context: Optional[str] = None  # 'banking', 'transaction', 'chat'


class ProcessResponse(BaseModel):
    intent: str
    confidence: float
    entities: dict[str, Any]
    validation: dict[str, Any]
    missing_fields: list[str]
    disambiguations: dict[str, Any]
    warnings: list[str]
    suggestions: dict[str, Any]
    requires_confirmation: bool
    can_execute: bool
    ui_hints: dict[str, Any]
    execution: Optional[dict[str, Any]] = None
    pending_clarification: Optional[dict[str, Any]] = None
    clarification_help: Optional[dict[str, Any]] = None
    clarification_resolved: Optional[bool] = None
    requires_approval: Optional[bool] = None
    approval: Optional[dict[str, Any]] = None
    approval_result: Optional[str] = None


class SessionResponse(BaseModel):
    session_id: str
    created: bool


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    services: dict[str, str]


class RecipientsResponse(BaseModel):
    recipients: list[dict[str, Any]]
    count: int


class UserProfileResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    auth_level: str
    account_ids: list[str]
    authenticated: bool




# Global instances
db: Optional[Database] = None
cache: Optional[RedisCache] = None
pipeline: Optional[IntentPipeline] = None
banking_service: Optional[MockBankingService] = None
websocket_connections: dict[str, WebSocket] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global db, cache, pipeline, banking_service

    # Initialize database
    if settings.database_url == "mock":
        db = MockDatabase()
    else:
        db = Database(settings.database_url)
    await db.connect()

    # Initialize cache
    if settings.redis_url == "mock":
        cache = MockCache()
    else:
        cache = RedisCache(settings.redis_url)
    await cache.connect()

    # Initialize services
    banking_service = MockBankingService()

    # Initialize LLM client
    llm_client = create_llm_client(
        settings.llm_provider, settings.llm_api_key, settings.llm_model
    )

    # Initialize pipeline components
    classifier = IntentClassifier(llm_client, cache)
    extractor = EntityExtractor(llm_client)
    validator = EntityValidator(banking_service)
    state_manager = ConversationStateManager(cache, db)
    
    # Import and create response generator
    from .context_aware_responses import ContextAwareResponseGenerator
    response_generator = ContextAwareResponseGenerator()

    # Initialize pipeline with correct signature
    pipeline = IntentPipeline(
        classifier, extractor, response_generator, state_manager, banking_service, legacy_validator=validator
    )

    print("Application started successfully")

    yield

    # Shutdown
    if db:
        await db.disconnect()
    if cache:
        await cache.disconnect()

    print("Application shut down successfully")


# Create FastAPI app
app = FastAPI(
    title="NLP Banking API",
    version="1.0.0",
    description="Natural Language Processing for Banking Operations",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Helper functions
def sanitize_input(text: str) -> str:
    """Sanitize user input"""
    # Remove control characters
    text = "".join(c for c in text if c.isprintable() or c.isspace())

    # Remove excessive whitespace
    text = re.sub(r"\s+", " ", text).strip()

    # Block injection patterns
    blocked_patterns = [
        r"ignore\s+previous",
        r"system\s*:",
        r"assistant\s*:",
        r"<\s*script",
        r"javascript\s*:",
        r"on\w+\s*=",
    ]

    for pattern in blocked_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            raise HTTPException(400, "Invalid input detected")

    return text


async def get_or_create_session(session_id: Optional[str] = None) -> str:
    """Get existing or create new session"""
    if session_id:
        # Validate session exists
        session = await db.get_session(session_id)
        if session:
            return session_id

    # Create new session
    return await db.create_session()


# API Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    services = {}

    # Check database
    try:
        await db.execute("SELECT 1")
        services["database"] = "healthy"
    except:
        services["database"] = "unhealthy"

    # Check cache
    try:
        await cache.set("health_check", "ok", expire=1)
        services["cache"] = "healthy"
    except:
        services["cache"] = "unhealthy"

    # Overall status
    status = "healthy" if all(s == "healthy" for s in services.values()) else "degraded"

    return HealthResponse(
        status=status, timestamp=datetime.now().isoformat(), services=services
    )


@app.post("/api/session", response_model=SessionResponse)
async def create_session():
    """Create a new session"""
    session_id = await db.create_session()
    return SessionResponse(session_id=session_id, created=True)


@app.get("/api/user-profile", response_model=UserProfileResponse)
async def get_user_profile():
    """Get current user profile - always returns logged in user for demo purposes"""
    if not banking_service:
        raise HTTPException(500, "Banking service unavailable")
    
    try:
        # In a real application, this would validate JWT token and get user_id from it
        # For demo purposes, we use a default user
        profile = await banking_service.get_user_profile()
        
        return UserProfileResponse(
            user_id=profile["user_id"],
            full_name=profile["full_name"],
            email=profile["email"],
            auth_level=profile["auth_level"],
            account_ids=profile["account_ids"],
            authenticated=profile["authenticated"]
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to retrieve user profile: {str(e)}")


@app.post("/api/process")
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def process_query(request: Request, body: ProcessRequest):
    """Process a natural language query"""
    # Sanitize input
    try:
        sanitized_query = sanitize_input(body.query)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Invalid input")

    # Get or create session
    session_id = await get_or_create_session(body.session_id)

    # Get user profile (for demo, we always have a logged-in user)
    user_profile_response = await get_user_profile()
    user_profile = {
        "user_id": user_profile_response.user_id,
        "full_name": user_profile_response.full_name,
        "email": user_profile_response.email,
        "auth_level": user_profile_response.auth_level,
        "account_ids": user_profile_response.account_ids,
        "authenticated": user_profile_response.authenticated
    }

    # Process through pipeline
    try:
        result = await pipeline.process(
            sanitized_query, 
            session_id, 
            user_profile=user_profile,
            skip_resolution=body.skip_resolution, 
            ui_context=body.ui_context
        )

        # Update analytics with available fields
        await db.update_analytics(
            result.get("intent", "unknown"),
            result.get("status") == "success",
            result.get("confidence", 0.0),
            result.get("processing_time_ms", 0),
        )

        # Return simplified response format for frontend
        return {
            "status": result.get("status", "error"),
            "intent": result.get("intent", "unknown"),
            "confidence": result.get("confidence", 0.0),
            "entities": result.get("entities", {}),
            "message": result.get("message", "I'm processing your request..."),
            "ui_assistance": result.get("ui_assistance"),
            "execution": result.get("execution")
        }

    except Exception as e:
        print(f"Processing error: {e}")
        import traceback
        traceback.print_exc()
        # Return error in expected format instead of raising HTTPException
        return {
            "status": "error",
            "intent": "unknown",
            "confidence": 0.0,
            "entities": {},
            "message": "Sorry, I encountered an error processing your request.",
            "ui_assistance": None,
            "execution": None
        }


@app.get("/api/session/{session_id}/summary")
async def get_session_summary(session_id: str):
    """Get session summary"""
    try:
        summary = await pipeline.get_session_summary(session_id)
        return summary
    except Exception:
        raise HTTPException(404, "Session not found")


@app.get("/api/session/{session_id}/history")
async def get_session_history(session_id: str, limit: int = 10):
    """Get session interaction history"""
    try:
        history = await db.get_session_history(session_id, limit)
        return {"session_id": session_id, "history": history}
    except Exception:
        raise HTTPException(404, "Session not found")


@app.get("/api/session/{session_id}/clarification")
async def get_pending_clarification(session_id: str):
    """Get pending clarification request if any"""
    try:
        state_manager = ConversationStateManager(cache, db)
        clarification = await state_manager.get_pending_clarification(session_id)
        if clarification:
            return {"has_pending": True, "clarification": clarification}
        return {"has_pending": False}
    except Exception as e:
        raise HTTPException(500, f"Error retrieving clarification: {e!s}")


@app.post("/api/session/{session_id}/clarification/resolve")
async def resolve_clarification(session_id: str, response: dict[str, str]):
    """Resolve a pending clarification"""
    try:
        state_manager = ConversationStateManager(cache, db)
        result = await state_manager.resolve_clarification(
            session_id, response.get("user_response", "")
        )
        if result:
            return {"resolved": True, "result": result}
        return {"resolved": False, "error": "Could not resolve clarification"}
    except Exception as e:
        raise HTTPException(500, f"Error resolving clarification: {e!s}")


@app.get("/api/session/{session_id}/approval")
async def get_pending_approval(session_id: str):
    """Get pending approval request if any"""
    try:
        state_manager = ConversationStateManager(cache, db)
        approval = await state_manager.get_pending_approval(session_id)
        if approval:
            return {"has_pending": True, "approval": approval}
        return {"has_pending": False}
    except Exception as e:
        raise HTTPException(500, f"Error retrieving approval: {e!s}")


@app.post("/api/session/{session_id}/approval/verify")
async def verify_approval(session_id: str, verification: dict[str, Any]):
    """Verify a transaction approval"""
    try:
        state_manager = ConversationStateManager(cache, db)
        result = await state_manager.verify_approval(session_id, verification)
        return result
    except Exception as e:
        raise HTTPException(500, f"Error verifying approval: {e!s}")


@app.get("/api/accounts")
async def get_accounts():
    """Get all accounts"""
    accounts = await banking_service.get_all_accounts()
    return {"accounts": accounts}


@app.get("/api/accounts/{account_id}/balance")
async def get_account_balance(account_id: str):
    """Get account balance"""
    balance = await banking_service.get_balance(account_id)

    if balance is None:
        raise HTTPException(404, "Account not found")

    return {"account_id": account_id, "balance": balance}


@app.get("/api/accounts/{account_id}/transactions")
async def get_account_transactions(account_id: str, limit: int = 10, offset: int = 0):
    """Get account transaction history"""
    transactions = await banking_service.get_transaction_history(
        account_id, limit, offset
    )

    return {
        "account_id": account_id,
        "transactions": transactions,
        "count": len(transactions),
    }


@app.get("/api/recipients", response_model=RecipientsResponse)
async def get_all_recipients():
    """Get all recipients"""
    if not banking_service:
        raise HTTPException(500, "Banking service unavailable")
    
    try:
        recipients = await banking_service.get_all_recipients()
        return RecipientsResponse(recipients=recipients, count=len(recipients))
    except Exception as e:
        raise HTTPException(500, f"Failed to retrieve recipients: {str(e)}")


@app.get("/api/recipients/search", response_model=RecipientsResponse)
async def search_recipients(query: str):
    """Search for recipients by name or alias"""
    if not query or len(query) < 2:
        raise HTTPException(400, "Query must be at least 2 characters long")
    
    if not banking_service:
        raise HTTPException(500, "Banking service unavailable")
    
    try:
        recipients = await banking_service.search_recipients(query)
        return RecipientsResponse(recipients=recipients, count=len(recipients))
    except Exception as e:
        raise HTTPException(500, f"Failed to search recipients: {str(e)}")


@app.post("/api/transfer/validate")
async def validate_transfer(from_account: str, to_recipient: str, amount: float):
    """Validate a transfer"""
    validation = await banking_service.validate_transfer(
        from_account, to_recipient, amount
    )
    return validation


@app.post("/api/transfer/execute")
@limiter.limit("10/minute")
async def execute_transfer(
    request: Request,
    from_account: str,
    to_recipient: str,
    amount: float,
    reference: str = "",
):
    """Execute a transfer"""
    result = await banking_service.execute_transfer(
        from_account, to_recipient, amount, reference
    )
    return result


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time communication"""
    await websocket.accept()

    # Store connection
    websocket_connections[session_id] = websocket

    try:
        while True:
            # Receive message
            data = await websocket.receive_json()

            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if data.get("type") == "query":
                # Process query
                query = sanitize_input(data.get("query", ""))

                result = await pipeline.process(query, session_id)

                # Check if clarification is needed
                if result.get("pending_clarification"):
                    await websocket.send_json(
                        {
                            "type": "clarification_request",
                            "data": result["pending_clarification"],
                        }
                    )
                # Check if approval is needed
                elif result.get("requires_approval"):
                    await websocket.send_json(
                        {"type": "approval_request", "data": result["approval"]}
                    )
                else:
                    await websocket.send_json({"type": "result", "data": result})

            elif data.get("type") == "clarification_response":
                # Handle clarification response
                response = data.get("response")
                state_manager = ConversationStateManager(cache, db)
                resolution = await state_manager.resolve_clarification(
                    session_id, response
                )

                if resolution and resolution["resolved"]:
                    # Process with clarified entities
                    result = await pipeline._resume_with_clarified_entities(
                        session_id,
                        resolution["original_intent"],
                        resolution["updated_entities"],
                    )
                    await websocket.send_json(
                        {"type": "clarification_resolved", "data": result}
                    )
                else:
                    await websocket.send_json(
                        {
                            "type": "clarification_failed",
                            "message": "Could not resolve clarification",
                        }
                    )

            elif data.get("type") == "approval_response":
                # Handle approval response
                verification = data.get("verification", {})
                state_manager = ConversationStateManager(cache, db)
                result = await state_manager.verify_approval(session_id, verification)

                await websocket.send_json({"type": "approval_result", "data": result})

    except WebSocketDisconnect:
        # Remove connection
        if session_id in websocket_connections:
            del websocket_connections[session_id]

    except Exception as e:
        print(f"WebSocket error: {e}")
        if session_id in websocket_connections:
            del websocket_connections[session_id]





@app.get("/api/demo/scenarios")
async def get_demo_scenarios():
    """Get demo scenarios for testing"""
    from .demo_data import DEMO_SCENARIOS

    return {"scenarios": DEMO_SCENARIOS}


@app.post("/api/demo/reset")
async def reset_demo_data():
    """Reset demo data to initial state"""
    global banking_service
    banking_service = MockBankingService()
    await cache.flush_all()
    return {"status": "reset_complete"}


# Error handlers
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    print(f"Unhandled exception: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
