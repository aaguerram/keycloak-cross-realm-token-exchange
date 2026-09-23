import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Menu } from '@/components/menu';
import { CHANNEL } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: CHANNEL.title,
  description: `${CHANNEL.title}: consulta de clientes, cuentas y movimientos a través de WSO2 con tokens de Keycloak`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="topbar">
          <h1>{CHANNEL.title}</h1>
          <small>
            Reino {CHANNEL.realm} · cliente {CHANNEL.clientId} · OAuth 2.0 Client Credentials
          </small>
        </div>
        <Menu />
        {children}
      </body>
    </html>
  );
}
