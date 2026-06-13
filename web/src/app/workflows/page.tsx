'use client';

import { api } from '@/lib/api';
import { usePolling } from '@/hooks/use-polling';
import type { WorkflowEconomics, ModelRoutingRecommendation } from '@/lib/types';

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    profitable: { bg: 'var(--te-green-dim)', text: 'var(--te-green)' },
    break_even: { bg: 'rgba(251,191,36,0.15)', text: 'var(--te-amber)' },
    underwater: { bg: 'var(--te-red-dim)', text: 'var(--te-red)' },
  };
  const c = colors[status] ?? { bg: 'var(--te-surface-2)', text: 'var(--te-muted)' };
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: c.bg, color: c.text }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function RoutingBadge({ rec }: { rec?: ModelRoutingRecommendation }) {
  if (!rec) return <span style={{ color: 'var(--te-muted)' }}>—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--te-accent-dim)', color: '#fff' }}>
        → {rec.recommended_model}
      </span>
      <span className="text-xs" style={{ color: 'var(--te-green)' }}>
        save {fmtUsd(rec.estimated_annual_savings_usd)}/yr
      </span>
    </div>
  );
}

export default function WorkflowsPage() {
  const workflows = usePolling<WorkflowEconomics[]>(() => api.workflowEconomics());
  const routing = usePolling<ModelRoutingRecommendation[]>(() => api.modelRouting());

  const routingMap = new Map<string, ModelRoutingRecommendation>();
  if (routing.data) {
    for (const r of routing.data) routingMap.set(r.workflow_name, r);
  }

  if (workflows.loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse" style={{ color: 'var(--te-muted)' }}>Loading workflows…</div>
      </div>
    );
  }

  if (workflows.error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center" style={{ color: 'var(--te-muted)' }}>
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--te-text)' }}>Unable to load workflows</p>
          <p className="text-sm">Connect the FastAPI backend to port 8000.</p>
        </div>
      </div>
    );
  }

  const rows = workflows.data ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--te-text)' }}>Workflow Economics</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--te-muted)' }}>
          Detailed ROI analysis per AI workflow {routing.data && routing.data.length > 0 && `· ${routing.data.length} model routing recommendations`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--te-border)' }}>
              {['Workflow', 'Category', 'Spend', 'Value Lift', 'Cost/Task', 'ROI', 'vs Benchmark', 'Status', 'Model Routing'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--te-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="hover:opacity-90 transition-opacity" style={{ borderBottom: '1px solid var(--te-border)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--te-text)' }}>{w.workflow_name}</td>
                <td className="px-4 py-3" style={{ color: 'var(--te-muted)' }}>{w.category}</td>
                <td className="px-4 py-3">{fmtUsd(w.monthly_spend_usd)}</td>
                <td className="px-4 py-3" style={{ color: w.monthly_value_lift_usd >= 0 ? 'var(--te-green)' : 'var(--te-red)' }}>
                  {fmtUsd(w.monthly_value_lift_usd)}
                </td>
                <td className="px-4 py-3">{fmtUsd(w.cost_per_task_usd)}</td>
                <td className="px-4 py-3 font-medium" style={{ color: w.roi_multiple >= 1 ? 'var(--te-green)' : 'var(--te-red)' }}>
                  {w.roi_multiple.toFixed(1)}×
                </td>
                <td className="px-4 py-3" style={{ color: w.vs_benchmark_pct >= 0 ? 'var(--te-green)' : 'var(--te-red)' }}>
                  {w.vs_benchmark_pct >= 0 ? '+' : ''}{w.vs_benchmark_pct.toFixed(0)}%
                </td>
                <td className="px-4 py-3"><StatusPill status={w.status} /></td>
                <td className="px-4 py-3"><RoutingBadge rec={routingMap.get(w.workflow_name)} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center" style={{ color: 'var(--te-muted)' }}>
                  No workflows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}