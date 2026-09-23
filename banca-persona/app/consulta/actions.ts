'use server';
// Se ejecuta en el servidor. Cada llamada ejecuta la cadena completa (Client Credentials con
// scope=aud-<reino> → client assertion), genera 2 tokens nuevos y devuelve el registro de todas las llamadas.
import { callApiFresh } from '@/lib/gateway';
import type { Account, Address, CurrentAccountFacility, PartyDetail, PartyEntry, PartyReference, SavingsAccountFacility, Transaction } from '@/lib/types';

const PARTIES = '/party-reference-data-directory/v1/parties';

export async function listarClientes() {
  return callApiFresh<{ Parties: PartyEntry[]; TotalRecords: number }>('cliente', PARTIES);
}

export async function consultarCliente(id: string) {
  return callApiFresh<{ Party: PartyDetail }>('cliente', `${PARTIES}/${encodeURIComponent(String(id).trim())}`);
}

export async function consultarDirecciones(id: string) {
  return callApiFresh<{ PartyIdentification: PartyReference['PartyIdentification']; PartyName: string; PostalAddress: Address[]; TotalRecords: number }>(
    'cliente',
    `${PARTIES}/${encodeURIComponent(String(id).trim())}/addresses`,
  );
}

const e = (v: string) => encodeURIComponent(String(v).trim());

export async function consultarCuentasAhorro(id: string) {
  return callApiFresh<{ SavingsAccounts: Account[]; TotalRecords: number }>('cuenta', `/savings-account/v1/parties/${e(id)}/savings-accounts`);
}

export async function consultarCuentaAhorro(numero: string) {
  return callApiFresh<{ SavingsAccountFacility: SavingsAccountFacility }>('cuenta', `/savings-account/v1/savings-accounts/${e(numero)}`);
}

export async function consultarCuentasCorrientes(id: string) {
  return callApiFresh<{ CurrentAccounts: Account[]; TotalRecords: number }>('cuenta', `/current-account/v1/parties/${e(id)}/current-accounts`);
}

export async function consultarCuentaCorriente(numero: string) {
  return callApiFresh<{ CurrentAccountFacility: CurrentAccountFacility }>('cuenta', `/current-account/v1/current-accounts/${e(numero)}`);
}

export async function consultarMovimiento(transactionId: string) {
  return callApiFresh<{ Transaction: Transaction }>('cuenta', `/position-keeping/v1/transactions/${e(transactionId)}`);
}

export async function consultarMovimientosCuenta(numero: string) {
  return callApiFresh<{ Transactions: Transaction[]; Pagination: { Offset: number; Limit: number; TotalRecords: number } }>(
    'cuenta',
    `/position-keeping/v1/accounts/${e(numero)}/transactions?limit=10`,
  );
}
