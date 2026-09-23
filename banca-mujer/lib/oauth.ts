// Cadena de tokens del canal hacia un reino de API:
//   1. Client Credentials en el reino del canal (client_id + client_secret) con scope=aud-<reino destino>:
//      el token resultante tiene como única audiencia el reino destino
//   2. Client Credentials en el reino destino, autenticando al cliente con ese token como client
//      assertion (RFC 7523, "federated client authentication"): el reino destino valida la firma con
//      el JWKS del reino del canal y emite un token propio con los scopes que permiten sus roles
// La assertion solo se acepta una vez (jti), así que cada renovación repite la cadena. El token final
// se guarda hasta poco antes de vencer.
import { CHANNEL, KEYCLOAK_URL } from './config';
import { tracedFetch, type Trace } from './trace';

const JWT_BEARER = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

export type Claims = { jti?: string; iss: string; aud: string | string[]; sub: string; azp: string; scope?: string; exp: number; iat: number };
export type Step = { title: string; realm: string; grant: string; claims: Claims };
export type RealmToken = { accessToken: string; claims: Claims; steps: Step[] };

export const decode = (jwt: string): Claims => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

async function requestToken(
  realm: string,
  params: Record<string, string>,
  trace?: Trace,
  info = { title: `Keycloak ${realm}`, description: params.grant_type },
): Promise<string> {
  const res = await tracedFetch(trace, info, `${KEYCLOAK_URL}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    form: params,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${realm} (${params.grant_type}) → ${res.status} ${body.error}: ${body.error_description}`);
  return body.access_token;
}

// Ejecuta la cadena completa (2 tokens nuevos). La página Consulta la usa en cada botón, sin caché.
// Si se pasa `trace`, registra cada request/response.
export async function newTokenChain(targetRealm: string, trace?: Trace): Promise<RealmToken> {
  const assertion = await requestToken(
    CHANNEL.realm,
    { grant_type: 'client_credentials', client_id: CHANNEL.clientId, client_secret: CHANNEL.clientSecret, scope: `aud-${targetRealm}` },
    trace,
    {
      title: `Keycloak ${CHANNEL.realm} · Client Credentials`,
      description: `El canal se autentica en su propio reino con client_id y client_secret y pide scope=aud-${targetRealm}: el token tiene como única audiencia ${targetRealm}, requisito para usarlo como client assertion.`,
    },
  );
  const accessToken = await requestToken(
    targetRealm,
    { grant_type: 'client_credentials', client_assertion_type: JWT_BEARER, client_assertion: assertion },
    trace,
    {
      title: `Keycloak ${targetRealm} · Client assertion federada (RFC 7523)`,
      description: `${targetRealm} valida la firma del token de ${CHANNEL.realm} (su Identity Provider) y emite un token propio con los scopes que permite el rol del canal. No se envía ningún secreto.`,
    },
  );
  return {
    accessToken,
    claims: decode(accessToken),
    steps: [
      { title: 'Autenticación del canal', realm: CHANNEL.realm, grant: `client_credentials (client_secret), scope=aud-${targetRealm}`, claims: decode(assertion) },
      { title: 'Client assertion federada (RFC 7523)', realm: targetRealm, grant: 'client_credentials (client_assertion)', claims: decode(accessToken) },
    ],
  };
}

const cache = new Map<string, Promise<RealmToken>>();

export async function tokenFor(targetRealm: string): Promise<RealmToken> {
  const cached = cache.get(targetRealm);
  if (cached) {
    const token = await cached.catch(() => undefined);
    if (token && token.claims.exp - 30 > Date.now() / 1000) return token;
  }
  const pending = newTokenChain(targetRealm);
  cache.set(targetRealm, pending);
  pending.catch(() => cache.delete(targetRealm));
  return pending;
}
