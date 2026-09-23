import { Router } from 'express';
import { savingsAccountsByParty, findSavingsAccount } from '../data/accounts.js';
import { ok, error } from '../lib/response.js';
import { validatePartyIdentification, validateAccountNumber, toAccountSummary } from '../lib/validation.js';

export const savingsAccountRouter = Router();

savingsAccountRouter.param('partyIdentification', validatePartyIdentification);
savingsAccountRouter.param('savingsAccountId', validateAccountNumber);

// BIAN: SavingsAccount/Retrieve filtrado por CustomerReference
savingsAccountRouter.get('/parties/:partyIdentification/savings-accounts', (req, res) => {
  const { partyIdentification } = req.params;
  const accounts = savingsAccountsByParty(partyIdentification).map(toAccountSummary('SavingsAccountFacilityReference'));
  ok(res, {
    CustomerReference: { PartyIdentification: { Identification: partyIdentification } },
    SavingsAccounts: accounts,
    TotalRecords: accounts.length,
  });
});

// BIAN: SavingsAccount/{savingsaccountid}/Retrieve
savingsAccountRouter.get('/savings-accounts/:savingsAccountId', (req, res) => {
  const account = findSavingsAccount(req.params.savingsAccountId);
  if (!account) return error(res, 404, 'ACCOUNT_NOT_FOUND', `No existe la cuenta de ahorros ${req.params.savingsAccountId}`);
  ok(res, { SavingsAccountFacility: account });
});
