"""MCP server for Tech Economist.

Exposes the backend's deterministic AI-token-economics calculators as Model
Context Protocol tools: token cost estimation, ROI scenario modeling, and the
built-in industry benchmark / FinOps knowledge base. Thin wrapper — all logic
lives in ``app.services`` and is reused verbatim. The database-backed analytics
(dashboard, workflow economics, forecasts) are intentionally not exposed here
because they require a live SQLAlchemy session; these tools are pure and
offline.

Follows the same publishing path proven by codesentinel / codehealth-mcp:
namespace ``io.github.Cubiczan``, stdio transport, published via the
``mcp-publisher`` CLI (see the "MCP Server" section of the README).

Run it (from the ``backend`` directory so ``app`` is importable):

    uvx --from tech-economist-backend tech-economist-mcp
    # or, from a checkout:
    cd backend && python -m app.mcp_server
"""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from app.schemas import RoiScenarioRequest
from app.services.analytics import run_roi_scenario
from app.services.benchmarks import (
    get_benchmarks,
    get_finops_principles,
    get_market_signals,
)
from app.services.tokencost_service import estimate_cost

mcp = FastMCP(
    "tech-economist",
    instructions=(
        "AI token economics for CFOs and platform teams: estimate per-call LLM "
        "cost, model annual ROI for an agentic workflow, and consult industry "
        "benchmarks, FinOps principles, and market signals. Deterministic and "
        "offline (token pricing falls back to bundled rates when encodings are "
        "unavailable)."
    ),
)


@mcp.tool()
def estimate_token_cost(
    model: str,
    prompt: str,
    completion: str = "",
) -> dict[str, Any]:
    """Estimate the token cost of a single LLM call.

    Returns prompt/completion token counts, per-part and total USD cost, blended
    cost per 1M tokens, and the estimation mode (tokencost vs. offline fallback).

    Args:
        model: Model identifier, e.g. "gpt-4o", "gpt-4o-mini",
            "claude-3-5-sonnet-20241022".
        prompt: The prompt text.
        completion: The completion text (optional; empty for prompt-only cost).
    """
    return estimate_cost(model, prompt, completion)


@mcp.tool()
def roi_scenario(
    workflow_name: str,
    annual_runs: int = 1000,
    success_rate: float = 0.85,
    avg_revenue_lift_usd: float = 0.0,
    avg_hours_saved: float = 0.0,
    hourly_cost_usd: float = 150.0,
    model: str = "gpt-4o-mini",
    avg_prompt_tokens: int = 2000,
    avg_completion_tokens: int = 800,
    manual_baseline_cost_usd: float = 0.0,
) -> dict[str, Any]:
    """Model the annual ROI of an agentic workflow.

    Combines token cost (with a 1.85x retry-overhead multiplier), labor value,
    revenue lift, and manual-baseline savings into annual cost/value/net,
    ROI multiple, payback months, cost per successful task, and a plain-language
    recommendation.

    Args:
        workflow_name: Label for the workflow being modeled.
        annual_runs: Expected runs per year.
        success_rate: Fraction of runs that succeed (0-1).
        avg_revenue_lift_usd: Attributed revenue lift per successful run.
        avg_hours_saved: Labor hours saved per successful run.
        hourly_cost_usd: Fully-loaded hourly labor cost.
        model: Model used for the workflow (drives token cost).
        avg_prompt_tokens: Average prompt tokens per run.
        avg_completion_tokens: Average completion tokens per run.
        manual_baseline_cost_usd: Manual per-run cost the workflow replaces.
    """
    req = RoiScenarioRequest(
        workflow_name=workflow_name,
        annual_runs=annual_runs,
        success_rate=success_rate,
        avg_revenue_lift_usd=avg_revenue_lift_usd,
        avg_hours_saved=avg_hours_saved,
        hourly_cost_usd=hourly_cost_usd,
        model=model,
        avg_prompt_tokens=avg_prompt_tokens,
        avg_completion_tokens=avg_completion_tokens,
        manual_baseline_cost_usd=manual_baseline_cost_usd,
    )
    return run_roi_scenario(req).model_dump()


@mcp.tool()
def industry_benchmarks() -> list[dict[str, Any]]:
    """Return the built-in industry benchmark workflows.

    Each entry has name, category, median cost/run, median ROI, source, and an
    insight — synthesized from Deloitte, Bain, FinOps Foundation, and Digital
    Applied (2025-2026).
    """
    return [b.model_dump() for b in get_benchmarks()]


@mcp.tool()
def finops_principles() -> list[dict[str, Any]]:
    """Return the built-in FinOps principles for AI token spend.

    Each principle carries a title, source, and detail (e.g. cost-per-successful-
    task, dedicated AI compute budget, model routing, retry-overhead multiplier).
    """
    return get_finops_principles()


@mcp.tool()
def market_signals() -> dict[str, Any]:
    """Return current AI-token market signals.

    Includes token price decline, consumption growth, prompt-cache savings
    range, high-reasoning cost multiplier, median agency ROI range, and the
    share of orgs increasing AI investment.
    """
    return get_market_signals()


def main() -> None:
    """Console-script entry point: run the server over stdio."""
    mcp.run()


if __name__ == "__main__":
    main()
