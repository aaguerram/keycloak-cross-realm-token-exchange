// Llamadas a los productos de WSO2 con el token del reino que corresponde a cada producto
import { GATEWAY_URL, PRODUCTS, type Product } from './config';
import { newTokenChain, tokenFor, type Step } from './oauth';
import { tracedFetch, type Trace } from './trace';

export type ApiResult<T> = { status: number; data?: T; error?: string };

export async function callApi<T>(product: Product, path: string): Promise<ApiResult<T>> {
  const { realm, context } = PRODUCTS[product];
  let accessToken: string;
  try {
    ({ accessToken } = await tokenFor(realm));
  } catch (err) {
    return { status: 0, error: (err as Error).message };
  }
  return send<T>(context, path, accessToken);
}

export type FreshResult<T> = ApiResult<T> & { steps?: Step[]; trace: Trace };

// Igual que callApi, pero genera una cadena de tokens nueva y devuelve, junto con la respuesta, el
// registro de todas las llamadas HTTP (2 a Keycloak y 1 al gateway)
export async function callApiFresh<T>(product: Product, path: string): Promise<FreshResult<T>> {
  const { realm, context } = PRODUCTS[product];
  const trace: Trace = [];
  let chain;
  try {
    chain = await newTokenChain(realm, trace);
  } catch (err) {
    return { status: 0, error: (err as Error).message, trace };
  }
  return { ...(await send<T>(context, path, chain.accessToken, trace)), steps: chain.steps, trace };
}

async function send<T>(context: string, path: string, accessToken: string, trace?: Trace): Promise<ApiResult<T>> {
  const info = {
    title: `WSO2 gateway · GET ${context}${path}`,
    description: 'El gateway valida el token (emisor = Key Manager del reino, audiencia del producto, suscripción de la aplicación por azp y scope del recurso) y reenvía al backend.',
  };
  let res: Response;
  try {
    res = await tracedFetch(trace, info, `${GATEWAY_URL}${context}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
  } catch (err) {
    return { status: 0, error: (err as Error).message };
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  if (res.ok) return { status: res.status, data: body as T };
  // WSO2 (fault) → { code, message, description }; APIs → { Errors: [{ Code, Message }] }
  const b = body as { description?: string; message?: string; Errors?: { Message: string }[] } | undefined;
  return { status: res.status, error: b?.Errors?.[0]?.Message ?? b?.description ?? b?.message ?? res.statusText };
}
