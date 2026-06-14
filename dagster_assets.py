from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from dagster import (
    Definitions,
    ScheduleDefinition,
    asset,
    configure_assets,
    OpExecutionContext,
    SourceAsset,
    WeeklyPartitionsDefinition,
    MonthlyPartitionsDefinition,
    DailyPartitionsDefinition,
    materialize,
)
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Optional: tokencost for real-time pricing
try:
    from tokencost import cost_per_token
    HAS_TOKENCOST = True
except ImportError:
    HAS_TOKENCOST = False


# ---------------------------------------------------------------------------
# Database configuration
# ---------------------------------------------------------------------------

DATABASE_URL = "sqlite:///backend/data/tech_economist.db"

engine = create_engine(DATABASE_URL, echo=False)


# ---------------------------------------------------------------------------
# Partition definitions
# ---------------------------------------------------------------------------

daily_partitions = DailyPartitionsDefinition(start_date="2025-01-01")
weekly_partitions = WeeklyPartitionsDefinition(start_date="2025-01-06")
monthly_partitions = MonthlyPartitionsDefinition(start_date="2025-01-01")


# ---------------------------------------------------------------------------
# Source assets (existing data)
# ---------------------------------------------------------------------------

workflows_asset = SourceAsset(key="workflows")
usage_events_asset = SourceAsset(key="usage_events")
enterprise_config_asset = SourceAsset(key="enterprise_config")


# ---------------------------------------------------------------------------
# Dagster assets
# ---------------------------------------------------------------------------

@asset(
    deps=[usage_events_asset],
    partitions_def=daily_partitions,
    group_name="ingestion",
)
def raw_usage_events(context: OpExecutionContext) -> None:
    """Ingest raw usage events from the API for a given partition date."""
    partition_date = context.partition_time_window.start.date()
    
    with Session(engine) as session:
        count = session.execute(
            text("SELECT COUNT(*) FROM usage_events WHERE DATE(recorded_at) = :date"),
            {"date": partition_date},
        ).scalar()
    
    context.log.info(
        f"Raw usage events for {partition_date}: {count} records"
    )


@asset(
    deps=[raw_usage_events_asset],
    partitions_def=daily_partitions,
    group_name="cost_calculation",
)
def calculated_costs(context: OpExecutionContext) -> None:
    """Calculate costs for usage events using tokencost pricing."""
    if not HAS_TOKENCOST:
        context.log.warning("tokencost not installed, skipping cost calculation")
        return
    
    partition_date = context.partition_time_window.start.date()
    
    with Session(engine) as session:
        events = session.execute(
            text("""
                SELECT id, model, prompt_tokens, completion_tokens 
                FROM usage_events 
                WHERE DATE(recorded_at) = :date 
                AND total_cost_usd = 0
            """),
            {"date": partition_date},
        ).fetchall()
        
        updated = 0
        for event in events:
            try:
                prompt_cost, completion_cost = cost_per_token(
                    model=event.model,
                    prompt_tokens=event.prompt_tokens,
                    completion_tokens=event.completion_tokens,
                )
                total_cost = prompt_cost + completion_cost
                
                session.execute(
                    text("""
                        UPDATE usage_events 
                        SET prompt_cost_usd = :prompt_cost,
                            completion_cost_usd = :completion_cost,
                            total_cost_usd = :total_cost
                        WHERE id = :id
                    """),
                    {
                        "id": event.id,
                        "prompt_cost": prompt_cost,
                        "completion_cost": completion_cost,
                        "total_cost": total_cost,
                    },
                )
                updated += 1
            except Exception as e:
                context.log.warning(f"Failed to calculate cost for event {event.id}: {e}")
        
        session.commit()
    
    context.log.info(f"Calculated costs for {updated} events on {partition_date}")


@asset(
    deps=[calculated_costs_asset],
    partitions_def=daily_partitions,
    group_name="aggregation",
)
def daily_aggregates(context: OpExecutionContext) -> None:
    """Aggregate daily cost and revenue metrics."""
    partition_date = context.partition_time_window.start.date()
    
    with Session(engine) as session:
        result = session.execute(
            text("""
                SELECT 
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN successful = 1 THEN 1 ELSE 0 END) as successful_tasks,
                    SUM(total_cost_usd) as total_cost,
                    SUM(revenue_lift_usd) as total_revenue,
                    SUM(prompt_tokens + completion_tokens) as total_tokens
                FROM usage_events
                WHERE DATE(recorded_at) = :date
            """),
            {"date": partition_date},
        ).fetchone()
        
        if result and result.total_tasks > 0:
            context.log.info(
                f"Daily aggregates for {partition_date}: "
                f"{result.total_tasks} tasks, "
                f"${result.total_cost:.2f} cost, "
                f"${result.total_revenue:.2f} revenue"
            )


@asset(
    deps=[daily_aggregates_asset],
    partitions_def=monthly_partitions,
    group_name="snapshot",
)
def monthly_snapshots(context: OpExecutionContext) -> None:
    """Generate monthly snapshot with ROI metrics."""
    partition_date = context.partition_time_window.start.date()
    month_str = partition_date.strftime("%Y-%m")
    
    with Session(engine) as session:
        # Check if snapshot already exists
        existing = session.execute(
            text("SELECT id FROM monthly_snapshots WHERE month = :month"),
            {"month": month_str},
        ).scalar()
        
        if existing:
            context.log.info(f"Monthly snapshot for {month_str} already exists")
            return
        
        # Aggregate monthly data
        result = session.execute(
            text("""
                SELECT 
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN successful = 1 THEN 1 ELSE 0 END) as successful_tasks,
                    SUM(CASE WHEN successful = 0 THEN 1 ELSE 0 END) as failed_tasks,
                    SUM(total_cost_usd) as total_cost,
                    SUM(revenue_lift_usd) as total_revenue,
                    SUM(prompt_tokens + completion_tokens) as total_tokens
                FROM usage_events
                WHERE strftime('%Y-%m', recorded_at) = :month
            """),
            {"month": month_str},
        ).fetchone()
        
        if result and result.total_tasks > 0:
            successful_tasks = result.successful_tasks or 0
            total_cost = result.total_cost or 0
            total_revenue = result.total_revenue or 0
            
            cost_per_task = total_cost / successful_tasks if successful_tasks > 0 else 0
            roi = (total_revenue - total_cost) / total_cost if total_cost > 0 else 0
            token_volume_millions = (result.total_tokens or 0) / 1_000_000
            
            session.execute(
                text("""
                    INSERT INTO monthly_snapshots 
                    (month, total_spend_usd, total_revenue_lift_usd, 
                     successful_tasks, failed_tasks, cost_per_successful_task_usd,
                     portfolio_roi, token_volume_millions)
                    VALUES (:month, :spend, :revenue, :successful, :failed, 
                            :cost_per_task, :roi, :tokens)
                """),
                {
                    "month": month_str,
                    "spend": total_cost,
                    "revenue": total_revenue,
                    "successful": successful_tasks,
                    "failed": result.failed_tasks or 0,
                    "cost_per_task": cost_per_task,
                    "roi": roi,
                    "tokens": token_volume_millions,
                },
            )
            session.commit()
            
            context.log.info(
                f"Created monthly snapshot for {month_str}: "
                f"${total_cost:.2f} spend, {roi:.1%} ROI"
            )


@asset(
    deps=[monthly_snapshots_asset],
    group_name="forecast",
)
def forecast(context: OpExecutionContext) -> dict:
    """Generate 6-month spend forecast using exponential smoothing."""
    with Session(engine) as session:
        snapshots = session.execute(
            text("""
                SELECT month, total_spend_usd 
                FROM monthly_snapshots 
                ORDER BY month DESC 
                LIMIT 12
            """),
        ).fetchall()
        
        if not snapshots or len(snapshots) < 3:
            context.log.warning("Insufficient data for forecast")
            return {"forecast": [], "method": "insufficient_data"}
        
        # Simple exponential smoothing
        alpha = 0.3
        spends = [s.total_spend_usd for s in reversed(snapshots)]
        
        smoothed = spends[0]
        for spend in spends[1:]:
            smoothed = alpha * spend + (1 - alpha) * smoothed
        
        # Project 6 months forward
        forecast_months = []
        base_date = datetime.now()
        
        for i in range(1, 7):
            forecast_date = base_date + timedelta(days=30 * i)
            forecast_months.append({
                "month": forecast_date.strftime("%Y-%m"),
                "predicted_spend": round(smoothed, 2),
                "lower_bound": round(smoothed * 0.8, 2),
                "upper_bound": round(smoothed * 1.2, 2),
            })
        
        context.log.info(f"Forecast: ${smoothed:.2f}/month for next 6 months")
        
        return {
            "forecast": forecast_months,
            "method": "exponential_smoothing",
            "alpha": alpha,
            "last_actual": spends[-1],
        }


@asset(
    deps=[calculated_costs_asset],
    group_name="analytics",
)
def token_volume_trends(context: OpExecutionContext) -> dict:
    """Analyze token usage trends by model and workflow."""
    with Session(engine) as session:
        trends = session.execute(
            text("""
                SELECT 
                    model,
                    workflow_id,
                    COUNT(*) as event_count,
                    SUM(prompt_tokens + completion_tokens) as total_tokens,
                    SUM(total_cost_usd) as total_cost
                FROM usage_events
                WHERE recorded_at >= date('now', '-30 days')
                GROUP BY model, workflow_id
                ORDER BY total_cost DESC
            """),
        ).fetchall()
        
        context.log.info(f"Token volume trends: {len(trends)} model/workflow combinations")
        
        return {
            "trends": [
                {
                    "model": t.model,
                    "workflow_id": t.workflow_id,
                    "events": t.event_count,
                    "tokens": t.total_tokens,
                    "cost": round(t.total_cost, 2),
                }
                for t in trends
            ]
        }


@asset(
    deps=[monthly_snapshots_asset, forecast_asset],
    group_name="dashboard",
)
def dashboard_kpis(context: OpExecutionContext) -> dict:
    """Generate executive KPIs for the dashboard."""
    with Session(engine) as session:
        # Current month metrics
        current_month = session.execute(
            text("""
                SELECT 
                    total_spend_usd,
                    total_revenue_lift_usd,
                    portfolio_roi,
                    cost_per_successful_task_usd,
                    successful_tasks
                FROM monthly_snapshots
                ORDER BY month DESC
                LIMIT 1
            """),
        ).fetchone()
        
        # Enterprise config for EPS calculation
        config = session.execute(
            text("""
                SELECT 
                    shares_outstanding_millions,
                    earnings_per_share,
                    annual_tech_investment_billions
                FROM enterprise_config
                LIMIT 1
            """),
        ).fetchone()
        
        kpis = {}
        
        if current_month:
            kpis.update({
                "monthly_spend": round(current_month.total_spend_usd, 2),
                "monthly_revenue": round(current_month.total_revenue_lift_usd, 2),
                "monthly_roi": round(current_month.portfolio_roi, 4),
                "cost_per_task": round(current_month.cost_per_successful_task_usd, 4),
                "tasks_completed": current_month.successful_tasks,
            })
        
        if config:
            # EPS impact: AI spend as % of tech investment
            ai_spend = kpis.get("monthly_spend", 0) * 12
            tech_investment = config.annual_tech_investment_billions * 1_000_000_000
            ai_pct = ai_spend / tech_investment if tech_investment > 0 else 0
            
            kpis.update({
                "shares_outstanding_millions": config.shares_outstanding_millions,
                "eps": config.earnings_per_share,
                "ai_spend_pct_of_tech": round(ai_pct, 4),
                "annualized_spend": round(ai_spend, 2),
            })
        
        context.log.info(f"Dashboard KPIs: ${kpis.get('monthly_spend', 0):.2f} monthly spend")
        
        return kpis


# ---------------------------------------------------------------------------
# Schedules
# ---------------------------------------------------------------------------

daily_cost_schedule = ScheduleDefinition(
    job=raw_usage_events,
    cron_schedule="0 0 * * *",  # Daily at midnight UTC
)

daily_calculate_schedule = ScheduleDefinition(
    job=calculated_costs,
    cron_schedule="5 0 * * *",  # Daily at 00:05 UTC
)

weekly_forecast_schedule = ScheduleDefinition(
    job=forecast,
    cron_schedule="0 0 * * 1",  # Weekly on Monday at midnight UTC
)

monthly_snapshot_schedule = ScheduleDefinition(
    job=monthly_snapshots,
    cron_schedule="0 0 1 * *",  # Monthly on 1st at midnight UTC
)


# ---------------------------------------------------------------------------
# Definitions
# ---------------------------------------------------------------------------

defs = Definitions(
    assets=[
        raw_usage_events,
        calculated_costs,
        daily_aggregates,
        monthly_snapshots,
        forecast,
        token_volume_trends,
        dashboard_kpis,
    ],
    source_assets=[
        workflows_asset,
        usage_events_asset,
        enterprise_config_asset,
    ],
    schedules=[
        daily_cost_schedule,
        daily_calculate_schedule,
        weekly_forecast_schedule,
        monthly_snapshot_schedule,
    ],
)
