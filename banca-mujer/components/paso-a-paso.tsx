// Muestra cada llamada HTTP registrada: request (método, URL, headers, query, body) y response
// (status, headers, body), con los JWT decodificados y el comando curl equivalente
import type { Trace, TraceEntry } from '@/lib/trace';

const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function decodeJwt(token: string) {
  try {
    const part = (i: number) => {
      const b64 = token.split('.')[i].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
    };
    return { header: part(0), payload: part(1) };
  } catch {
    return undefined;
  }
}

const bearer = (v: string) => v.replace(/^Bearer /, '');

function Value({ value }: { value: string }) {
  const token = bearer(value);
  const decoded = JWT.test(token) ? decodeJwt(token) : undefined;
  return (
    <>
      <span className="mono wrap">{value}</span>
      {decoded && <JwtDetails decoded={decoded} />}
    </>
  );
}

function JwtDetails({ decoded }: { decoded: { header: unknown; payload: unknown } }) {
  return (
    <details className="jwt">
      <summary>JWT decodificado</summary>
      <pre>{JSON.stringify(decoded, null, 2)}</pre>
    </details>
  );
}

function KeyValues({ title, values }: { title: string; values: Record<string, string> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return null;
  return (
    <>
      <h4>{title}</h4>
      <table className="kv-table">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td><Value value={v} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function prettyBody(body: string) {
  try {
    return { json: JSON.parse(body), text: JSON.stringify(JSON.parse(body), null, 2) };
  } catch {
    return { json: undefined, text: body };
  }
}

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function curl({ request }: TraceEntry) {
  const parts = [`curl -i -X ${request.method} ${quote(request.url)}`];
  for (const [k, v] of Object.entries(request.headers)) parts.push(`-H ${quote(`${k}: ${v}`)}`);
  for (const [k, v] of Object.entries(request.body ?? {})) parts.push(`--data-urlencode ${quote(`${k}=${v}`)}`);
  return parts.join(' \\\n  ');
}

// Contrasta los bytes recibidos con content-length: si coinciden, el body se muestra completo
function Completeness({ response }: { response: NonNullable<TraceEntry['response']> }) {
  const declared = response.headers['content-length'];
  const encoded = response.headers['content-encoding'];
  const match = declared !== undefined && Number(declared) === response.bodyBytes;
  return (
    <p className={`notice ${declared === undefined || encoded || match ? 'info' : 'denied'}`}>
      Body recibido: <strong>{response.bodyBytes} bytes</strong>
      {declared !== undefined
        ? encoded
          ? ` · content-length ${declared} (comprimido con ${encoded}; se muestra descomprimido)`
          : ` · content-length ${declared} ${match ? '✓ completo' : '✗ no coincide'}`
        : ' · sin content-length (transfer-encoding chunked)'}
    </p>
  );
}

// Todos los atributos de primer nivel del body JSON, con su tipo. En respuestas de token indica
// explícitamente si viene o no refresh_token.
function Attributes({ json }: { json: Record<string, unknown> }) {
  const entries = Object.entries(json);
  const isTokenResponse = 'access_token' in json;
  return (
    <>
      <h4>Atributos del body ({entries.length})</h4>
      <table className="kv-table">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>
                <span className="type">{Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v}</span>{' '}
                {typeof v === 'string' ? <Value value={v} /> : <span className="mono wrap">{JSON.stringify(v)}</span>}
              </td>
            </tr>
          ))}
          {isTokenResponse && !('refresh_token' in json) && (
            <tr>
              <th className="absent">refresh_token</th>
              <td className="absent">
                no viene en la respuesta: Keycloak no emite refresh token para este grant (refresh_expires_in = {String(json.refresh_expires_in ?? '—')})
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

function Entry({ entry, n }: { entry: TraceEntry; n: number }) {
  const { request, response } = entry;
  const body = response ? prettyBody(response.body) : undefined;
  const accessToken = typeof body?.json?.access_token === 'string' ? decodeJwt(body.json.access_token) : undefined;
  const ok = response && response.status < 400;
  return (
    <details className="trace-entry" open={n === 1}>
      <summary>
        <span className="step-n">{n}</span>
        <span className="method">{request.method}</span>
        <span className="trace-title">{entry.title}</span>
        <span className={`badge ${ok ? 'ok' : 'no'}`}>{response ? response.status : 'error'}</span>
        <span className="hint">{entry.durationMs} ms</span>
      </summary>
      <p className="hint">{entry.description}</p>

      <h3>Request</h3>
      <p className="mono wrap request-line">
        {request.method} {request.url}
      </p>
      <KeyValues title="Headers" values={request.headers} />
      <KeyValues title="Query params" values={request.query} />
      {request.body && <KeyValues title="Body (application/x-www-form-urlencoded)" values={request.body} />}
      {!request.body && <p className="hint">Sin body</p>}
      <details className="jwt">
        <summary>Comando curl equivalente</summary>
        <pre>{curl(entry)}</pre>
      </details>

      <h3>Response</h3>
      {entry.error && <p className="notice error">{entry.error}</p>}
      {response && (
        <>
          <p className="mono request-line">
            HTTP {response.status} {response.statusText}
          </p>
          <KeyValues title={`Headers (${Object.keys(response.headers).length})`} values={response.headers} />
          <Completeness response={response} />
          {body?.json && typeof body.json === 'object' && !Array.isArray(body.json) && <Attributes json={body.json} />}
          <h4>Body tal cual llegó (raw, sin modificar)</h4>
          <pre className="body">{response.body || '(vacío)'}</pre>
          {body?.json !== undefined && (
            <details className="jwt">
              <summary>Body formateado</summary>
              <pre className="body">{body.text}</pre>
            </details>
          )}
          {accessToken && (
            <>
              <h4>access_token decodificado</h4>
              <pre className="body">{JSON.stringify(accessToken, null, 2)}</pre>
            </>
          )}
        </>
      )}
    </details>
  );
}

export function PasoAPaso({ trace }: { trace: Trace }) {
  return (
    <div className="trace">
      <p className="notice warn">
        Vista de demostración: muestra el client_secret del canal y tokens reales. Estas llamadas las hace el servidor de Next.js; en producción nada de esto debe llegar al navegador.
      </p>
      {trace.map((entry, i) => (
        <Entry key={i} entry={entry} n={i + 1} />
      ))}
    </div>
  );
}
