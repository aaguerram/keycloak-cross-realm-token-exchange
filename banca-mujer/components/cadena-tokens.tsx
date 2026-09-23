// Muestra, por cada reino de API, los dos tokens de la cadena y sus claims principales
import { PRODUCTS } from '@/lib/config';
import { tokenFor, type Claims } from '@/lib/oauth';
import { Section } from './ui';

const fmtAud = (aud: Claims['aud']) => (Array.isArray(aud) ? aud.join(', ') : aud);

export async function CadenaTokens() {
  const chains = await Promise.all(
    Object.values(PRODUCTS).map(({ realm }) =>
      tokenFor(realm).then(
        (token) => ({ realm, token, error: undefined }),
        (err: Error) => ({ realm, token: undefined, error: err.message }),
      ),
    ),
  );
  return (
    <Section title="Cadena de tokens">
      <p className="hint">
        El canal solo tiene credenciales en su propio reino. Para cada reino de API pide un token cuya única audiencia es ese reino (scope aud-&lt;reino&gt;) y lo presenta ahí como client
        assertion. El token final es el que recibe el gateway.
      </p>
      <div className="chains">
        {chains.map(({ realm, token, error }) => (
          <div key={realm} className="chain">
            <h3>→ {realm}</h3>
            {error && <p className="notice error">{error}</p>}
            {token?.steps.map((step, i) => (
              <div key={i} className="step">
                <div className="step-title">
                  <span className="step-n">{i + 1}</span> {step.title}
                </div>
                <div className="step-grant">
                  {step.realm} · {step.grant}
                </div>
                <dl>
                  <dt>iss</dt>
                  <dd>{step.claims.iss}</dd>
                  <dt>aud</dt>
                  <dd>{fmtAud(step.claims.aud)}</dd>
                  <dt>azp</dt>
                  <dd>{step.claims.azp}</dd>
                  <dt>sub</dt>
                  <dd>{step.claims.sub}</dd>
                  <dt>scope</dt>
                  <dd>{step.claims.scope}</dd>
                  <dt>vence</dt>
                  <dd>{new Date(step.claims.exp * 1000).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' })}</dd>
                </dl>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}
