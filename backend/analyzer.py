import anthropic
import json
import os
import asyncio
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Sei un sistema di analisi geopolitica specializzato nel monitoraggio delle attività
dei ministeri della difesa, delle forze armate e degli equilibri di sicurezza internazionale.

Categorie evento:
- PROCUREMENT: acquisto armamenti, contratti militari, appalti difesa
- EXERCISE: esercitazioni militari, manovre, addestramenti
- POLICY: cambiamenti di politica difensiva, dottrine, leggi
- THREAT: minacce, tensioni, escalation, dichiarazioni ostili
- ALLIANCE: accordi, partnership, cooperazione militare
- SANCTIONS: sanzioni, embarghi, misure restrittive
- INCIDENT: incidenti, scontri, violazioni dello spazio aereo/marittimo
- INTELLIGENCE: spionaggio, cyber, operazioni informazione, leak
- DEPLOYMENT: dispiegamento truppe, missioni, operazioni in corso

Livelli di gravità:
- CRITICAL: rischio guerra imminente, crisi acuta, incidente armato diretto
- HIGH: escalation significativa, rottura diplomatica grave, sanzioni severe
- MEDIUM: tensione latente, esercitazioni provocatorie, accordi rilevanti
- LOW: aggiornamenti di routine, cooperazione ordinaria, dichiarazioni standard"""

EXTRACT_PROMPT = """Analizza questo articolo di difesa/geopolitica ed estrai dati strutturati.

Titolo: {title}
Testo: {text}
Fonte: {source}

Rispondi SOLO con JSON valido, nessun testo aggiuntivo:
{{
  "countries": ["codici ISO2 dei paesi coinvolti, es: IT, US, RU, CN, NATO, EU"],
  "primary_country": "ISO2 del paese protagonista",
  "event_type": "PROCUREMENT|EXERCISE|POLICY|THREAT|ALLIANCE|SANCTIONS|INCIDENT|INTELLIGENCE|DEPLOYMENT",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "title_clean": "titolo conciso e informativo in italiano (max 80 caratteri)",
  "summary_it": "riassunto 2-3 frasi in italiano, fatti chiave e contesto",
  "actors": ["attori chiave: ministri, generali, organizzazioni"],
  "implications": "implicazione geopolitica principale in 1 frase",
  "regions_affected": ["sottoinsieme di: Europe, Middle East, Asia-Pacific, Americas, Africa, Global"]
}}"""


class GeoAnalyzer:

    def _parse_json(self, msg) -> dict:
        for block in msg.content:
            if not hasattr(block, "text"):
                continue
            text = block.text.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            try:
                return json.loads(text)
            except Exception:
                pass
        return {}

    async def analyze(self, article: dict) -> dict:
        text = f"{article.get('title', '')} {article.get('summary', '')}"
        if len(text.strip()) < 40:
            return {}
        try:
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=600,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": EXTRACT_PROMPT.format(
                    title=article.get("title", ""),
                    text=text[:2500],
                    source=article.get("source", ""),
                )}]
            )
            data = self._parse_json(msg)
            if not data:
                return {}
            return {**article, **data, "analyzed_at": __import__("datetime").datetime.utcnow().isoformat()}
        except Exception as e:
            print(f"[analyzer] error: {e}")
            return {}

    async def analyze_batch(self, articles: List[dict]) -> List[dict]:
        results = []
        for article in articles[:20]:
            result = await self.analyze(article)
            if result:
                results.append(result)
            await asyncio.sleep(0.8)
        print(f"[analyzer] analyzed {len(results)}/{len(articles[:20])} articles")
        return results
