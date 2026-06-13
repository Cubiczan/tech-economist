import { NextResponse } from 'next/server';

const MODEL_COSTS: Record<string, { input_per_1m: number; output_per_1m: number }> = {
  'gpt-4o': { input_per_1m: 2.5, output_per_1m: 10.0 },
  'gpt-4o-mini': { input_per_1m: 0.15, output_per_1m: 0.6 },
  'claude-3-5-sonnet-20241022': { input_per_1m: 3.0, output_per_1m: 15.0 },
  'o1-mini': { input_per_1m: 1.1, output_per_1m: 4.4 },
};

const BACKEND = process.env.TECH_ECONOMIST_API || 'http://localhost:8000/api';

interface WorkflowEcon {
  workflow_name: string;
  model: string;
  roi_multiple: number;
  status: string;
  annual_runs: number;
  avg_prompt_tokens: number;
  avg_completion_tokens: number;
  monthly_spend_usd?: number;
}

function costPerTask(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const costs = MODEL_COSTS[model];
  if (!costs) return 0;
  return (promptTokens / 1_000_000) * costs.input_per_1m + (completionTokens / 1_000_000) * costs.output_per_1m;
}

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/workflows/economics`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 502 });
    }
    const workflows: WorkflowEcon[] = await res.json();

    const recommendations = workflows
      .filter((w) => w.roi_multiple < 1.0 || w.status === 'underwater')
      .map((w) => {
        // Find the cheapest model that isn't the current one
        const alternatives = Object.entries(MODEL_COSTS)
          .filter(([name]) => name !== w.model)
          .map(([name, costs]) => ({
            name,
            costPerTask: costPerTask(name, w.avg_prompt_tokens, w.avg_completion_tokens),
          }))
          .sort((a, b) => a.costPerTask - b.costPerTask);

        const recommended = alternatives[0];
        const currentCost = costPerTask(w.model, w.avg_prompt_tokens, w.avg_completion_tokens);
        const savingsPerTask = currentCost - recommended.costPerTask;
        const estimatedAnnualSavings = Math.max(0, savingsPerTask * w.annual_runs);

        return {
          workflow_name: w.workflow_name,
          current_model: w.model,
          recommended_model: recommended.name,
          estimated_annual_savings_usd: Math.round(estimatedAnnualSavings * 100) / 100,
          current_cost_per_task: Math.round(currentCost * 1_000_000) / 1_000_000,
          recommended_cost_per_task: Math.round(recommended.costPerTask * 1_000_000) / 1_000_000,
          roi_multiple: w.roi_multiple,
          status: w.status,
        };
      });

    return NextResponse.json(recommendations);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Model routing unavailable' },
      { status: 502 }
    );
  }
}