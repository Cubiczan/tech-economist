"""
Airbyte data sync for tech-economist.

Replaces hardcoded benchmarks and market signals with Airbyte-managed data
sources. Configure connectors in Airbyte web app, then sync to local SQLite.

Airbyte advantages:
- Benchmarks/pricing maintained in Google Sheets or Airtable (not code)
- Automatic credential management and refresh
- Scheduled sync via Airbyte platform or Dagster
- MCP server access for AI agent queries

Setup:
    export AIRBYTE_CLIENT_ID=<your_client_id>
    export AIRBYTE_CLIENT_SECRET=<your_client_secret>
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Airbyte SDK bridge
# ---------------------------------------------------------------------------

_airbyte_available = False
try:
    from airbyte_agent_sdk import connect, Workspace, AirbyteError
    _airbyte_available = True
except ImportError:
    logger.info("airbyte-agent-sdk not installed; using local benchmarks")


def is_airbyte_available() -> bool:
    if not _airbyte_available:
        return False
    return bool(os.environ.get("AIRBYTE_CLIENT_ID") and os.environ.get("AIRBYTE_CLIENT_SECRET"))


# ---------------------------------------------------------------------------
# Airtable/Google Sheets benchmark sync
# ---------------------------------------------------------------------------

async def sync_benchmarks_from_airtable(
    airtable_connector_id: Optional[str] = None,
    base_id: Optional[str] = None,
    table_name: str = "Benchmarks",
) -> List[Dict[str, Any]]:
    """
    Sync workflow benchmarks from Airtable via Airbyte SDK.

    Replaces the hardcoded INDUSTRY_BENCHMARKS list in benchmarks.py.
    Maintain your benchmarks in an Airtable base with columns:
        name, category, median_cost_usd, median_roi, source, insight

    This allows non-developers to update benchmarks without code changes.
    """
    if not is_airbyte_available():
        raise RuntimeError("Airbyte SDK not configured")

    try:
        airtable = connect("airtable", connector_id=airtable_connector_id)
        result = await airtable.execute("records", "list", params={
            "base_id": base_id or os.environ.get("AIRTABLE_BASE_ID", ""),
            "table_name": table_name,
        })
        benchmarks = []
        for row in result.data:
            fields = row.get("fields", {})
            benchmarks.append({
                "name": fields.get("name", ""),
                "category": fields.get("category", ""),
                "median_cost_usd": float(fields.get("median_cost_usd", 0)),
                "median_roi": float(fields.get("median_roi", 0)),
                "source": fields.get("source", "Airtable"),
                "insight": fields.get("insight", ""),
            })
        logger.info("Synced %d benchmarks from Airtable", len(benchmarks))
        return benchmarks
    except AirbyteError as exc:
        logger.error("Airtable sync failed: %s", exc)
        raise


async def sync_benchmarks_from_google_sheets(
    sheets_connector_id: Optional[str] = None,
    spreadsheet_id: Optional[str] = None,
    range_name: str = "Benchmarks!A2:F",
) -> List[Dict[str, Any]]:
    """
    Sync workflow benchmarks from Google Sheets via Airbyte SDK.

    Alternative to Airtable — use Google Sheets as the benchmark source.
    Columns: name, category, median_cost_usd, median_roi, source, insight
    """
    if not is_airbyte_available():
        raise RuntimeError("Airbyte SDK not configured")

    try:
        gdrive = connect("google_drive", connector_id=sheets_connector_id)
        result = await gdrive.execute("spreadsheets", "get", params={
            "spreadsheet_id": spreadsheet_id or os.environ.get("BENCHMARKS_SHEET_ID", ""),
            "range": range_name,
        })
        benchmarks = []
        for row in result.data:
            if len(row) >= 6:
                benchmarks.append({
                    "name": row[0],
                    "category": row[1],
                    "median_cost_usd": float(row[2]) if row[2] else 0,
                    "median_roi": float(row[3]) if row[3] else 0,
                    "source": row[4] or "Google Sheets",
                    "insight": row[5] or "",
                })
        logger.info("Synced %d benchmarks from Google Sheets", len(benchmarks))
        return benchmarks
    except AirbyteError as exc:
        logger.error("Google Sheets sync failed: %s", exc)
        raise


# ---------------------------------------------------------------------------
# Market signals sync
# ---------------------------------------------------------------------------

async def sync_market_signals_from_airtable(
    connector_id: Optional[str] = None,
    base_id: Optional[str] = None,
    table_name: str = "MarketSignals",
) -> Dict[str, Any]:
    """
    Sync market signals from Airtable.

    Replaces hardcoded MARKET_SIGNALS dict with a live data source.
    """
    if not is_airbyte_available():
        raise RuntimeError("Airbyte SDK not configured")

    try:
        airtable = connect("airtable", connector_id=connector_id)
        result = await airtable.execute("records", "list", params={
            "base_id": base_id or os.environ.get("SIGNALS_BASE_ID", ""),
            "table_name": table_name,
        })
        signals = {}
        for row in result.data:
            fields = row.get("fields", {})
            key = fields.get("key", "")
            value = fields.get("value")
            if key:
                try:
                    signals[key] = float(value) if value else 0
                except (TypeError, ValueError):
                    signals[key] = value
        logger.info("Synced %d market signals from Airtable", len(signals))
        return signals
    except AirbyteError as exc:
        logger.error("Market signals sync failed: %s", exc)
        raise


# ---------------------------------------------------------------------------
# Hybrid getter: Airbyte first, fallback to hardcoded
# ---------------------------------------------------------------------------

async def get_benchmarks() -> List[Dict[str, Any]]:
    """
    Get benchmarks with Airbyte-first strategy.

    Tries Airbyte connectors (Airtable or Google Sheets) first.
    Falls back to hardcoded benchmarks from benchmarks.py if:
    - Airbyte SDK is not installed
    - No credentials configured
    - Connector call fails
    """
    from app.services.benchmarks import get_benchmarks as get_hardcoded_benchmarks

    if is_airbyte_available():
        try:
            # Try Airtable first, then Google Sheets
            if os.environ.get("AIRTABLE_BASE_ID"):
                return await sync_benchmarks_from_airtable()
            elif os.environ.get("BENCHMARKS_SHEET_ID"):
                return await sync_benchmarks_from_google_sheets()
        except Exception as exc:
            logger.warning("Airbyte benchmark sync failed, using hardcoded: %s", exc)

    # Fallback: convert BenchmarkWorkflow objects to dicts
    hardcoded = get_hardcoded_benchmarks()
    return [
        {
            "name": b.name,
            "category": b.category,
            "median_cost_usd": b.median_cost_usd,
            "median_roi": b.median_roi,
            "source": b.source,
            "insight": b.insight,
        }
        for b in hardcoded
    ]


async def get_market_signals() -> Dict[str, Any]:
    """Get market signals with Airbyte-first strategy."""
    from app.services.benchmarks import get_market_signals as get_hardcoded_signals

    if is_airbyte_available() and os.environ.get("SIGNALS_BASE_ID"):
        try:
            return await sync_market_signals_from_airtable()
        except Exception as exc:
            logger.warning("Airbyte signals sync failed, using hardcoded: %s", exc)

    return get_hardcoded_signals()


# ---------------------------------------------------------------------------
# MCP configuration
# ---------------------------------------------------------------------------

def get_mcp_config() -> Dict[str, Any]:
    """Return MCP server config for AI agent access to benchmarks data."""
    return {
        "mcp_server_url": "https://mcp.airbyte.ai/mcp",
        "setup": {
            "claude_code": "claude mcp add --transport http airbyte-agent https://mcp.airbyte.ai/mcp",
            "cursor": '{"mcpServers": {"Agent MCP": {"url": "https://mcp.airbyte.ai/mcp"}}}',
        },
        "recommended_connectors": [
            "airtable (for live benchmark/signal management)",
            "google_drive (for spreadsheet-based benchmark data)",
            "slack (for cost alert notifications)",
        ],
    }
