// Registro de cada llamada HTTP que hace el servidor (request y response completos) para mostrar
// el paso a paso en la página Consulta. Solo para demostración: incluye secretos y tokens.
export type TraceEntry = {
  title: string;
  description: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body?: Record<string, string>; // application/x-www-form-urlencoded
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string; // texto exacto recibido, sin modificar
    bodyBytes: number; // bytes recibidos (para contrastar con content-length)
  };
  error?: string;
  durationMs: number;
};

export type Trace = TraceEntry[];

export async function tracedFetch(
  trace: Trace | undefined,
  info: { title: string; description: string },
  url: string,
  init: { method: string; headers: Record<string, string>; form?: Record<string, string> },
): Promise<Response> {
  const started = performance.now();
  const u = new URL(url);
  const entry: TraceEntry = {
    ...info,
    request: {
      method: init.method,
      url,
      headers: init.headers,
      query: Object.fromEntries(u.searchParams),
      body: init.form,
    },
    durationMs: 0,
  };
  trace?.push(entry);
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.form ? new URLSearchParams(init.form) : undefined,
      cache: 'no-store',
    });
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    const headers: Record<string, string> = Object.fromEntries(res.headers);
    const cookies = res.headers.getSetCookie(); // varios Set-Cookie no se combinan en uno
    if (cookies.length) headers['set-cookie'] = cookies.join('\n');
    entry.response = {
      status: res.status,
      statusText: res.statusText,
      headers,
      body: new TextDecoder().decode(bytes),
      bodyBytes: bytes.byteLength,
    };
    return res;
  } catch (err) {
    entry.error = (err as Error).message;
    throw err;
  } finally {
    entry.durationMs = Math.round(performance.now() - started);
  }
}
