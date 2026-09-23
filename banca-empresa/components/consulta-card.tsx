'use client';
// Card de una consulta: empieza vacía; el botón "Consultar" ejecuta la acción de servidor (cadena de
// tokens nueva + llamada al gateway) y muestra dos pestañas: el resultado y el paso a paso HTTP.
// Si el reino no emite el scope al canal, la card se muestra en rojo: sirve para ver el flujo de una
// petición sin acceso (el gateway responde 403).
import { useState, useTransition, type ReactNode } from 'react';
import { PRODUCTS, type Product } from '@/lib/config';
import type { FreshResult } from '@/lib/gateway';
import { useAccess } from './acceso';
import { PasoAPaso } from './paso-a-paso';
import { Tabs } from './tabs';
import { Result } from './ui';

export function ConsultaCard<T>({
  title,
  product,
  scope,
  endpoint,
  consultar,
  controls,
  disabledReason,
  children,
}: {
  title: string;
  product: Product;
  scope: string;
  endpoint: string;
  consultar: () => Promise<FreshResult<T>>;
  controls?: ReactNode; // campos propios de la card (p. ej. número de cuenta)
  disabledReason?: string; // si se indica, el botón se desactiva y se muestra el motivo
  children: (data: T) => ReactNode;
}) {
  const [response, setResponse] = useState<FreshResult<T>>();
  const [at, setAt] = useState<Date>();
  const [pending, startTransition] = useTransition();
  const access = useAccess();
  const { realm } = PRODUCTS[product];
  const denied = access && !access.scopes[realm]?.includes(scope);

  const run = () =>
    startTransition(async () => {
      setResponse(await consultar());
      setAt(new Date());
    });

  return (
    <section className={denied ? 'card card-denied' : 'card'}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          <div className="path">{endpoint}</div>
        </div>
        <code className="scope">{scope}</code>
      </header>
      {denied && (
        <p className="denied-reason">
          <strong>Sin acceso.</strong> El rol <code>{access.role}</code> no habilita el scope <code>{scope}</code> en <code>{realm}</code>: Keycloak
          emite el token sin ese scope y el gateway rechaza la petición con 403. Consulte para ver el flujo completo en «Paso a paso».
        </p>
      )}
      <div className="card-controls">
        {controls}
        <button type="button" onClick={run} disabled={pending || !!disabledReason}>
          {pending ? 'Consultando…' : 'Consultar'}
        </button>
        {disabledReason && <span className="hint">{disabledReason}</span>}
      </div>
      {response && (
        <div className="result">
          <p className="hint">
            Consultado a las {at?.toLocaleTimeString('es-EC')} · {response.steps?.length ?? 0} tokens nuevos
          </p>
          <Tabs
            tabs={[
              { label: 'Resultado', content: <Result result={response}>{children}</Result> },
              { label: `Paso a paso (${response.trace.length} requests)`, content: <PasoAPaso trace={response.trace} /> },
            ]}
          />
        </div>
      )}
    </section>
  );
}
