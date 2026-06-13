import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.TECH_ECONOMIST_API || 'http://localhost:8000/api';

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const backendPath = path.join('/');
  const url = `${BACKEND}/${backendPath}`;

  try {
    const headers: Record<string, string> = {};
    if (req.headers.get('content-type')) headers['content-type'] = req.headers.get('content-type')!;

    const init: RequestInit = { headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await req.text();
    }

    const res = await fetch(url, { ...init, method: req.method, cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Backend unavailable' },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;