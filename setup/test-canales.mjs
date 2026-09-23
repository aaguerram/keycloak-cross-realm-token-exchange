// Prueba de punta a punta de los canales definidos en CHANNELS (banca-persona, banca-empresa, banca-mujer):
//   1. Client Credentials en el reino del canal con scope=aud-<reino destino>: un token por reino
//      destino, con ese reino como única audiencia
//   2. Client Credentials en reino-cliente y reino-cuenta autenticando al cliente con el token
//      anterior como client assertion (RFC 7523, federated client authentication)
//   3. Llama a todas las operaciones de los productos pro-cliente y pro-cuenta y verifica que solo
//      respondan 200 las permitidas al canal (el resto, 403 por scope)
// Además verifica los casos que deben fallar: Token Exchange directo entre reinos, reutilización de
// la assertion, token del canal con varias audiencias y token del canal directo en el gateway.
// No se usa Token Exchange en la cadena.
// Uso: NODE_TLS_REJECT_UNAUTHORIZED=0 node setup/test-canales.mjs  (usa PUBLIC_HOST de .env)
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {}
const { VERSION, REALMS, SCOPES, CHANNELS, realmOfApi } = await import('./config.mjs');

const HOST = process.env.PUBLIC_HOST ?? 'localhost';
const GATEWAY = process.env.GATEWAY_URL ?? `https://${HOST}:8243`;
const KEYCLOAK = process.env.KEYCLOAK_PUBLIC_URL ?? `http://${HOST}:8180`;
const TOKEN_EXCHANGE = 'urn:ietf:params:oauth:grant-type:token-exchange';
const ACCESS_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';
const JWT_BEARER = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

const claims = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

async function token(realm, params) {
  const res = await fetch(`${KEYCLOAK}/realms/${realm}/protocol/openid-connect/token`, { method: 'POST', body: new URLSearchParams(params) });
  return { status: res.status, ...(await res.json()) };
}

// Token del canal en su reino; `realms` son los reinos destino que se piden como audiencia
const homeToken = (channel, ...realms) =>
  token(channel.realm, {
    grant_type: 'client_credentials',
    client_id: channel.name,
    client_secret: channel.clientSecret,
    ...(realms.length && { scope: realms.map((r) => `aud-${r}`).join(' ') }),
  });

const federatedToken = (targetRealm, assertion) =>
  token(targetRealm, { grant_type: 'client_credentials', client_assertion_type: JWT_BEARER, client_assertion: assertion });

// Ejemplos concretos para las variables de ruta de cada operación
const SAMPLE = {
  partyIdentification: '1710034065',
  savingsAccountId: '2200145678',
  currentAccountId: '1100456789',
  accountNumber: '2200145678',
  transactionId: 'MOV-20260905-000027',
};
const operations = SCOPES.flatMap((scope) =>
  scope.operations.map(([verb, target]) => {
    const { realm, product } = realmOfApi(scope.api);
    return { scope: scope.name, realm, verb, path: `${product.context}/${VERSION}${target.replace(/\{(\w+)\}/g, (_, v) => SAMPLE[v])}` };
  }),
);

let failures = 0;
const check = (ok, text) => {
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗ FALLO'} ${text}`);
};

for (const channel of CHANNELS) {
  console.log(`\n=== ${channel.name} (${channel.realm})`);
  const home = await homeToken(channel);
  check(home.status === 200, `Client Credentials en ${channel.realm} → ${home.status}`);
  const homeClaims = claims(home.access_token);
  console.log(`    iss=${homeClaims.iss} aud=${JSON.stringify(homeClaims.aud)} sub=${homeClaims.sub}`);

  const tokens = {};
  for (const { realm } of REALMS) {
    const assertion = await homeToken(channel, realm);
    const aud = assertion.access_token && claims(assertion.access_token).aud;
    check(assertion.status === 200 && aud === realm, `Client Credentials en ${channel.realm} con scope=aud-${realm} → ${assertion.status}, aud=${JSON.stringify(aud)}`);

    const target = await federatedToken(realm, assertion.access_token);
    check(target.status === 200, `Client Credentials en ${realm} con client assertion de ${channel.realm} → ${target.status} ${target.error_description ?? ''}`);
    const c = claims(target.access_token);
    console.log(`    iss=${c.iss} azp=${c.azp} aud=${JSON.stringify(c.aud)} scope="${c.scope}"`);
    tokens[realm] = target.access_token;

    const reuse = await federatedToken(realm, assertion.access_token);
    check(reuse.status === 400, `Reutilizar la misma assertion en ${realm} → ${reuse.status} (${reuse.error_description})`);
  }

  const both = await homeToken(channel, ...REALMS.map((r) => r.realm));
  const multiAudience = await federatedToken(REALMS[0].realm, both.access_token);
  check(multiAudience.status >= 400, `Token del canal con varias audiencias como assertion → ${multiAudience.status} (${multiAudience.error_description})`);

  const freshAssertion = (await homeToken(channel, REALMS[1].realm)).access_token;
  const crossExchange = await token(REALMS[1].realm, {
    grant_type: TOKEN_EXCHANGE,
    client_assertion_type: JWT_BEARER,
    client_assertion: freshAssertion,
    subject_token: home.access_token,
    subject_token_type: ACCESS_TOKEN_TYPE,
  });
  check(crossExchange.status >= 400, `Token Exchange directo en ${REALMS[1].realm} con subject_token de ${channel.realm} → ${crossExchange.status} (${crossExchange.error_description})`);

  // WSO2 responde 500 (900900 "Unclassified Authentication Failure") a un JWT cuyo emisor no es un
  // Key Manager registrado: el reino del canal no lo es, así que su token nunca llega al backend
  const direct = await fetch(`${GATEWAY}${operations[0].path}`, { headers: { Authorization: `Bearer ${home.access_token}` } });
  check([401, 403, 500].includes(direct.status), `Token de ${channel.realm} directo en el gateway → ${direct.status} (rechazado)`);

  console.log('\n  Esperado Obtenido Scope                 Recurso');
  for (const op of operations) {
    const res = await fetch(`${GATEWAY}${op.path}`, { headers: { Authorization: `Bearer ${tokens[op.realm]}` } });
    const allowed = channel.permissions.includes(op.scope);
    const ok = res.status === (allowed ? 200 : 403);
    if (!ok) failures++;
    console.log(`  ${(allowed ? '200' : '403').padEnd(8)} ${String(res.status).padEnd(8)} ${op.scope.padEnd(21)} ${op.verb} ${op.path}  ${ok ? '✓' : '✗ FALLO'}`);
  }
}

console.log(failures === 0 ? '\nOK: cada canal accede solo a lo que permiten sus roles' : `\n${failures} verificaciones fallaron`);
process.exit(failures === 0 ? 0 : 1);
