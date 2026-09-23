// Prueba de punta a punta del aislamiento por reino, como consumidor del Developer Portal:
//   1. Recrea la aplicación "app-prueba-banca" y la suscribe a los dos productos y a las tres APIs,
//      para que la única diferencia entre respuestas sea el reino que emitió el token
//   2. Genera credenciales de la aplicación en cada Key Manager: WSO2 crea el cliente en el reino
//      de Keycloak correspondiente (DCR); también en el Resident Key Manager de WSO2 como control
//   3. En Keycloak, otorga al cliente creado todos los scopes de permiso del reino (client scopes
//      por defecto + los roles que los habilitan), para que solo se pruebe el aislamiento por reino
//   4. Pide un token Client Credentials a cada emisor
//   5. Llama a cada producto y API con cada token y verifica que solo el reino dueño tenga acceso
// Uso: NODE_TLS_REJECT_UNAUTHORIZED=0 node setup/test-gateway.mjs  (usa PUBLIC_HOST de .env)
// Toma PUBLIC_HOST del .env del proyecto: es el host con que WSO2 y Keycloak se anuncian
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {}
const { VERSION, APIS, REALMS, SCOPES, realmOfApi, realmOfScope } = await import('./config.mjs');

const HOST = process.env.PUBLIC_HOST ?? 'localhost';
const WSO2 = process.env.WSO2_URL ?? `https://${HOST}:9443`;
const GATEWAY = process.env.GATEWAY_URL ?? `https://${HOST}:8243`;
const KEYCLOAK = process.env.KEYCLOAK_PUBLIC_URL ?? `http://${HOST}:8180`;
const ADMIN_USER = process.env.WSO2_ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.WSO2_ADMIN_PASSWORD ?? 'admin';
const DEVPORTAL = `${WSO2}/api/am/devportal/v3`;
const KC_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER ?? 'admin';
const KC_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin';
const APP_NAME = 'app-prueba-banca';
const RESIDENT_KM = 'Resident Key Manager';

const basic = (user, pass) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
let token;

async function call(method, path, body, expect = [200, 201, 204]) {
  const res = await fetch(`${DEVPORTAL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  if (!expect.includes(res.status)) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : undefined;
}

async function devportalToken() {
  const dcr = await fetch(`${WSO2}/client-registration/v0.17/register`, {
    method: 'POST',
    headers: { Authorization: basic(ADMIN_USER, ADMIN_PASSWORD), 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientName: 'banca-test', owner: ADMIN_USER, grantType: 'password', saasApp: true }),
  }).then((r) => r.json());
  const res = await fetch(`${WSO2}/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: basic(dcr.clientId, dcr.clientSecret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      username: ADMIN_USER,
      password: ADMIN_PASSWORD,
      scope: 'apim:subscribe apim:app_manage apim:sub_manage',
    }),
  });
  return (await res.json()).access_token;
}

// Se recrea la aplicación en cada ejecución: al borrarla, WSO2 elimina también sus clientes en Keycloak
async function recreateApplication() {
  const { list } = await call('GET', `/applications?query=${APP_NAME}`);
  const existing = list.find((a) => a.name === APP_NAME);
  if (existing) await call('DELETE', `/applications/${existing.applicationId}`);
  const app = await call('POST', '/applications', {
    name: APP_NAME,
    throttlingPolicy: 'Unlimited',
    description: 'Aplicación M2M de prueba (Client Credentials)',
    tokenType: 'JWT',
  });
  return app.applicationId;
}

// Suscribe a un producto o API publicada en el Developer Portal
async function subscribe(applicationId, name) {
  const { list } = await call('GET', `/apis?query=${encodeURIComponent(`name:${name}`)}`);
  const item = list.find((p) => p.name === name);
  if (!item) throw new Error(`No existe ${name} en el Developer Portal`);
  await call('POST', '/subscriptions', { applicationId, apiId: item.id, throttlingPolicy: 'Unlimited' });
}

// Propiedades obligatorias de la aplicación según el conector (p. ej. KeyCloak exige subject_type,
// token_endpoint_auth_method...): se usan los valores por defecto que publica cada Key Manager
async function requiredAppProperties(keyManager) {
  const { list } = await call('GET', '/key-managers');
  const km = list.find((k) => k.name === keyManager);
  return Object.fromEntries(km.applicationConfiguration.filter((c) => c.required).map((c) => [c.name, c.default]));
}

// Los recursos exigen scopes que Keycloak solo emite a quien tiene el rol que los habilita: el
// cliente de prueba recibe todos los scopes del reino y todos esos roles
async function grantAllScopes(realm, clientId) {
  const adminToken = await fetch(`${KEYCLOAK}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: KC_ADMIN_USER, password: KC_ADMIN_PASSWORD }),
  }).then((r) => r.json()).then((j) => j.access_token);
  const kc = async (method, path, body) => {
    const res = await fetch(`${KEYCLOAK}/admin/realms/${realm}${path}`, {
      method,
      headers: { Authorization: `Bearer ${adminToken}`, ...(body && { 'Content-Type': 'application/json' }) },
      body: body && JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Keycloak ${method} ${path} → ${res.status}: ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : undefined;
  };
  const [client] = await kc('GET', `/clients?clientId=${encodeURIComponent(clientId)}`);
  const names = SCOPES.filter((s) => realmOfScope(s.name) === realm).map((s) => s.name);
  const scopes = (await kc('GET', '/client-scopes')).filter((s) => names.includes(s.name));
  const roles = new Map();
  for (const scope of scopes) {
    await kc('PUT', `/clients/${client.id}/default-client-scopes/${scope.id}`);
    for (const role of await kc('GET', `/client-scopes/${scope.id}/scope-mappings/realm`)) roles.set(role.name, role);
  }
  const serviceAccount = await kc('GET', `/clients/${client.id}/service-account-user`);
  await kc('POST', `/users/${serviceAccount.id}/role-mappings/realm`, [...roles.values()]);
}

async function clientCredentialsToken(applicationId, keyManager, tokenEndpoint, realm) {
  const keys = await call('POST', `/applications/${applicationId}/generate-keys`, {
    keyType: 'PRODUCTION',
    keyManager,
    grantTypesToBeSupported: ['client_credentials'],
    callbackUrl: '',
    validityTime: 3600,
    additionalProperties: await requiredAppProperties(keyManager),
  });
  if (realm) await grantAllScopes(realm, keys.consumerKey);
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { Authorization: basic(keys.consumerKey, keys.consumerSecret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`client_credentials en ${keyManager} → ${res.status}: ${await res.text()}`);
  const accessToken = (await res.json()).access_token;
  const claims = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
  return { accessToken, claims };
}

// ---------- Ejecución ----------

token = await devportalToken();
const applicationId = await recreateApplication();
const subscribed = [...REALMS.map((r) => r.product.name), ...APIS.map((a) => a.name)];
for (const name of subscribed) await subscribe(applicationId, name);
console.log(`Aplicación ${APP_NAME} suscrita a ${subscribed.join(', ')}\n`);

const issuers = [
  ...REALMS.map((r) => ({ label: r.realm, realm: r.realm, keyManager: r.keyManager, owns: r.product.name, tokenEndpoint: `${KEYCLOAK}/realms/${r.realm}/protocol/openid-connect/token` })),
  { label: 'WSO2 resident', keyManager: RESIDENT_KM, owns: null, tokenEndpoint: `${WSO2}/oauth2/token` },
];
for (const issuer of issuers) {
  Object.assign(issuer, await clientCredentialsToken(applicationId, issuer.keyManager, issuer.tokenEndpoint, issuer.realm));
  const { iss, aud, azp } = issuer.claims;
  console.log(`Token ${issuer.label.padEnd(13)} iss=${iss}  aud=${JSON.stringify(aud)}  azp=${azp}`);
}

// Un recurso representativo de cada producto y de cada API individual; `owner` es el producto
// (= audiencia) del reino que debe tener acceso
const targets = [
  { owner: 'pro-cliente', path: `/pro-cliente/${VERSION}/party-reference-data-directory/v1/parties/1710034065/addresses` },
  { owner: 'pro-cuenta', path: `/pro-cuenta/${VERSION}/savings-account/v1/savings-accounts/2200145678` },
  { owner: 'pro-cuenta', path: `/pro-cuenta/${VERSION}/position-keeping/v1/accounts/2200145678/transactions?limit=2` },
  { owner: realmOfApi('clientes-api').product.name, path: `/clientes/${VERSION}/party-reference-data-directory/v1/parties` },
  { owner: realmOfApi('cuentas-api').product.name, path: `/cuentas/${VERSION}/current-account/v1/current-accounts/1100567890` },
  { owner: realmOfApi('movimiento-api').product.name, path: `/movimientos/${VERSION}/position-keeping/v1/transactions/MOV-20260905-000027` },
];

console.log('\nToken          Esperado  Obtenido  Recurso');
let failures = 0;
for (const issuer of issuers) {
  for (const { owner, path } of targets) {
    const res = await fetch(`${GATEWAY}${path}`, { headers: { Authorization: `Bearer ${issuer.accessToken}` } });
    const allowed = issuer.owns === owner;
    const ok = allowed ? res.status === 200 : res.status === 401 || res.status === 403;
    if (!ok) failures++;
    const expected = allowed ? '200' : '401/403';
    console.log(`${issuer.label.padEnd(14)} ${expected.padEnd(9)} ${String(res.status).padEnd(9)} ${path}  ${ok ? '✓' : '✗ FALLO'}`);
  }
}

const noToken = await fetch(`${GATEWAY}${targets[0].path}`);
console.log(`${'(sin token)'.padEnd(14)} ${'401'.padEnd(9)} ${String(noToken.status).padEnd(9)} ${targets[0].path}  ${noToken.status === 401 ? '✓' : '✗ FALLO'}`);
if (noToken.status !== 401) failures++;

console.log(failures === 0 ? '\nOK: cada producto solo acepta tokens de su reino' : `\n${failures} verificaciones fallaron`);
process.exit(failures === 0 ? 0 : 1);
