"""The MCP server registers Tech Economist's calculators as callable tools.

Runs fully offline (token pricing falls back to bundled rates). Skipped cleanly
when optional dependencies (``mcp``, ``tokencost``, ``sqlalchemy``) are absent.
"""

from __future__ import annotations

import asyncio

import pytest

pytest.importorskip("mcp")
pytest.importorskip("tokencost")
pytest.importorskip("sqlalchemy")

from app import mcp_server  # noqa: E402


def _tool_names() -> set[str]:
    tools = asyncio.run(mcp_server.mcp.list_tools())
    return {t.name for t in tools}


def test_expected_tools_registered() -> None:
    assert _tool_names() >= {
        "estimate_token_cost",
        "roi_scenario",
        "industry_benchmarks",
        "finops_principles",
        "market_signals",
    }


def test_estimate_token_cost_callable() -> None:
    out = mcp_server.estimate_token_cost("gpt-4o-mini", "hello world", "hi")
    assert out["total_cost_usd"] >= 0
    assert out["estimation_mode"] in {"tokencost", "fallback"}


def test_roi_scenario_callable() -> None:
    out = mcp_server.roi_scenario("SEO Audit", annual_runs=500, avg_revenue_lift_usd=20)
    assert "roi_multiple" in out and "recommendation" in out


def test_knowledge_base_tools_callable() -> None:
    assert mcp_server.industry_benchmarks()
    assert mcp_server.finops_principles()
    assert isinstance(mcp_server.market_signals(), dict)
