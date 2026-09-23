// Configuración del canal. Las credenciales solo existen en el reino del canal: en reino-cliente y
// reino-cuenta el canal se autentica con client assertions emitidas por su propio reino.
export const CHANNEL = {
  name: process.env.CHANNEL_NAME ?? 'banca-empresa',
  title: process.env.CHANNEL_TITLE ?? 'Banca Empresa',
  realm: process.env.CHANNEL_REALM ?? 'reino-banca-empresa',
  clientId: process.env.CHANNEL_CLIENT_ID ?? 'banca-empresa',
  clientSecret: process.env.CHANNEL_CLIENT_SECRET ?? 'banca-empresa-secret',
};

// Keycloak y el gateway se consumen desde el servidor de Next.js (el navegador nunca ve tokens)
export const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? 'http://localhost:8180';
export const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:8280';

// Producto de WSO2 ↔ reino de Keycloak que emite sus tokens
export const PRODUCTS = {
  cliente: { realm: 'reino-cliente', context: '/pro-cliente/1.0.0' },
  cuenta: { realm: 'reino-cuenta', context: '/pro-cuenta/1.0.0' },
} as const;

export type Product = keyof typeof PRODUCTS;
