import { Router } from 'express';
import { accounts, transactionsByAccount, findTransaction } from '../data/transactions.js';
import { ok, error } from '../lib/response.js';

const ACCOUNT_NUMBER_PATTERN = /^\d{10}$/;
const TRANSACTION_ID_PATTERN = /^MOV-\d{8}-\d{6}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const isValidDate = (value) => DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));

const toSummary = (t) => ({
  TransactionIdentification: t.TransactionIdentification,
  Amount: t.Amount,
  CreditDebitIndicator: t.CreditDebitIndicator,
  Status: t.Status,
  BookingDate: t.BookingDate,
  ValueDate: t.ValueDate,
  BankTransactionCode: t.BankTransactionCode,
  TransactionDescription: t.TransactionDescription,
  Channel: t.Channel,
  ...(t.BalanceAfterTransaction && { BalanceAfterTransaction: t.BalanceAfterTransaction }),
});

// Lee y valida los filtros opcionales; devuelve { filters } o { message } si alguno es inválido
function parseQuery(query) {
  const { fromBookingDate, toBookingDate, creditDebitIndicator, status } = query;
  if (fromBookingDate !== undefined && !isValidDate(fromBookingDate)) return { message: 'fromBookingDate debe tener formato YYYY-MM-DD' };
  if (toBookingDate !== undefined && !isValidDate(toBookingDate)) return { message: 'toBookingDate debe tener formato YYYY-MM-DD' };
  if (fromBookingDate && toBookingDate && fromBookingDate > toBookingDate) return { message: 'fromBookingDate no puede ser posterior a toBookingDate' };
  if (creditDebitIndicator !== undefined && !['CRDT', 'DBIT'].includes(creditDebitIndicator)) return { message: 'creditDebitIndicator debe ser CRDT o DBIT' };
  if (status !== undefined && !['BOOK', 'PDNG'].includes(status)) return { message: 'status debe ser BOOK o PDNG' };

  const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return { message: `limit debe ser un entero entre 1 y ${MAX_LIMIT}` };
  if (!Number.isInteger(offset) || offset < 0) return { message: 'offset debe ser un entero mayor o igual a 0' };

  return { filters: { fromBookingDate, toBookingDate, creditDebitIndicator, status, limit, offset } };
}

export const transactionsRouter = Router();

// BIAN: PositionKeeping/{positionkeepingid}/FinancialTransaction/Retrieve (colección)
// No distingue entre ahorro y corriente: basta el número de cuenta.
transactionsRouter.get('/accounts/:accountNumber/transactions', (req, res) => {
  const { accountNumber } = req.params;
  if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
    return error(res, 400, 'INVALID_ACCOUNT_NUMBER', 'El número de cuenta debe tener 10 dígitos');
  }
  if (!accounts[accountNumber]) {
    return error(res, 404, 'ACCOUNT_NOT_FOUND', `No existe la cuenta ${accountNumber}`);
  }
  const { filters, message } = parseQuery(req.query);
  if (message) return error(res, 400, 'INVALID_QUERY_PARAMETER', message);

  const matching = transactionsByAccount(accountNumber).filter((t) => {
    const day = t.BookingDate.slice(0, 10);
    return (
      (!filters.fromBookingDate || day >= filters.fromBookingDate) &&
      (!filters.toBookingDate || day <= filters.toBookingDate) &&
      (!filters.creditDebitIndicator || t.CreditDebitIndicator === filters.creditDebitIndicator) &&
      (!filters.status || t.Status === filters.status)
    );
  });

  ok(res, {
    AccountIdentification: { Identification: accountNumber, SchemeName: 'BBAN' },
    Transactions: matching.slice(filters.offset, filters.offset + filters.limit).map(toSummary),
    Pagination: { Offset: filters.offset, Limit: filters.limit, TotalRecords: matching.length },
  });
});

// BIAN: PositionKeeping/{positionkeepingid}/FinancialTransaction/{financialtransactionid}/Retrieve
transactionsRouter.get('/transactions/:transactionId', (req, res) => {
  const { transactionId } = req.params;
  if (!TRANSACTION_ID_PATTERN.test(transactionId)) {
    return error(res, 400, 'INVALID_TRANSACTION_ID', 'El id de movimiento debe tener el formato MOV-YYYYMMDD-NNNNNN');
  }
  const transaction = findTransaction(transactionId);
  if (!transaction) return error(res, 404, 'TRANSACTION_NOT_FOUND', `No existe el movimiento ${transactionId}`);
  ok(res, { Transaction: transaction });
});
