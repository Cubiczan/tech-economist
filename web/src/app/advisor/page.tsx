'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  'Which workflows are underwater and what should we do?',
  'How can we optimize our AI spend by 20%?',
  'What is the EPS impact if we double our AI budget?',
  'Which model should we use for cost-sensitive workflows?',
  'Summarize our portfolio ROI trend this quarter',
];

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load dashboard context
  const [context, setContext] = useState<Record<string, unknown>>({});

  useEffect(() => {
    async function loadContext() {
      try {
        const [dash, workflows, config] = await Promise.allSettled([
          api.dashboard(),
          api.workflowEconomics(),
          api.config(),
        ]);
        const ctx: Record<string, unknown> = {};
        if (dash.status === 'fulfilled') ctx.dashboard = dash.value;
        if (workflows.status === 'fulfilled') ctx.workflows = workflows.value;
        if (config.status === 'fulfilled') ctx.config = config.value;
        setContext(ctx);
      } catch {
        // proceed without context
      }
    }
    loadContext();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(question: string) {
    if (!question.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: question.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.advisor(question.trim(), context);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend(input);
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b" style={{ borderColor: 'var(--te-border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--te-text)' }}>AI Token Economics Advisor</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--te-muted)' }}>
          Ask questions about your AI spend, ROI, and optimization strategies
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            <div className="text-5xl">✨</div>
            <div>
              <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--te-text)' }}>Ask your CFO advisor</h2>
              <p className="text-sm max-w-md" style={{ color: 'var(--te-muted)' }}>
                Get AI-powered financial insights about your token economics, workflow ROI, and optimization opportunities.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-xl">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="text-xs px-3 py-1.5 rounded-full transition-colors hover:opacity-80"
                  style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)', color: 'var(--te-accent)' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="flex justify-start">
            <div
              className="max-w-2xl rounded-xl px-4 py-3 text-sm leading-relaxed"
              style={{
                background: msg.role === 'user' ? 'var(--te-accent-dim)' : 'var(--te-surface)',
                border: `1px solid ${msg.role === 'user' ? 'transparent' : 'var(--te-border)'}`,
                color: 'var(--te-text)',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--te-surface)', border: '1px solid var(--te-border)' }}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--te-accent)', animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--te-accent)', animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--te-accent)', animationDelay: '300ms' }} />
                </div>
                <span className="text-xs" style={{ color: 'var(--te-muted)' }}>Thinking…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 md:px-6 py-4 border-t" style={{ borderColor: 'var(--te-border)', background: 'var(--te-surface)' }}>
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your AI token economics…"
            disabled={loading}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 disabled:opacity-50"
            style={{
              background: 'var(--te-surface-2)',
              border: '1px solid var(--te-border)',
              color: 'var(--te-text)',
              '--tw-ring-color': 'var(--te-accent)',
            } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--te-accent)', color: '#fff' }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}