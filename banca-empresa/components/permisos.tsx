// Prueba todas las operaciones de los productos con los tokens del canal: el gateway solo deja
// pasar las que exigen un scope presente en el token, y Keycloak solo emite los scopes que
// habilita el rol del canal en cada reino
import { PRODUCTS } from '@/lib/config';
import { callApi } from '@/lib/gateway';
import { tokenFor } from '@/lib/oauth';
import type { Operation } from '@/lib/operations';
import { Section } from './ui';

export async function Permisos({ operations }: { operations: Operation[] }) {
  const scopes: Record<string, string[]> = {};
  for (const [product, { realm }] of Object.entries(PRODUCTS)) {
    scopes[product] = await tokenFor(realm).then((t) => t.claims.scope?.split(' ') ?? [], () => []);
  }
  const results = await Promise.all(operations.map((op) => callApi(op.product, op.path)));
  return (
    <Section title="Permisos del canal">
      <p className="hint">Cada operación del gateway exige un scope. El reino dueño de la API solo lo emite si el rol del canal lo habilita.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Operación</th>
              <th>Producto</th>
              <th>Scope exigido</th>
              <th>¿En el token?</th>
              <th>Gateway</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op, i) => {
              const granted = scopes[op.product].includes(op.scope);
              const { status } = results[i];
              return (
                <tr key={op.path}>
                  <td>
                    {op.label}
                    <div className="path">GET {op.path}</div>
                  </td>
                  <td>{PRODUCTS[op.product].context.split('/')[1]}</td>
                  <td>
                    <code>{op.scope}</code>
                  </td>
                  <td>{granted ? 'Sí' : 'No'}</td>
                  <td>
                    <span className={`badge ${status >= 200 && status < 300 ? 'ok' : 'no'}`}>{status || 'error'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
