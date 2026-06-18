from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import asyncio
from datetime import datetime

from scraper import scrape_feeds
from analyzer import GeoAnalyzer
from db import RadarDB
from scheduler import Scheduler

app = FastAPI(title="Geopolitical Radar API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

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


@app.post("/api/refresh")
async def trigger_refresh(background_tasks: BackgroundTasks):
    background_tasks.add_task(scheduler.run_once)
    return {"status": "refresh started", "timestamp": datetime.utcnow().isoformat()}


@app.get("/health")
async def health():
    return {"status": "ok"}
