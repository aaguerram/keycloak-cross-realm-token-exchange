// Configura Keycloak mediante su Admin REST API:
//   - sslRequired=none en master y en los reinos (Keycloak corre por HTTP en desarrollo y, por
//     defecto, exige HTTPS a clientes fuera de redes privadas, como las IPs 100.x de Tailscale)
// Por cada reino:
//   - crea el reino
//   - crea el client scope "aud-<producto>" con un audience mapper y lo marca como scope por
//     defecto del reino: todo token del reino lleva aud=<producto> (también los clientes creados por DCR)
//   - crea el client scope opcional "default": WSO2 lo solicita al pedir tokens (conector y
//     Developer Portal) y Keycloak rechaza con "Invalid scopes" los scopes que no existen
//   - crea el cliente confidencial "wso2-km" con service account y roles de realm-management
//     para que WSO2 registre las aplicaciones del Developer Portal en el reino (DCR)
// Es idempotente.
import { KEYCLOAK, REALMS, SCOPES, CHANNELS, realmOfScope, roleOfChannel } from './config.mjs';

let token;

async function kc(method, path, body, expect = [200, 201, 204]) {
  const res = await fetch(`${KEYCLOAK.url}/admin/realms${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!expect.includes(res.status)) throw new Error(`Keycloak ${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : undefined;
}

async function authenticate() {
  const res = await fetch(`${KEYCLOAK.url}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: KEYCLOAK.adminUser,
      password: KEYCLOAK.adminPassword,
    }),
  });
  if (!res.ok) throw new Error(`Keycloak admin token → ${res.status}: ${await res.text()}`);
  token = (await res.json()).access_token;
}

const SSL_REQUIRED = 'none';

async function ensureSslRequired(realm) {
  const current = await kc('GET', `/${realm}`);
  if (current.sslRequired === SSL_REQUIRED) return;
  await kc('PUT', `/${realm}`, { sslRequired: SSL_REQUIRED });
  console.log(`~ Reino ${realm}: sslRequired ${current.sslRequired} → ${SSL_REQUIRED}`);
}

async function ensureRealm({ realm, displayName }) {
  const existing = await kc('GET', `/${realm}`, undefined, [200, 404]);
  if (existing?.realm) {
    console.log(`= Reino ${realm} ya existe`);
    return ensureSslRequired(realm);
  }
  await kc('POST', '', { realm, displayName, enabled: true, accessTokenLifespan: 300, sslRequired: SSL_REQUIRED });
  console.log(`+ Reino ${realm} creado`);
}

async function ensureAudienceScope(realm, audience, { realmDefault = true } = {}) {
  const name = `aud-${audience}`;
  let scope = (await kc('GET', `/${realm}/client-scopes`)).find((s) => s.name === name);
  if (!scope) {
    await kc('POST', `/${realm}/client-scopes`, {
      name,
      description: `Agrega aud=${audience} a los access tokens del reino`,
      protocol: 'openid-connect',
      attributes: { 'include.in.token.scope': 'false', 'display.on.consent.screen': 'false' },
      protocolMappers: [
        {
          name: `audience-${audience}`,
          protocol: 'openid-connect',
          protocolMapper: 'oidc-audience-mapper',
          config: {
            'included.custom.audience': audience,
            'access.token.claim': 'true',
            'introspection.token.claim': 'true',
            'id.token.claim': 'false',
          },
        },
      ],
    });
    scope = (await kc('GET', `/${realm}/client-scopes`)).find((s) => s.name === name);
    console.log(`+ Client scope ${name} creado en ${realm}`);
  }
  // Scope por defecto del reino: lo reciben todos los clientes nuevos, incluidos los creados por DCR
  if (realmDefault) await kc('PUT', `/${realm}/default-default-client-scopes/${scope.id}`, undefined, [204, 409]); // 409 = ya asignado
  return scope.id;
}

async function ensureDefaultScope(realm) {
  let scope = (await kc('GET', `/${realm}/client-scopes`)).find((s) => s.name === 'default');
  if (!scope) {
    await kc('POST', `/${realm}/client-scopes`, {
      name: 'default',
      description: 'Scope por defecto que solicita WSO2 API Manager',
      protocol: 'openid-connect',
      attributes: { 'include.in.token.scope': 'true', 'display.on.consent.screen': 'false' },
    });
    scope = (await kc('GET', `/${realm}/client-scopes`)).find((s) => s.name === 'default');
    console.log(`+ Client scope opcional default creado en ${realm}`);
  }
  // Opcional por defecto del reino: los clientes nuevos (incluidos los de DCR) pueden pedirlo
  await kc('PUT', `/${realm}/default-optional-client-scopes/${scope.id}`, undefined, [204, 409]);
  return scope.id;
}

async function ensureWso2Client(realm, audienceScopeId, defaultScopeId) {
  const [existing] = await kc('GET', `/${realm}/clients?clientId=${KEYCLOAK.wso2ClientId}`);
  if (existing) {
    await kc('PUT', `/${realm}/clients/${existing.id}/optional-client-scopes/${defaultScopeId}`);
    return console.log(`= Cliente ${KEYCLOAK.wso2ClientId} ya existe en ${realm}`);
  }

  await kc('POST', `/${realm}/clients`, {
    clientId: KEYCLOAK.wso2ClientId,
    name: 'WSO2 API Manager - Key Manager',
    description: 'Usado por WSO2 para registrar aplicaciones (DCR) e introspección de tokens',
    protocol: 'openid-connect',
    publicClient: false,
    clientAuthenticatorType: 'client-secret',
    secret: KEYCLOAK.wso2ClientSecret,
    serviceAccountsEnabled: true,
    standardFlowEnabled: false,
    directAccessGrantsEnabled: false,
  });
  const [client] = await kc('GET', `/${realm}/clients?clientId=${KEYCLOAK.wso2ClientId}`);
  await kc('PUT', `/${realm}/clients/${client.id}/default-client-scopes/${audienceScopeId}`);
  await kc('PUT', `/${realm}/clients/${client.id}/optional-client-scopes/${defaultScopeId}`);

  // Roles de realm-management para administrar clientes del reino
  const serviceAccount = await kc('GET', `/${realm}/clients/${client.id}/service-account-user`);
  const [realmManagement] = await kc('GET', `/${realm}/clients?clientId=realm-management`);
  const roles = [];
  for (const role of ['create-client', 'manage-clients', 'view-clients', 'query-clients']) {
    roles.push(await kc('GET', `/${realm}/clients/${realmManagement.id}/roles/${role}`));
  }
  await kc('POST', `/${realm}/users/${serviceAccount.id}/role-mappings/clients/${realmManagement.id}`, roles);
  console.log(`+ Cliente ${KEYCLOAK.wso2ClientId} creado en ${realm} (service account con roles de realm-management)`);
}

// ---------- Canales ----------

const findClient = async (realm, clientId) => (await kc('GET', `/${realm}/clients?clientId=${encodeURIComponent(clientId)}`))[0];

// Crea el cliente o actualiza los campos indicados si difieren
async function upsertClient(realm, desired) {
  const existing = await findClient(realm, desired.clientId);
  if (!existing) {
    await kc('POST', `/${realm}/clients`, desired);
    console.log(`+ Cliente ${desired.clientId} creado en ${realm}`);
    return findClient(realm, desired.clientId);
  }
  const attributes = { ...existing.attributes, ...desired.attributes };
  const changed = Object.entries({ ...desired, attributes }).some(([k, v]) => JSON.stringify(existing[k]) !== JSON.stringify(v));
  if (changed) {
    await kc('PUT', `/${realm}/clients/${existing.id}`, { ...existing, ...desired, attributes });
    console.log(`~ Cliente ${desired.clientId} actualizado en ${realm}`);
  }
  return findClient(realm, desired.clientId);
}

async function assignRealmRoles(realm, userId, roleNames) {
  const current = (await kc('GET', `/${realm}/users/${userId}/role-mappings/realm`)).map((r) => r.name);
  const missing = roleNames.filter((r) => !current.includes(r));
  if (missing.length === 0) return;
  const roles = await Promise.all(missing.map((r) => kc('GET', `/${realm}/roles/${encodeURIComponent(r)}`)));
  await kc('POST', `/${realm}/users/${userId}/role-mappings/realm`, roles);
}

async function ensureRealmRole(realm, name, description) {
  const existing = await kc('GET', `/${realm}/roles/${encodeURIComponent(name)}`, undefined, [200, 404]);
  if (existing?.name) return existing;
  await kc('POST', `/${realm}/roles`, { name, description });
  console.log(`+ Rol ${name} creado en ${realm}`);
  return kc('GET', `/${realm}/roles/${encodeURIComponent(name)}`);
}

// Reino del canal: cliente confidencial con Client Credentials y, por cada reino de API, un client
// scope opcional "aud-<reino>" que agrega esa audiencia. El canal pide scope=aud-<reino> y recibe un
// token cuya única audiencia es el reino destino: es el que presenta como client assertion en ese
// reino. No se usa Token Exchange.
async function setupChannelRealm(channel) {
  await ensureRealm(channel);
  const audienceScopes = [];
  for (const { realm } of REALMS) {
    // Versiones anteriores creaban un cliente por reino destino como audiencia del Token Exchange
    const legacy = await findClient(channel.realm, realm);
    if (legacy) {
      await kc('DELETE', `/${channel.realm}/clients/${legacy.id}`);
      console.log(`- Cliente ${realm} eliminado de ${channel.realm} (ya no se usa Token Exchange)`);
    }
    audienceScopes.push(await ensureAudienceScope(channel.realm, realm, { realmDefault: false }));
  }

  const client = await upsertClient(channel.realm, {
    clientId: channel.name,
    name: channel.description,
    description: `Aplicación ${channel.name}: Client Credentials; sus tokens son client assertions en los reinos de las APIs`,
    protocol: 'openid-connect',
    publicClient: false,
    clientAuthenticatorType: 'client-secret',
    secret: channel.clientSecret,
    serviceAccountsEnabled: true,
    standardFlowEnabled: false,
    directAccessGrantsEnabled: false,
    // Sin roles en el token: con los roles por defecto del reino Keycloak agregaría aud=account y la
    // assertion tendría varias audiencias
    fullScopeAllowed: false,
    attributes: { 'standard.token.exchange.enabled': 'false' },
  });
  // Opcionales: el token lleva solo la audiencia del reino que se pide en scope (una por assertion)
  for (const id of audienceScopes) {
    await kc('DELETE', `/${channel.realm}/clients/${client.id}/default-client-scopes/${id}`, undefined, [204, 404]);
    await kc('PUT', `/${channel.realm}/clients/${client.id}/optional-client-scopes/${id}`);
  }

  // El sub de sus tokens es el id del usuario de service account: identifica al canal en los otros reinos
  return (await kc('GET', `/${channel.realm}/clients/${client.id}/service-account-user`)).id;
}

// Reino de API: registra el reino del canal como Identity Provider (solo para client assertions)
async function ensureChannelIdentityProvider(realm, channel) {
  const issuer = `${KEYCLOAK.publicUrl}/realms/${channel.realm}`;
  // Keycloak valida la firma consultando el JWKS del reino del canal en sí mismo
  const internal = `http://localhost:8080/realms/${channel.realm}/protocol/openid-connect`;
  const desired = {
    alias: channel.realm,
    displayName: channel.displayName,
    providerId: 'oidc',
    enabled: true,
    hideOnLogin: true,
    trustEmail: false,
    storeToken: false,
    linkOnly: true,
    config: {
      issuer,
      authorizationUrl: `${issuer}/protocol/openid-connect/auth`,
      tokenUrl: `${internal}/token`,
      jwksUrl: `${internal}/certs`,
      useJwksUrl: 'true',
      validateSignature: 'true',
      clientId: realm, // audiencia que deben traer las client assertions (allowClientIdAsAudience)
      clientAuthMethod: 'private_key_jwt',
      supportsClientAssertions: 'true',
      supportsClientAssertionReuse: 'false', // cada assertion se usa una sola vez (jti)
      allowClientIdAsAudience: 'true',
      federatedClientAssertionMaxExpiration: '300',
      syncMode: 'LEGACY',
    },
  };
  const existing = await kc('GET', `/${realm}/identity-provider/instances/${channel.realm}`, undefined, [200, 404]);
  if (!existing?.alias) {
    await kc('POST', `/${realm}/identity-provider/instances`, desired);
    return console.log(`+ Identity Provider ${channel.realm} registrado en ${realm} (client assertions)`);
  }
  const changed = Object.entries(desired.config).some(([k, v]) => existing.config?.[k] !== v);
  if (changed) {
    await kc('PUT', `/${realm}/identity-provider/instances/${channel.realm}`, { ...existing, ...desired, config: { ...existing.config, ...desired.config } });
    console.log(`~ Identity Provider ${channel.realm} actualizado en ${realm}`);
  }
}

// Scope OAuth de permiso: solo se incluye en el token si el service account tiene alguno de los
// roles de su pestaña "Scope" (Keycloak omite los client scopes con role scope mappings que el
// usuario no tiene)
async function ensurePermissionScope(realm, scope) {
  let current = (await kc('GET', `/${realm}/client-scopes`)).find((s) => s.name === scope.name);
  if (!current) {
    await kc('POST', `/${realm}/client-scopes`, {
      name: scope.name,
      description: scope.description,
      protocol: 'openid-connect',
      attributes: { 'include.in.token.scope': 'true', 'display.on.consent.screen': 'false' },
    });
    current = (await kc('GET', `/${realm}/client-scopes`)).find((s) => s.name === scope.name);
    console.log(`+ Scope ${scope.name} creado en ${realm}`);
  }
  const desiredRoles = CHANNELS.filter((c) => c.permissions.includes(scope.name)).map(roleOfChannel);
  const mapped = await kc('GET', `/${realm}/client-scopes/${current.id}/scope-mappings/realm`);
  const extra = mapped.filter((r) => !desiredRoles.includes(r.name));
  const missing = [];
  for (const name of desiredRoles.filter((n) => !mapped.some((r) => r.name === n))) {
    missing.push(await kc('GET', `/${realm}/roles/${encodeURIComponent(name)}`));
  }
  if (missing.length) await kc('POST', `/${realm}/client-scopes/${current.id}/scope-mappings/realm`, missing);
  if (extra.length) await kc('DELETE', `/${realm}/client-scopes/${current.id}/scope-mappings/realm`, extra);
  if (missing.length || extra.length) console.log(`~ Scope ${scope.name} en ${realm}: roles ${desiredRoles.join(', ') || '(ninguno)'}`);
  return current.id;
}

// Reino de API: cliente del canal autenticado con "Signed JWT - Federated": no tiene secreto; se
// autentica con un token del reino del canal cuyo sub es el service account del canal
async function ensureChannelClient(realm, channel, federatedSubject, permissionScopeIds) {
  const client = await upsertClient(realm, {
    clientId: channel.name,
    name: channel.description,
    description: `Se autentica con tokens de ${channel.realm} (federated client authentication, RFC 7523)`,
    protocol: 'openid-connect',
    publicClient: false,
    clientAuthenticatorType: 'federated-jwt',
    serviceAccountsEnabled: true,
    standardFlowEnabled: false,
    directAccessGrantsEnabled: false,
    attributes: { 'jwt.credential.issuer': channel.realm, 'jwt.credential.sub': federatedSubject },
  });
  for (const id of permissionScopeIds) await kc('PUT', `/${realm}/clients/${client.id}/default-client-scopes/${id}`);
  const serviceAccount = await kc('GET', `/${realm}/clients/${client.id}/service-account-user`);
  await assignRealmRoles(realm, serviceAccount.id, [roleOfChannel(channel)]);
}

async function setupChannels() {
  const subjects = {};
  for (const channel of CHANNELS) subjects[channel.name] = await setupChannelRealm(channel);

  for (const { realm } of REALMS) {
    for (const channel of CHANNELS) {
      await ensureRealmRole(realm, roleOfChannel(channel), `Permisos de ${channel.name} en ${realm}`);
      await ensureChannelIdentityProvider(realm, channel);
    }
    const scopeIds = [];
    for (const scope of SCOPES.filter((s) => realmOfScope(s.name) === realm)) scopeIds.push(await ensurePermissionScope(realm, scope));
    for (const channel of CHANNELS) await ensureChannelClient(realm, channel, subjects[channel.name], scopeIds);
  }
}

export async function setupKeycloak() {
  await authenticate();
  await ensureSslRequired('master'); // consola de administración
  for (const realm of REALMS) {
    await ensureRealm(realm);
    const audienceScopeId = await ensureAudienceScope(realm.realm, realm.product.name);
    const defaultScopeId = await ensureDefaultScope(realm.realm);
    await ensureWso2Client(realm.realm, audienceScopeId, defaultScopeId);
  }
  await setupChannels();
}
