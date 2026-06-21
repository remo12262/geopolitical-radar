from fastapi import FastAPI, BackgroundTasks, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional
from pydantic import BaseModel
import asyncio
import os
from datetime import datetime
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from dotenv import load_dotenv

from scraper import scrape_feeds
from analyzer import GeoAnalyzer
from db import RadarDB
from scheduler import Scheduler

load_dotenv()

APP_PASSWORD = os.getenv("APP_PASSWORD", "georadar2026")
SESSION_SECRET = os.getenv("SESSION_SECRET", "fallback-secret-key")
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days

serializer = URLSafeTimedSerializer(SESSION_SECRET)

app = FastAPI(title="Geopolitical Radar API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True)


class LoginRequest(BaseModel):
    password: str


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    public_paths = ["/api/login", "/health", "/docs", "/openapi.json"]
    if any(request.url.path.startswith(p) for p in public_paths):
        return await call_next(request)

    token = request.cookies.get("session")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if token:
        try:
            serializer.loads(token, max_age=SESSION_MAX_AGE)
            return await call_next(request)
        except (BadSignature, SignatureExpired):
            pass

    return JSONResponse(status_code=401, content={"detail": "Non autenticato"})


@app.post("/api/login")
async def login(req: LoginRequest, response: Response):
    if req.password != APP_PASSWORD:
        return JSONResponse(status_code=401, content={"detail": "Password errata"})
    token = serializer.dumps("authenticated")
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        max_age=SESSION_MAX_AGE,
        samesite="lax",
    )
    return {"status": "ok", "token": token}

db = RadarDB()
analyzer = GeoAnalyzer()
scheduler = Scheduler(scrape_feeds, analyzer, db)


@app.on_event("startup")
async def startup():
    await db.init()
    asyncio.create_task(scheduler.run())


@app.get("/api/events")
async def get_events(
    country: Optional[str] = None,
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 50,
):
    return await db.get_events(country, severity, event_type, limit)


@app.get("/api/alerts")
async def get_alerts():
    return await db.get_alerts()


@app.get("/api/radar")
async def get_radar():
    return await db.get_radar()


@app.get("/api/stats")
async def get_stats():
    return await db.get_stats()


@app.get("/api/predictions")
async def get_predictions():
    return await db.get_predictions()


@app.post("/api/refresh")
async def trigger_refresh(background_tasks: BackgroundTasks):
    background_tasks.add_task(scheduler.run_once)
    return {"status": "refresh started", "timestamp": datetime.utcnow().isoformat()}


@app.get("/health")
async def health():
    return {"status": "ok"}
