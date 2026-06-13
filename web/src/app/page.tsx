'use client';

import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';
import { usePolling } from '@/hooks/use-polling';
import type { DashboardSummary, MonthlyTrend, ForecastPoint, EnterpriseConfig } from '@/lib/types';

/* ── Formatters ── */

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtRoi(n: number): string {
  return `${n.toFixed(1)}×`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function deltaColor(d?: number): string {
  if (d === undefined) return 'var(--te-muted)';
  return d >= 0 ? 'var(--te-green)' : 'var(--te-red)';
}

function DeltaBadge({ value, prefix = '' }: { value?: number; prefix?: string }) {
  if (value === undefined) return null;
  const positive = value >= 0;
  return (
    <span className="text-xs ml-2" style={{ color: positive ? 'var(--te-green)' : 'var(--te-red)' }}>
      {positive ? '↑' : '↓'} {prefix}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

/* ── Chart card wrapper ── */

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
      <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--te-muted)' }}>{title}</h3>
      {children}
    </div>
  );
}

/* ── KPI card ── */

function KpiCard({ label, value, delta, prefix = '' }: { label: string; value: string; delta?: number; prefix?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
      <div className="text-xs font-medium mb-1" style={{ color: 'var(--te-muted)' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: 'var(--te-text)' }}>
        {value}
        <DeltaBadge value={delta} prefix={prefix} />
      </div>
    </div>
  );
}

/* ── Error state ── */

function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-4">
        <div className="text-5xl">🔌</div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--te-text)' }}>Backend Not Connected</h2>
        <p className="text-sm" style={{ color: 'var(--te-muted)' }}>
          Connect the FastAPI backend to port 8000 to see live data.
        </p>
        <div className="text-xs text-left rounded-lg p-4 space-y-1" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)', color: 'var(--te-muted)' }}>
          <p>1. Start the FastAPI backend:</p>
          <code className="block px-2 py-1 rounded text-xs" style={{ background: 'var(--te-surface-2)', color: 'var(--te-accent)' }}>
            uvicorn main:app --port 8000
          </code>
          <p className="mt-2">2. Or set the environment variable:</p>
          <code className="block px-2 py-1 rounded text-xs" style={{ background: 'var(--te-surface-2)', color: 'var(--te-accent)' }}>
            TECH_ECONOMIST_API=http://your-backend:8000/api
          </code>
        </div>
        {message && (
          <p className="text-xs" style={{ color: 'var(--te-red)' }}>Error: {message}</p>
        )}
      </div>
    </div>
  );
}

/* ── Main page ── */

export default function OverviewPage() {
  const dashboard = usePolling<DashboardSummary>(() => api.dashboard());
  const trends = usePolling<MonthlyTrend[]>(() => api.trends());
  const forecast = usePolling<ForecastPoint[]>(() => api.forecast());
  const config = usePolling<EnterpriseConfig>(() => api.config());

  const hasError = dashboard.error || trends.error || forecast.error || config.error;
  const isLoading = dashboard.loading || trends.loading || forecast.loading || config.loading;
  const d = dashboard.data;
  const t = trends.data;
  const f = forecast.data;
  const c = config.data;

  if (hasError && !d) {
    return <ErrorState message={dashboard.error || undefined} />;
  }

  if (isLoading && !d) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-lg" style={{ color: 'var(--te-muted)' }}>Loading dashboard…</div>
      </div>
    );
  }

  const lastUpdated = [dashboard.lastUpdated, trends.lastUpdated, forecast.lastUpdated, config.lastUpdated]
    .filter(Boolean)
    .sort((a, b) => b!.getTime() - a!.getTime())[0];

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--te-text)' }}>Tech Economist</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--te-muted)' }}>
          AI token economics dashboard {c ? `— ${c.company_name}` : ''}
        </p>
      </div>

      {/* KPI Cards */}
      {d && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="MTD Spend"
            value={fmtUsd(d.mtd_spend_usd)}
            delta={d.delta_spend}
          />
          <KpiCard
            label="Portfolio ROI"
            value={fmtRoi(d.portfolio_roi_multiple)}
            delta={d.delta_roi}
            prefix="+"
          />
          <KpiCard
            label="Net Value MTD"
            value={fmtUsd(d.net_value_mtd_usd)}
            delta={d.delta_value}
          />
          <KpiCard
            label="AI Budget Util."
            value={fmtPct(d.ai_budget_utilization_pct)}
            delta={d.delta_budget}
          />
        </div>
      )}

      {/* Shareholder Value Lens */}
      {d && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-4" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--te-muted)' }}>EPS at Risk</div>
            <div className="text-xl font-bold" style={{ color: 'var(--te-red)' }}>{fmtPct(d.eps_at_risk_pct)}</div>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--te-muted)' }}>EPS if No AI Value</div>
            <div className="text-xl font-bold" style={{ color: 'var(--te-amber)' }}>{fmtUsd(d.eps_if_no_value_usd)}</div>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--te-muted)' }}>MTD EPS Impact</div>
            <div className="text-xl font-bold" style={{ color: deltaColor(d.mtd_eps_impact_usd) }}>
              {d.mtd_eps_impact_usd >= 0 ? '+' : ''}{fmtUsd(d.mtd_eps_impact_usd)}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spend vs Value Lift */}
        <ChartCard title="Spend vs Value Lift (MTD)">
          {t && t.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={t}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--te-border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--te-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--te-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtUsd} />
                <Tooltip
                  contentStyle={{ background: 'var(--te-surface-2)', border: '1px solid var(--te-border)', borderRadius: 8, color: 'var(--te-text)' }}
                  formatter={(v: number) => fmtUsd(v)}
                />
                <Area type="monotone" dataKey="spend_usd" name="Spend" stroke="#3d8bfd" fill="#3d8bfd" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="value_lift_usd" name="Value Lift" stroke="#34d399" fill="#34d399" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-sm" style={{ color: 'var(--te-muted)' }}>No trend data</div>
          )}
        </ChartCard>

        {/* Portfolio ROI Trend */}
        <ChartCard title="Portfolio ROI Trend">
          {t && t.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={t}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--te-border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--te-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--te-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtRoi} />
                <Tooltip
                  contentStyle={{ background: 'var(--te-surface-2)', border: '1px solid var(--te-border)', borderRadius: 8, color: 'var(--te-text)' }}
                  formatter={(v: number) => fmtRoi(v)}
                />
                <Line type="monotone" dataKey="roi_multiple" name="ROI" stroke="#34d399" strokeWidth={2} dot={{ r: 3, fill: '#34d399' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-sm" style={{ color: 'var(--te-muted)' }}>No trend data</div>
          )}
        </ChartCard>
      </div>

      {/* Spend Forecast */}
      <ChartCard title="Spend Forecast (with confidence band)">
        {f && f.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={f}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--te-border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--te-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--te-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtUsd} />
              <Tooltip
                contentStyle={{ background: 'var(--te-surface-2)', border: '1px solid var(--te-border)', borderRadius: 8, color: 'var(--te-text)' }}
                formatter={(v: number) => fmtUsd(v)}
              />
              <Area type="monotone" dataKey="high_usd" name="Upper Bound" stroke="transparent" fill="var(--te-accent)" fillOpacity={0.08} />
              <Area type="monotone" dataKey="low_usd" name="Lower Bound" stroke="transparent" fill="var(--te-bg)" fillOpacity={0.9} />
              <Area type="monotone" dataKey="forecast_usd" name="Forecast" stroke="#3d8bfd" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-60 flex items-center justify-center text-sm" style={{ color: 'var(--te-muted)' }}>No forecast data</div>
        )}
      </ChartCard>

      {/* Last updated */}
      {lastUpdated && (
        <div className="text-xs text-right" style={{ color: 'var(--te-muted)' }}>
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}