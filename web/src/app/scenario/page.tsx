'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { RoiScenarioResponse } from '@/lib/types';

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const MODEL_OPTIONS = ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022', 'o1-mini'];

const FIELDS: { key: string; label: string; type: string; placeholder: string; step?: string }[] = [
  { key: 'workflow_name', label: 'Workflow Name', type: 'text', placeholder: 'e.g. Customer Support Bot' },
  { key: 'annual_runs', label: 'Annual Runs', type: 'number', placeholder: '100000', step: '1' },
  { key: 'success_rate', label: 'Success Rate (%)', type: 'number', placeholder: '92', step: '0.1' },
  { key: 'avg_revenue_lift_usd', label: 'Avg Revenue Lift ($)', type: 'number', placeholder: '12.50', step: '0.01' },
  { key: 'avg_hours_saved', label: 'Avg Hours Saved', type: 'number', placeholder: '0.25', step: '0.01' },
  { key: 'hourly_cost_usd', label: 'Hourly Cost ($)', type: 'number', placeholder: '45.00', step: '0.01' },
  { key: 'avg_prompt_tokens', label: 'Avg Prompt Tokens', type: 'number', placeholder: '1500', step: '1' },
  { key: 'avg_completion_tokens', label: 'Avg Completion Tokens', type: 'number', placeholder: '500', step: '1' },
  { key: 'manual_baseline_cost_usd', label: 'Manual Baseline Cost ($)', type: 'number', placeholder: '8.00', step: '0.01' },
];

export default function ScenarioPage() {
  const [form, setForm] = useState<Record<string, string>>({
    model: MODEL_OPTIONS[0],
  });
  const [result, setResult] = useState<RoiScenarioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, unknown> = { ...form };
      // Convert numeric fields
      for (const f of FIELDS) {
        if (f.type === 'number' && body[f.key] !== '') {
          body[f.key] = parseFloat(body[f.key] as string);
        }
      }
      body.success_rate = ((body.success_rate as number) ?? 0) / 100;

      const res = await api.roiScenario(body);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--te-text)' }}>ROI Scenario Calculator</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--te-muted)' }}>
          Model the financial impact of an AI workflow
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-xl p-5 space-y-4" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--te-muted)' }}>{f.label}</label>
              <input
                type={f.type}
                step={f.step}
                placeholder={f.placeholder}
                value={form[f.key] ?? ''}
                onChange={(e) => updateField(f.key, e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  background: 'var(--te-surface-2)',
                  border: '1px solid var(--te-border)',
                  color: 'var(--te-text)',
                  '--tw-ring-color': 'var(--te-accent)',
                } as React.CSSProperties}
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--te-muted)' }}>Model</label>
            <select
              value={form.model ?? MODEL_OPTIONS[0]}
              onChange={(e) => updateField('model', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--te-surface-2)', border: '1px solid var(--te-border)', color: 'var(--te-text)' }}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--te-accent)', color: '#fff' }}
          >
            {loading ? 'Calculating…' : 'Calculate ROI'}
          </button>

          {error && (
            <p className="text-xs" style={{ color: 'var(--te-red)' }}>{error}</p>
          )}
        </form>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              <div className="rounded-xl p-5" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
                <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--te-muted)' }}>Results for {result.workflow_name}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <ResultCard label="Annual Spend" value={fmtUsd(result.annual_spend_usd)} />
                  <ResultCard label="Annual Value" value={fmtUsd(result.annual_value_usd)} accent />
                  <ResultCard label="ROI Multiple" value={`${result.roi_multiple.toFixed(1)}×`} accent />
                  <ResultCard label="Breakeven" value={`${result.breakeven_months.toFixed(1)} months`} />
                  <ResultCard label="Net Annual Value" value={fmtUsd(result.net_annual_value_usd)} accent />
                  <ResultCard label="Monthly Cost" value={fmtUsd(result.monthly_cost_usd)} />
                  <ResultCard label="Cost vs Manual" value={`${result.cost_vs_manual_pct.toFixed(0)}%`} />
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl p-12 flex items-center justify-center text-center" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
              <div>
                <div className="text-4xl mb-3">📊</div>
                <p className="text-sm" style={{ color: 'var(--te-muted)' }}>Fill in the form and click Calculate to see projected ROI.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--te-muted)' }}>{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: accent ? 'var(--te-green)' : 'var(--te-text)' }}>
        {value}
      </div>
    </div>
  );
}