/* ── Enterprise Dashboard ── */

export interface DashboardSummary {
  mtd_spend_usd: number;
  portfolio_roi_multiple: number;
  net_value_mtd_usd: number;
  ai_budget_utilization_pct: number;
  eps_at_risk_pct: number;
  eps_if_no_value_usd: number;
  mtd_eps_impact_usd: number;
  delta_spend?: number;
  delta_roi?: number;
  delta_value?: number;
  delta_budget?: number;
}

export interface EnterpriseConfig {
  company_name: string;
  annual_ai_budget_usd: number;
  industry: string;
  fiscal_year_end: string;
}

/* ── Workflow Economics ── */

export interface WorkflowEconomics {
  id: string;
  workflow_name: string;
  category: string;
  monthly_spend_usd: number;
  monthly_value_lift_usd: number;
  cost_per_task_usd: number;
  roi_multiple: number;
  vs_benchmark_pct: number;
  status: 'profitable' | 'break_even' | 'underwater';
  model: string;
  annual_runs: number;
  success_rate: number;
  avg_prompt_tokens: number;
  avg_completion_tokens: number;
}

/* ── Trends & Forecast ── */

export interface MonthlyTrend {
  month: string;
  spend_usd: number;
  value_lift_usd: number;
  roi_multiple: number;
}

export interface ForecastPoint {
  month: string;
  forecast_usd: number;
  low_usd: number;
  high_usd: number;
}

/* ── Benchmarks ── */

export interface MarketSignal {
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

export interface Benchmark {
  category: string;
  metric: string;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  your_value?: number;
}

export interface FinOpsPrinciple {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface BenchmarksResponse {
  market_signals: MarketSignal[];
  benchmarks: Benchmark[];
  finops_principles: FinOpsPrinciple[];
}

/* ── ROI Scenario ── */

export interface RoiScenarioResponse {
  workflow_name: string;
  annual_spend_usd: number;
  annual_value_usd: number;
  roi_multiple: number;
  breakeven_months: number;
  net_annual_value_usd: number;
  monthly_cost_usd: number;
  cost_vs_manual_pct: number;
}

/* ── Model Routing ── */

export interface ModelRoutingRecommendation {
  workflow_name: string;
  current_model: string;
  recommended_model: string;
  estimated_annual_savings_usd: number;
  current_cost_per_task: number;
  recommended_cost_per_task: number;
  roi_multiple: number;
  status: string;
}