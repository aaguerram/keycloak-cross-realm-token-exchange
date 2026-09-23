import { error } from './response.js';

// Cédula (10 dígitos) o RUC (13 dígitos)
const PARTY_IDENTIFICATION_PATTERN = /^\d{10}(\d{3})?$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{10}$/;

export const validatePartyIdentification = (_req, res, next, id) =>
  PARTY_IDENTIFICATION_PATTERN.test(id)
    ? next()
    : error(res, 400, 'INVALID_IDENTIFICATION', 'La identificación debe ser una cédula (10 dígitos) o RUC (13 dígitos)');

export const validateAccountNumber = (_req, res, next, id) =>
  ACCOUNT_NUMBER_PATTERN.test(id)
    ? next()
    : error(res, 400, 'INVALID_ACCOUNT_NUMBER', 'El número de cuenta debe tener 10 dígitos');

// Resumen para listados: datos de identificación + saldo disponible
export const toAccountSummary = (referenceField) => (account) => ({
  [referenceField]: account[referenceField],
  AccountIdentification: account.AccountIdentification,
  AccountType: account.AccountType,
  AccountName: account.AccountName,
  ProductReference: account.ProductReference,
  AccountCurrency: account.AccountCurrency,
  AccountStatus: account.AccountStatus,
  AvailableBalance: account.Balance.find((b) => b.BalanceType === 'ITAV'),
});
