// Todas las operaciones de los productos con el scope que exige el gateway (ver setup/config.mjs).
// La página las prueba todas para mostrar qué permite el rol del canal en cada reino.
import type { Product } from './config';

export type Operation = { scope: string; product: Product; label: string; path: string };

export const operations = (sample: { party: string; savings: string; current: string; account: string; transaction: string }): Operation[] => [
  { scope: 'party:list', product: 'cliente', label: 'Listar clientes', path: '/party-reference-data-directory/v1/parties' },
  { scope: 'party:read', product: 'cliente', label: 'Consultar cliente', path: `/party-reference-data-directory/v1/parties/${sample.party}` },
  { scope: 'party-address:read', product: 'cliente', label: 'Direcciones del cliente', path: `/party-reference-data-directory/v1/parties/${sample.party}/addresses` },
  { scope: 'savings-account:read', product: 'cuenta', label: 'Cuentas de ahorro del cliente', path: `/savings-account/v1/parties/${sample.party}/savings-accounts` },
  { scope: 'savings-account:read', product: 'cuenta', label: 'Detalle de cuenta de ahorro', path: `/savings-account/v1/savings-accounts/${sample.savings}` },
  { scope: 'current-account:read', product: 'cuenta', label: 'Cuentas corrientes del cliente', path: `/current-account/v1/parties/${sample.party}/current-accounts` },
  { scope: 'current-account:read', product: 'cuenta', label: 'Detalle de cuenta corriente', path: `/current-account/v1/current-accounts/${sample.current}` },
  { scope: 'transaction:list', product: 'cuenta', label: 'Movimientos de una cuenta', path: `/position-keeping/v1/accounts/${sample.account}/transactions?limit=5` },
  { scope: 'transaction:read', product: 'cuenta', label: 'Detalle de un movimiento', path: `/position-keeping/v1/transactions/${sample.transaction}` },
];
