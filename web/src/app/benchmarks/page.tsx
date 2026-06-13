'use client';

import { api } from '@/lib/api';
import { usePolling } from '@/hooks/use-polling';
import type { BenchmarksResponse } from '@/lib/types';

function TrendIcon({ trend }: { trend: string }) {
  const color = trend === 'up' ? 'var(--te-green)' : trend === 'down' ? 'var(--te-red)' : 'var(--te-amber)';
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  return <span style={{ color }}>{arrow}</span>;
}

function ImpactBadge({ impact }: { impact: string }) {
  const colors: Record<string, string> = {
    high: 'var(--te-red)',
    medium: 'var(--te-amber)',
    low: 'var(--te-green)',
  };
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: `${colors[impact] ?? 'var(--te-muted)'}22`, color: colors[impact] ?? 'var(--te-muted)' }}>
      {impact}
    </span>
  );
}

export default function BenchmarksPage() {
  const benchmarks = usePolling<BenchmarksResponse>(() => api.benchmarks());

  if (benchmarks.loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse" style={{ color: 'var(--te-muted)' }}>Loading benchmarks…</div>
      </div>
    );
  }

  if (benchmarks.error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center" style={{ color: 'var(--te-muted)' }}>
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--te-text)' }}>Unable to load benchmarks</p>
          <p className="text-sm">Connect the FastAPI backend to port 8000.</p>
        </div>
      </div>
    );
  }

  const data = benchmarks.data;
  if (!data) return null;

  return (
    <div className="p-4 md:p-6 space-y-8 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--te-text)' }}>Benchmarks</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--te-muted)' }}>
          Market signals, industry benchmarks, and FinOps best practices
        </p>
      </div>

      {/* Market Signals */}
      {data.market_signals && data.market_signals.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--te-muted)' }}>Market Signals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.market_signals.map((sig, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--te-muted)' }}>{sig.metric}</span>
                  <TrendIcon trend={sig.trend} />
                </div>
                <div className="text-lg font-bold" style={{ color: 'var(--te-text)' }}>{sig.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--te-muted)' }}>{sig.description}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Benchmark Table */}
      {data.benchmarks && data.benchmarks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--te-muted)' }}>Industry Benchmarks</h2>
          <div className="overflow-x-auto rounded-xl" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--te-border)' }}>
                  {['Category', 'Metric', 'P25', 'P50', 'P75', 'P90', 'You'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--te-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.benchmarks.map((b, i) => (
                  <tr key={i} className="hover:opacity-90 transition-opacity" style={{ borderBottom: '1px solid var(--te-border)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--te-muted)' }}>{b.category}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--te-text)' }}>{b.metric}</td>
                    <td className="px-4 py-3">{b.p25}</td>
                    <td className="px-4 py-3">{b.p50}</td>
                    <td className="px-4 py-3">{b.p75}</td>
                    <td className="px-4 py-3">{b.p90}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: b.your_value !== undefined ? 'var(--te-accent)' : 'var(--te-muted)' }}>
                      {b.your_value !== undefined ? b.your_value : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* FinOps Principles */}
      {data.finops_principles && data.finops_principles.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--te-muted)' }}>FinOps Principles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.finops_principles.map((p, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm" style={{ color: 'var(--te-text)' }}>{p.title}</h3>
                  <ImpactBadge impact={p.impact} />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--te-muted)' }}>{p.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}