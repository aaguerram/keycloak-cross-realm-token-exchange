// Configura WSO2 API Manager mediante sus API REST (Admin v4 y Publisher v4):
//   1. Registra un Key Manager de tipo KeyCloak por cada reino (a partir de su .well-known)
//   2. Importa clientes-api, cuentas-api y movimiento-api desde su /openapi.json
//   3. Crea los API Products pro-cliente y pro-cuenta
//   4. Restringe cada API a su Key Manager y exige la audiencia de su reino en APIs y productos,
//      de modo que un producto solo acepta tokens emitidos por su reino
//   5. Exige en cada operación el scope OAuth definido en config.mjs (SCOPES)
//   6. Registra las aplicaciones de los canales (banca-persona, banca-empresa), las suscribe a los
//      productos y les asocia sus clientes de Keycloak de cada reino (map-keys)
// Es idempotente: crea lo que falta y corrige (y vuelve a desplegar) lo que tenga otra configuración.
import { createHash } from 'node:crypto';
import { VERSION, KEYCLOAK, WSO2, APIS, REALMS, SCOPES, CHANNELS, realmOfApi } from './config.mjs';

const ADMIN = `${WSO2.url}/api/am/admin/v4`;
const PUBLISHER = `${WSO2.url}/api/am/publisher/v4`;
const DEVPORTAL = `${WSO2.url}/api/am/devportal/v3`;
const GATEWAY_ENV = [{ name: 'Default', vhost: WSO2.gatewayVhost, displayOnDevportal: true }];
let token;

async function call(base, method, path, { body, form, expect = [200, 201] } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  if (!expect.includes(res.status)) throw new Error(`WSO2 ${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : undefined;
}
const publisher = (method, path, options) => call(PUBLISHER, method, path, options);
const admin = (method, path, options) => call(ADMIN, method, path, options);
const devportal = (method, path, options) => call(DEVPORTAL, method, path, options);

async function authenticate() {
  const basic = Buffer.from(`${WSO2.adminUser}:${WSO2.adminPassword}`).toString('base64');
  const dcr = await fetch(`${WSO2.url}/client-registration/v0.17/register`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientName: 'banca-setup', owner: WSO2.adminUser, grantType: 'password refresh_token', saasApp: true }),
  });
  if (!dcr.ok) throw new Error(`WSO2 DCR → ${dcr.status}: ${await dcr.text()}`);
  const { clientId, clientSecret } = await dcr.json();

  const res = await fetch(`${WSO2.url}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: WSO2.adminUser,
      password: WSO2.adminPassword,
      scope: 'apim:api_view apim:api_create apim:api_manage apim:api_publish apim:admin apim:keymanagers_manage apim:subscribe apim:app_manage apim:sub_manage',
    }),
  });
  if (!res.ok) throw new Error(`WSO2 token → ${res.status}: ${await res.text()}`);
  token = (await res.json()).access_token;
}

// ---------- Key Managers ----------

// Si el issuer público de Keycloak cambió (p. ej. de localhost a la IP del servidor), se actualiza
// el Key Manager: WSO2 rechaza tokens cuyo iss no coincide con el configurado.
async function reconcileKeyManager(id, keyManager, publicRealmUrl) {
  const current = await admin('GET', `/key-managers/${id}`);
  if (current.issuer === publicRealmUrl) return console.log(`= Key Manager ${keyManager} ya existe`);
  await admin('PUT', `/key-managers/${id}`, {
    body: {
      ...current,
      issuer: publicRealmUrl,
      displayTokenEndpoint: `${publicRealmUrl}/protocol/openid-connect/token`,
      displayRevokeEndpoint: `${publicRealmUrl}/protocol/openid-connect/revoke`,
      // el GET devuelve el secreto enmascarado: se vuelve a enviar el real
      additionalProperties: { ...current.additionalProperties, client_id: KEYCLOAK.wso2ClientId, client_secret: KEYCLOAK.wso2ClientSecret },
    },
  });
  console.log(`~ Key Manager ${keyManager} actualizado: issuer ${current.issuer} → ${publicRealmUrl}`);
}

async function ensureKeyManager({ realm, displayName, keyManager }) {
  const publicRealmUrl = `${KEYCLOAK.publicUrl}/realms/${realm}`;
  const { list } = await admin('GET', '/key-managers');
  const existing = list.find((km) => km.name === keyManager);
  if (existing) return reconcileKeyManager(existing.id, keyManager, publicRealmUrl);

  // Keycloak publica los endpoints de backchannel con el host de la petición (keycloak:8080)
  // y el issuer con KC_HOSTNAME (localhost:8180), que es el iss que llevan los tokens.
  const form = new FormData();
  form.append('url', `${KEYCLOAK.url}/realms/${realm}/.well-known/openid-configuration`);
  form.append('type', 'KeyCloak');
  const { value: discovered } = await admin('POST', '/key-managers/discover', { form });

  await admin('POST', '/key-managers', {
    body: {
      ...discovered,
      name: keyManager,
      displayName: `Keycloak ${realm}`,
      description: `${displayName}: emisor de tokens del producto ${REALMS.find((r) => r.realm === realm).product.name}`,
      type: 'KeyCloak',
      enabled: true,
      issuer: publicRealmUrl,
      displayTokenEndpoint: `${publicRealmUrl}/protocol/openid-connect/token`,
      displayRevokeEndpoint: `${publicRealmUrl}/protocol/openid-connect/revoke`,
      certificates: { type: 'JWKS', value: `${KEYCLOAK.url}/realms/${realm}/protocol/openid-connect/certs` },
      availableGrantTypes: ['client_credentials'],
      enableTokenGeneration: true,
      enableOAuthAppCreation: true,
      enableMapOAuthConsumerApps: true,
      enableSelfValidationJWT: true,
      consumerKeyClaim: 'azp',
      scopesClaim: 'scope',
      additionalProperties: {
        ...discovered.additionalProperties,
        client_id: KEYCLOAK.wso2ClientId,
        client_secret: KEYCLOAK.wso2ClientSecret,
      },
    },
  });
  console.log(`+ Key Manager ${keyManager} registrado (issuer ${publicRealmUrl})`);
}

// ---------- APIs y productos ----------

// La búsqueda `name:"..."` no funciona en /api-products; se busca por texto y se filtra por nombre exacto
async function findByName(collection, name) {
  const { list } = await publisher('GET', `/${collection}?query=${encodeURIComponent(name)}`);
  return list.find((item) => item.name === name);
}

// Crea una revisión y la despliega en el gateway (reemplaza la desplegada)
async function deployRevision(collection, id, description) {
  const revision = await publisher('POST', `/${collection}/${id}/revisions`, { body: { description } });
  await publisher('POST', `/${collection}/${id}/deploy-revision?revisionId=${revision.id}`, { body: GATEWAY_ENV });
}

// Si la revisión desplegada está en otro vhost (p. ej. localhost antes de fijar PUBLIC_HOST),
// se vuelve a desplegar la misma revisión en el vhost actual
async function ensureVhost(collection, id, label) {
  const deployments = await publisher('GET', `/${collection}/${id}/deployments`);
  const current = (deployments.list ?? deployments).find((d) => d.name === GATEWAY_ENV[0].name);
  if (!current || current.vhost === GATEWAY_ENV[0].vhost) return;
  await publisher('POST', `/${collection}/${id}/deploy-revision?revisionId=${current.revisionUuid}`, { body: GATEWAY_ENV });
  console.log(`~ ${label} redesplegado en el vhost ${GATEWAY_ENV[0].vhost} (antes ${current.vhost})`);
}

const sameList = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));

// Aplica los campos de seguridad deseados sobre una API o producto existente
async function reconcile(collection, current, desired, label) {
  const changed = Object.entries(desired).filter(([key, value]) => !sameList(current[key], value));
  if (changed.length === 0) return console.log(`= ${label} ya está configurado`);
  await publisher('PUT', `/${collection}/${current.id}`, { body: { ...current, ...desired } });
  await deployRevision(collection, current.id, `Seguridad: ${changed.map(([k]) => k).join(', ')}`);
  console.log(`~ ${label} actualizado (${changed.map(([k, v]) => `${k}=${v.join(',')}`).join('; ')}) y redesplegado`);
}

async function loadOpenApi(backend) {
  const res = await fetch(`${backend}/openapi.json`);
  if (!res.ok) throw new Error(`No se pudo leer ${backend}/openapi.json → ${res.status}`);
  const spec = await res.json();
  delete spec.paths['/health']; // endpoint operativo: no se expone en el gateway
  delete spec.servers; // WSO2 usa el endpoint configurado
  return spec;
}

// El alta de un Key Manager se propaga de forma asíncrona dentro de WSO2: aunque ya aparezca en
// /key-managers, la validación al crear una API puede responder "Key Manager not Registered"
// (901403) durante unos segundos. Se reintenta hasta que WSO2 lo reconoce.
async function importWhenKeyManagerReady(form) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await publisher('POST', '/apis/import-openapi', { form });
    } catch (err) {
      if (!err.message.includes('901403') || attempt === 30) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function ensureApi({ name, context, backend }) {
  const { keyManager, product } = realmOfApi(name);
  const security = { keyManagers: [keyManager], audiences: [product.name] };
  const existing = await findByName('apis', name);
  if (existing) {
    await reconcile('apis', await publisher('GET', `/apis/${existing.id}`), security, `API ${name}`);
    await ensureVhost('apis', existing.id, `API ${name}`);
    return existing.id;
  }

  const spec = await loadOpenApi(backend);
  const form = new FormData();
  form.append('file', new Blob([JSON.stringify(spec)], { type: 'application/json' }), `${name}.json`);
  form.append(
    'additionalProperties',
    JSON.stringify({
      name,
      version: VERSION,
      context,
      description: spec.info.description,
      policies: ['Unlimited'],
      tags: ['bian', 'iso20022'],
      ...security,
      endpointConfig: {
        endpoint_type: 'http',
        production_endpoints: { url: backend },
        sandbox_endpoints: { url: backend },
      },
    }),
  );
  const api = await importWhenKeyManagerReady(form);
  // import-openapi puede ignorar campos de seguridad: se verifican y se corrigen antes de desplegar
  const created = await publisher('GET', `/apis/${api.id}`);
  if (!sameList(created.keyManagers, security.keyManagers) || !sameList(created.audiences, security.audiences)) {
    await publisher('PUT', `/apis/${api.id}`, { body: { ...created, ...security } });
  }
  await deployRevision('apis', api.id, 'Revisión inicial');
  await publisher('POST', `/apis/change-lifecycle?apiId=${api.id}&action=Publish`);
  console.log(`+ API ${name} publicada en ${context}/${VERSION} (Key Manager ${keyManager}, aud=${product.name})`);
  return api.id;
}

const scopesOf = (operation) => [...(operation.scopes ?? [])].sort().join(' ');

// Scopes de la API: se definen como scopes locales (sin roles de WSO2; los otorga Keycloak) y cada
// operación exige el suyo. Una operación sin scope en la configuración es un error.
async function ensureApiScopes(apiName, id) {
  const api = await publisher('GET', `/apis/${id}`);
  const defined = SCOPES.filter((s) => s.api === apiName);
  const operations = api.operations.map((op) => {
    const scopes = defined.filter((s) => s.operations.some(([verb, target]) => verb === op.verb && target === op.target)).map((s) => s.name);
    if (scopes.length === 0) throw new Error(`La operación ${op.verb} ${op.target} de ${apiName} no tiene scope en config.mjs`);
    return { ...op, scopes };
  });
  const sameScopes = sameList(api.scopes.map((s) => s.scope.name), defined.map((s) => s.name));
  if (sameScopes && operations.every((op, i) => scopesOf(op) === scopesOf(api.operations[i]))) {
    return console.log(`= Scopes de ${apiName} ya están configurados`);
  }
  await publisher('PUT', `/apis/${id}`, {
    body: {
      ...api,
      scopes: defined.map((s) => ({ scope: { name: s.name, displayName: s.name, description: s.description, bindings: [] }, shared: false })),
      operations,
    },
  });
  await deployRevision('apis', id, 'Scopes por operación');
  console.log(`~ Scopes de ${apiName}: ${operations.map((op) => `${op.verb} ${op.target} → ${op.scopes.join(',')}`).join('; ')}`);
}

// Recursos del producto con los scopes vigentes de cada API
async function productApisOf(apis, apiIds) {
  const productApis = [];
  for (const apiName of apis) {
    const api = await publisher('GET', `/apis/${apiIds[apiName]}`);
    productApis.push({
      apiId: api.id,
      name: api.name,
      version: api.version,
      operations: api.operations.map(({ target, verb, scopes }) => ({ target, verb, scopes })),
    });
  }
  return productApis;
}

// El GET del producto ya refleja los scopes vigentes de sus APIs, pero la revisión desplegada en el
// gateway conserva los de su momento. Cada despliegue por scopes guarda en la descripción de la
// revisión una huella de los scopes; si la revisión desplegada no la tiene, se vuelve a desplegar.
async function reconcileProductScopes(product, productApis) {
  const key = productApis.flatMap((a) => a.operations.map((op) => `${a.name} ${op.verb} ${op.target} ${scopesOf(op)}`)).sort().join('\n');
  const fingerprint = `scopes#${createHash('sha256').update(key).digest('hex').slice(0, 12)}`;
  const deployed = (await publisher('GET', `/api-products/${product.id}/revisions?query=deployed:true`)).list ?? [];
  if (deployed.some((r) => r.description?.includes(fingerprint))) return;
  await publisher('PUT', `/api-products/${product.id}`, { body: { ...product, apis: productApis } });
  await deployRevision('api-products', product.id, `Scopes por operación (${fingerprint})`);
  console.log(`~ Producto ${product.name}: scopes de recursos redesplegados (${fingerprint})`);
}

async function ensureProduct({ name, context, description, apis }, apiIds) {
  const security = { audiences: [name] };
  const productApis = await productApisOf(apis, apiIds);
  const existing = await findByName('api-products', name);
  if (existing) {
    await reconcile('api-products', await publisher('GET', `/api-products/${existing.id}`), security, `Producto ${name}`);
    await reconcileProductScopes(await publisher('GET', `/api-products/${existing.id}`), productApis);
    await ensureVhost('api-products', existing.id, `Producto ${name}`);
    return;
  }

  const product = await publisher('POST', '/api-products', {
    body: {
      name,
      context,
      version: VERSION,
      description,
      policies: ['Unlimited'],
      visibility: 'PUBLIC',
      tags: ['bian', 'producto'],
      ...security,
      apis: productApis,
    },
  });
  await reconcileProductScopes(await publisher('GET', `/api-products/${product.id}`), productApis);
  await publisher('POST', `/api-products/change-lifecycle?apiProductId=${product.id}&action=Publish`);
  const ops = productApis.map((a) => `${a.name} (${a.operations.length} recursos)`).join(', ');
  console.log(`+ Producto ${name} publicado en ${context}/${VERSION} (aud=${name}): ${ops}`);
}

// El despliegue en el gateway es asíncrono: sin token, un recurso ya desplegado responde 401
// (credenciales faltantes) y uno aún no desplegado responde 404.
async function waitForGateway(context, target) {
  const url = `${WSO2.gatewayUrl}${context}/${VERSION}${target.replace(/\{[^}]+\}/g, 'x')}`;
  for (let attempt = 1; attempt <= 60; attempt++) {
    const { status } = await fetch(url).catch(() => ({ status: 0 }));
    if (status === 401) return console.log(`✓ Gateway sirve ${context}/${VERSION}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`El gateway no desplegó ${context}/${VERSION} a tiempo`);
}

// ---------- Aplicaciones de los canales ----------

// Aplicación del Developer Portal por canal, suscrita a los productos. Sus claves no las crea WSO2:
// se asocian (map-keys) los clientes que el setup de Keycloak creó en cada reino, que se autentican
// con client assertions federadas y no tienen secreto. Así WSO2 reconoce el azp de sus tokens.
async function ensureChannelApplication(channel) {
  const { list } = await devportal('GET', `/applications?query=${encodeURIComponent(channel.name)}`);
  let app = list.find((a) => a.name === channel.name);
  if (!app) {
    app = await devportal('POST', '/applications', {
      body: {
        name: channel.name,
        throttlingPolicy: 'Unlimited',
        description: `${channel.description}: tokens de reino-cliente y reino-cuenta obtenidos con client assertions de ${channel.realm}`,
        tokenType: 'JWT',
      },
    });
    console.log(`+ Aplicación ${channel.name} creada en el Developer Portal`);
  }

  const subscriptions = (await devportal('GET', `/subscriptions?applicationId=${app.applicationId}`)).list;
  for (const { product } of REALMS) {
    const { list: found } = await devportal('GET', `/apis?query=${encodeURIComponent(`name:${product.name}`)}`);
    const item = found.find((p) => p.name === product.name);
    if (subscriptions.some((s) => s.apiId === item.id)) continue;
    await devportal('POST', '/subscriptions', { body: { applicationId: app.applicationId, apiId: item.id, throttlingPolicy: 'Unlimited' } });
    console.log(`+ Aplicación ${channel.name} suscrita a ${product.name}`);
  }

  const keys = (await devportal('GET', `/applications/${app.applicationId}/oauth-keys`)).list;
  for (const { realm, keyManager } of REALMS) {
    const current = keys.find((k) => k.keyManager === keyManager && k.keyType === 'PRODUCTION');
    if (current?.consumerKey === channel.name) continue;
    if (current) await devportal('DELETE', `/applications/${app.applicationId}/oauth-keys/${current.keyMappingId}/clean-up`, { expect: [200, 204] });
    await devportal('POST', `/applications/${app.applicationId}/map-keys`, {
      body: { consumerKey: channel.name, consumerSecret: '', keyManager, keyType: 'PRODUCTION' },
    });
    console.log(`+ Aplicación ${channel.name}: cliente ${channel.name} de ${realm} asociado (${keyManager})`);
  }
}

export async function setupWso2() {
  await authenticate();
  for (const realm of REALMS) await ensureKeyManager(realm);

  const apiIds = {};
  for (const api of APIS) apiIds[api.name] = await ensureApi(api);
  for (const api of APIS) await ensureApiScopes(api.name, apiIds[api.name]);
  for (const { product } of REALMS) await ensureProduct(product, apiIds);

  // Un recurso de ejemplo por API sirve para comprobar tanto la API como los productos que la incluyen
  const sampleTarget = {};
  for (const [name, id] of Object.entries(apiIds)) {
    sampleTarget[name] = (await publisher('GET', `/apis/${id}`)).operations[0].target;
  }
  for (const { name, context } of APIS) await waitForGateway(context, sampleTarget[name]);
  for (const { product } of REALMS) await waitForGateway(product.context, sampleTarget[product.apis[0]]);

  for (const channel of CHANNELS) await ensureChannelApplication(channel);
}
