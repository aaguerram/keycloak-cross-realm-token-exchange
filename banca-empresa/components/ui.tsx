import type { ReactNode } from 'react';
import type { Amount } from '@/lib/types';
import type { ApiResult } from '@/lib/gateway';

export function Section({ title, scope, children }: { title: string; scope?: string; children: ReactNode }) {
  return (
    <section className="card">
      <header className="card-head">
        <h2>{title}</h2>
        {scope && <code className="scope">{scope}</code>}
      </header>
      {children}
    </section>
  );
}

// Muestra el contenido si la llamada respondió 2xx; si no, el código y el motivo
export function Result<T>({ result, children }: { result: ApiResult<T>; children: (data: T) => ReactNode }) {
  if (result.data !== undefined && result.status < 300) return <>{children(result.data)}</>;
  const denied = result.status === 403 || result.status === 401;
  return (
    <p className={denied ? 'notice denied' : 'notice error'}>
      <strong>{result.status || 'Error'}</strong> {denied ? 'Acceso denegado por el gateway: ' : ''}
      {result.error}
    </p>
  );
}

export const money = ({ Amount, Currency }: Amount, indicator?: string) =>
  `${indicator === 'DBIT' ? '−' : ''}${Number(Amount).toLocaleString('es-EC', { style: 'currency', currency: Currency })}`;

export const date = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: iso.includes('T') ? 'short' : undefined, timeZone: 'America/Guayaquil' });
