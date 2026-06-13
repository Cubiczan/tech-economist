import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

const BACKEND = process.env.TECH_ECONOMIST_API || 'http://localhost:8000/api';

const SYSTEM_PROMPT = `You are the AI Token Economics Advisor for a CFO office. You analyze AI/ML workflow spend, ROI multiples, token economics, and provide strategic recommendations.

Your audience is a CFO or finance leader who needs clear, actionable, financially-grounded advice about AI token spend. Always:
- Reference specific dollar amounts and ROI multiples when available
- Frame recommendations in terms of shareholder value, EPS impact, and budget efficiency
- Be concise but thorough
- Use financial terminology appropriately
- Highlight risks and opportunities with specific numbers
- When suggesting optimizations, estimate the dollar impact`;

export async function POST(req: NextRequest) {
  try {
    const { question, context } = await req.json();

    // Fetch dashboard context from backend for richer answers
    let dashboardContext: Record<string, unknown> = {};
    try {
      const dashRes = await fetch(`${BACKEND}/dashboard`, { cache: 'no-store' });
      if (dashRes.ok) dashboardContext = await dashRes.json();
    } catch {
      // continue without dashboard context
    }

    const userMessage = `Context data:\n${JSON.stringify({ ...dashboardContext, ...context }, null, 2)}\n\nQuestion: ${question}`;

    const zai = new ZAI();
    const completion = await zai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 1024,
    });

    const response = completion.choices?.[0]?.message?.content ?? 'No response generated.';

    return NextResponse.json({ response });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Advisor unavailable' },
      { status: 502 }
    );
  }
}