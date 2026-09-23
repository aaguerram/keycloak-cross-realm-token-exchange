// Las cards de consulta necesitan saber qué scopes emite cada reino al canal para marcar en rojo las
// que no tiene; se calcula en el servidor en cada petición
import type { ReactNode } from 'react';
import { AccesoProvider } from '@/components/acceso';
import { channelAccess } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function ConsultaLayout({ children }: { children: ReactNode }) {
  return <AccesoProvider access={await channelAccess()}>{children}</AccesoProvider>;
}
