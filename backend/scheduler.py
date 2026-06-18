import asyncio
from datetime import datetime

REFRESH_INTERVAL = 8 * 3600  # 8 hours


class Scheduler:
    def __init__(self, scrape_fn, analyzer, db):
        self.scrape_fn = scrape_fn
        self.analyzer = analyzer
        self.db = db

    async def run_once(self):
        print(f"[scheduler] refresh at {datetime.utcnow().isoformat()}")
        try:
            articles = await self.scrape_fn()
            analyzed = await self.analyzer.analyze_batch(articles)
            await self.db.upsert_events(analyzed)
        except Exception as e:
            print(f"[scheduler] error: {e}")

    async def run(self):
        await self.run_once()
        while True:
            await asyncio.sleep(REFRESH_INTERVAL)
            await self.run_once()
