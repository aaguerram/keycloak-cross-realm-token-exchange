// Scopes que cada reino de API emite hoy al canal: el reino solo los incluye si el rol del canal los
// habilita, así que son la fuente de verdad de lo que el canal puede consultar
import { CHANNEL, PRODUCTS } from './config';
import { tokenFor } from './oauth';

export type Access = { role: string; scopes: Record<string, string[]> };

export async function channelAccess(): Promise<Access> {
  const scopes: Record<string, string[]> = {};
  for (const { realm } of Object.values(PRODUCTS)) {
    scopes[realm] = await tokenFor(realm).then((t) => t.claims.scope?.split(' ') ?? [], () => []);
  }
  return { role: `perfil-${CHANNEL.name}`, scopes };
}
