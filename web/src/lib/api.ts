const API_BASE = '/api/proxy';

async function proxyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  dashboard: () => proxyFetch<import('./types').DashboardSummary>('dashboard'),
  workflowEconomics: () => proxyFetch<import('./types').WorkflowEconomics[]>('workflows/economics'),
  trends: () => proxyFetch<import('./types').MonthlyTrend[]>('trends'),
  forecast: () => proxyFetch<import('./types').ForecastPoint[]>('forecast'),
  benchmarks: () => proxyFetch<import('./types').BenchmarksResponse>('benchmarks'),
  config: () => proxyFetch<import('./types').EnterpriseConfig>('config'),
  roiScenario: (body: Record<string, unknown>) =>
    proxyFetch<import('./types').RoiScenarioResponse>('roi-scenario', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  modelRouting: () => proxyFetch<import('./types').ModelRoutingRecommendation[]>('../model-routing'),
  advisor: (question: string, context: Record<string, unknown>) =>
    proxyFetch<{ response: string }>('../advisor', {
      method: 'POST',
      body: JSON.stringify({ question, context }),
    }),
};