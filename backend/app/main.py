"""
Main FastAPI Application Entrypoint for War Card Game Simulator API.
Handles CORS configuration, lifespan events, database initialization, custom exception handlers,
request execution time logging middleware, health checks, and route mounting.
"""

import os
import json
import time
import logging
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from dotenv import load_dotenv

from app.database import db
from app.routes import games, stats

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("war_game_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown routines.
    """
    logger.info("Application starting up...")
    try:
        # Database initialization
        await db.create_tables()
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database tables: {e}", exc_info=True)

    yield

    logger.info("Application shutting down...")
    try:
        await db.close_connection()
        logger.info("Database connection closed cleanly.")
    except Exception as e:
        logger.error(f"Error during database shutdown: {e}", exc_info=True)


# Instantiate FastAPI app
app = FastAPI(
    title=os.getenv("PROJECT_NAME", "War Card Game Simulator API"),
    version="1.0.0",
    description="Full-stack REST API for simulating the classic War Card Game with interactive steps, auto-simulation, and Turso analytics.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Parse CORS Origins from environment
cors_origins_raw = os.getenv("CORS_ORIGINS", "*")
if "," in cors_origins_raw:
    origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]
else:
    try:
        origins = json.loads(cors_origins_raw)
    except Exception:
        origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if isinstance(origins, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request Logging Middleware
@app.middleware("http")
async def log_requests_middleware(request: Request, call_next: Callable) -> Response:
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    formatted_time = f"{process_time:.2f}ms"
    
    logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({formatted_time})")
    response.headers["X-Process-Time"] = formatted_time
    return response


# Global Exception Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "error_code": exc.status_code,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Input validation error",
            "errors": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "An unexpected internal server error occurred",
            "detail": str(exc) if os.getenv("DEBUG", "False").lower() in ["true", "1"] else None,
        },
    )


# Include Routers
app.include_router(games.router)
app.include_router(stats.router)


# Root & Health Endpoints
@app.get("/", tags=["system"])
async def root():
    """
    Root endpoint returning general API information.
    """
    return {
        "title": os.getenv("PROJECT_NAME", "War Card Game Simulator API"),
        "version": "1.0.0",
        "status": "online",
        "documentation": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["system"])
async def health_check():
    """
    Health check endpoint returning system and database connectivity status.
    """
    db_status = "healthy"
    try:
        await db.execute_query("SELECT 1;")
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "timestamp": time.time(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
