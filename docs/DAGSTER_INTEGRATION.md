# Dagster Data Orchestration for AI Cost Tracking

## Overview

This document describes how [Dagster](https://github.com/dagster-io/dagster) (16K+ stars) orchestrates the tech-economist AI cost tracking pipeline using software-defined assets.

## Why Dagster?

Dagster provides:
- **Declarative asset graph** — dependencies between data assets are explicit
- **Scheduling** — daily, weekly, monthly jobs for cost aggregation
- **Partitions** — backfill historical data by date range
- **Built-in observability** — logs, metrics, alerts per asset
- **Software-defined assets** — maps directly to tech-economist's data model

## Asset-Based Pipeline

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Usage Events   │────▶│ Cost Calculation │────▶│ Monthly Snapshot│
│  (raw ingests)  │     │ (tokencost)      │     │ (aggregation)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Dashboard     │◀────│   Forecast      │◀────│  Token Volume   │
│   (KPIs)        │     │   (6-month)     │     │  (trends)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Asset Definitions

| Asset | Description | Source |
|-------|-------------|--------|
| `raw_usage_events` | Ingested usage events from API/webhook | `usage_events` table |
| `calculated_costs` | Events enriched with tokencost pricing | `raw_usage_events` |
| `daily_aggregates` | Daily cost/revenue summaries | `calculated_costs` |
| `monthly_snapshots` | Monthly rollup with ROI metrics | `daily_aggregates` |
| `forecast` | 6-month spend projection | `monthly_snapshots` |
| `token_volume_trends` | Token usage trends by model/workflow | `calculated_costs` |
| `dashboard_kpis` | Executive KPIs for dashboard | `monthly_snapshots`, `forecast` |

## Data Model Mapping

### Dagster Assets → Database Tables

| Dagster Asset | Table | Description |
|---------------|-------|-------------|
| `raw_usage_events` | `usage_events` | Raw API usage with token counts |
| `calculated_costs` | `usage_events` (enriched) | Events with `prompt_cost_usd`, `completion_cost_usd`, `total_cost_usd` |
| `monthly_snapshots` | `monthly_snapshots` | Monthly aggregates: spend, revenue, ROI, task counts |
| `dashboard_kpis` | `enterprise_config` + computed | Executive metrics: total spend, ROI, EPS impact |

### Dagster Resources

| Resource | Purpose |
|----------|---------|
| `sqlalchemy_engine` | Database connection for SQLite/PostgreSQL |
| `tokencost_client` | Real-time LLM pricing via `tokencost` library |
| `dagster_dbt` | Optional: dbt integration for transformations |

## Scheduling

### Daily Cost Aggregation
- **Schedule**: `@daily` at 00:00 UTC
- **Assets**: `calculated_costs`, `daily_aggregates`
- **Logic**: Query new `usage_events`, apply tokencost pricing, aggregate by day/workflow

### Weekly Forecast Refresh
- **Schedule**: `@weekly` on Monday 00:00 UTC
- **Assets**: `forecast`
- **Logic**: Recompute 6-month projection using exponential smoothing on monthly snapshots

### Monthly Snapshot
- **Schedule**: `@monthly` on 1st at 00:00 UTC
- **Assets**: `monthly_snapshots`
- **Logic**: Finalize month-end aggregates, compute ROI, store in `monthly_snapshots`

## Integration with tokencost

Dagster assets use the `tokencost` library for real-time cost calculation:

```python
from tokencost import count_tokens, cost_per_token

# Calculate costs for an event
prompt_cost, completion_cost = cost_per_token(
    model="gpt-4o",
    prompt_tokens=1500,
    completion_tokens=500
)
```

### Token Pricing Flow
1. **Ingest**: Usage events arrive via API (`/api/usage-events`)
2. **Enrich**: `calculated_costs` asset calls `tokencost.cost_per_token()` for each event
3. **Store**: Enriched costs written back to `usage_events.total_cost_usd`
4. **Aggregate**: Monthly snapshots sum costs across all events

## Deployment

### Local Development
```bash
cd tech-economist
pip install dagster dagster-webserver
dagster dev -m dagster_assets
```

### Production
```bash
# Docker
docker-compose -f docker-compose.dagster.yml up

# Or Kubernetes with Helm
helm install dagster dagster/dagster
```

## Configuration

Environment variables for Dagster:
- `DAGSTER_HOME` — Dagster instance directory
- `DATABASE_URL` — SQLite or PostgreSQL connection string
- `TOKENCOST_API_KEY` — Optional: API key for premium pricing data

## Monitoring

Dagster provides:
- **Asset health** — success/failure rates per asset
- **Run history** — execution logs and timing
- **Alerting** — webhook/email on failures
- **Metrics** — token volume, cost trends, latency

## Next Steps

- [ ] Add `docker-compose.dagster.yml` for containerized deployment
- [ ] Implement backfill for historical data partitions
- [ ] Add alerting rules for cost anomalies
- [ ] Integrate with Dagster Cloud for managed orchestration
