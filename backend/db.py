from typing import List, Dict, Optional
from datetime import datetime

SEV_SCORE = {'CRITICAL': 90, 'HIGH': 68, 'MEDIUM': 38, 'LOW': 12}

COUNTRY_REGION = {
    'UA': 'Europa Est', 'RU': 'Europa Est', 'BY': 'Europa Est', 'PL': 'Europa Est',
    'IL': 'Medio Oriente', 'IR': 'Medio Oriente', 'SA': 'Medio Oriente', 'SY': 'Medio Oriente',
    'IQ': 'Medio Oriente', 'YE': 'Medio Oriente', 'EG': 'Medio Oriente', 'LY': 'Medio Oriente',
    'CN': 'Asia Est', 'KP': 'Asia Est', 'KR': 'Asia Est', 'JP': 'Asia Est', 'TW': 'Asia Est',
    'IN': 'Asia Sud', 'PK': 'Asia Sud', 'AF': 'Asia Sud',
    'MM': 'Asia Sud-Est', 'PH': 'Asia Sud-Est',
    'US': 'Americhe', 'CA': 'Americhe', 'BR': 'Americhe', 'VE': 'Americhe',
    'UK': 'Europa', 'FR': 'Europa', 'DE': 'Europa', 'IT': 'Europa',
    'ES': 'Europa', 'TR': 'Europa',
    'AU': 'Oceania', 'NZ': 'Oceania',
    'NATO': 'Globale', 'EU': 'Europa', 'UN': 'Globale', 'MULTI': 'Globale',
}

REGIONAL_VOLATILITY = {
    'Medio Oriente': 88, 'Europa Est': 82, 'Asia Est': 72, 'Asia Sud': 65,
    'Africa': 62, 'Asia Sud-Est': 55, 'Globale': 48,
    'Americhe': 30, 'Europa': 28, 'Oceania': 15,
}


def _calc_prob(base_sev: float, volatility: float, source_count: int, trend: str, horizon: str) -> int:
    trend_mod = {'escalating': 12, 'stable': 0, 'declining': -10}.get(trend, 0)
    source_boost = min(source_count * 4, 18)
    if horizon == '72h':
        p = base_sev * 0.72 + volatility * 0.12 + source_boost + trend_mod
    elif horizon == '7d':
        p = base_sev * 0.50 + volatility * 0.28 + source_boost * 0.8 + trend_mod * 0.75
    else:  # 30d
        p = base_sev * 0.30 + volatility * 0.48 + source_boost * 0.5 + trend_mod * 0.5
    return max(5, min(97, round(p)))


def _build_factors(sev_score: float, volatility: float, source_count: int, trend: str, region: str) -> List[str]:
    factors = []
    if sev_score >= 70:
        factors.append("Evento ad alta gravità")
    if volatility >= 75:
        factors.append(f"{region}: zona volatile")
    if source_count >= 3:
        factors.append(f"{source_count} fonti concordanti")
    if trend == 'escalating':
        factors.append("Trend in escalation")
    elif trend == 'declining':
        factors.append("Trend in de-escalation")
    return factors or ["Monitoraggio continuativo"]


class RadarDB:
    def __init__(self):
        self.events: Dict[str, Dict] = {}
        self.last_refresh: Optional[str] = None

    async def init(self):
        pass

    async def upsert_events(self, events: List[Dict]):
        new = 0
        for event in events:
            eid = event.get("id", "")
            if eid and eid not in self.events:
                self.events[eid] = event
                new += 1
        self.last_refresh = datetime.utcnow().isoformat()
        print(f"[db] +{new} new events, total: {len(self.events)}")

    async def get_events(
        self,
        country: Optional[str] = None,
        severity: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict]:
        events = list(self.events.values())
        if country:
            events = [e for e in events if country in (e.get("countries") or [])]
        if severity:
            events = [e for e in events if e.get("severity") == severity]
        if event_type:
            events = [e for e in events if e.get("event_type") == event_type]
        events.sort(key=lambda e: e.get("analyzed_at", ""), reverse=True)
        return events[:limit]

    async def get_alerts(self) -> List[Dict]:
        sev_order = {"CRITICAL": 3, "HIGH": 2}
        alerts = [e for e in self.events.values() if e.get("severity") in sev_order]
        alerts.sort(key=lambda e: sev_order.get(e.get("severity", ""), 0), reverse=True)
        return alerts[:20]

    async def get_radar(self) -> Dict:
        events = list(self.events.values())
        country_stats: Dict[str, Dict] = {}
        for event in events:
            for country in event.get("countries") or []:
                if country not in country_stats:
                    country_stats[country] = {"count": 0, "critical": 0, "high": 0, "types": []}
                cs = country_stats[country]
                cs["count"] += 1
                sev = event.get("severity", "")
                if sev == "CRITICAL":
                    cs["critical"] += 1
                elif sev == "HIGH":
                    cs["high"] += 1
                et = event.get("event_type", "")
                if et and et not in cs["types"]:
                    cs["types"].append(et)
        return {
            "country_stats": country_stats,
            "total_events": len(events),
            "critical_count": sum(1 for e in events if e.get("severity") == "CRITICAL"),
            "high_count": sum(1 for e in events if e.get("severity") == "HIGH"),
            "last_refresh": self.last_refresh,
        }

    async def get_stats(self) -> Dict:
        events = list(self.events.values())
        by_type: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}
        by_region: Dict[str, int] = {}
        for e in events:
            t = e.get("event_type", "UNKNOWN")
            by_type[t] = by_type.get(t, 0) + 1
            s = e.get("severity", "UNKNOWN")
            by_severity[s] = by_severity.get(s, 0) + 1
            for r in e.get("regions_affected") or []:
                by_region[r] = by_region.get(r, 0) + 1
        return {
            "total": len(events),
            "by_type": by_type,
            "by_severity": by_severity,
            "by_region": by_region,
            "last_refresh": self.last_refresh,
        }

    async def get_predictions(self) -> List[Dict]:
        events = list(self.events.values())
        if not events:
            return []

        # Group events by primary_country
        country_events: Dict[str, List[Dict]] = {}
        for event in events:
            pc = event.get("primary_country") or (event.get("countries") or ["MULTI"])[0]
            country_events.setdefault(pc, []).append(event)

        hotspots = []
        for country, evts in country_events.items():
            sev_scores = [SEV_SCORE.get(e.get("severity", ""), 0) for e in evts]
            avg_sev = sum(sev_scores) / len(sev_scores)
            max_sev = float(max(sev_scores))

            sources = {e.get("source", "") for e in evts}
            source_count = len(sources)

            # Trend: compare older vs newer half of events
            half = len(evts) // 2
            if half >= 1:
                old_avg = sum(SEV_SCORE.get(e.get("severity", ""), 0) for e in evts[:half]) / half
                new_avg = sum(SEV_SCORE.get(e.get("severity", ""), 0) for e in evts[half:]) / max(len(evts[half:]), 1)
                if new_avg > old_avg + 8:
                    trend = "escalating"
                elif new_avg < old_avg - 8:
                    trend = "declining"
                else:
                    trend = "stable"
            else:
                trend = "stable"

            region = COUNTRY_REGION.get(country, "Globale")
            volatility = float(REGIONAL_VOLATILITY.get(region, 48))

            top_event = max(evts, key=lambda e: SEV_SCORE.get(e.get("severity", ""), 0))

            hotspots.append({
                "country": country,
                "region": region,
                "event_count": len(evts),
                "source_count": source_count,
                "trend": trend,
                "top_severity": top_event.get("severity", "LOW"),
                "top_event": (top_event.get("title_clean") or top_event.get("title", ""))[:80],
                "prob_72h": _calc_prob(max_sev, volatility, source_count, trend, "72h"),
                "prob_7d":  _calc_prob(avg_sev, volatility, source_count, trend, "7d"),
                "prob_30d": _calc_prob(avg_sev * 0.85, volatility, source_count, trend, "30d"),
                "factors": _build_factors(avg_sev, volatility, source_count, trend, region),
            })

        hotspots.sort(key=lambda h: h["prob_72h"], reverse=True)
        return hotspots[:10]
