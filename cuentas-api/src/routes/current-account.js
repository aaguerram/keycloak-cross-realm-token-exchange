import { Router } from 'express';
import { currentAccountsByParty, findCurrentAccount } from '../data/accounts.js';
import { ok, error } from '../lib/response.js';
import { validatePartyIdentification, validateAccountNumber, toAccountSummary } from '../lib/validation.js';

export const currentAccountRouter = Router();

currentAccountRouter.param('partyIdentification', validatePartyIdentification);
currentAccountRouter.param('currentAccountId', validateAccountNumber);

// BIAN: CurrentAccount/Retrieve filtrado por CustomerReference
currentAccountRouter.get('/parties/:partyIdentification/current-accounts', (req, res) => {
  const { partyIdentification } = req.params;
  const accounts = currentAccountsByParty(partyIdentification).map(toAccountSummary('CurrentAccountFacilityReference'));
  ok(res, {
    CustomerReference: { PartyIdentification: { Identification: partyIdentification } },
    CurrentAccounts: accounts,
    TotalRecords: accounts.length,
  });
});

// BIAN: CurrentAccount/{currentaccountid}/Retrieve
currentAccountRouter.get('/current-accounts/:currentAccountId', (req, res) => {
  const account = findCurrentAccount(req.params.currentAccountId);
  if (!account) return error(res, 404, 'ACCOUNT_NOT_FOUND', `No existe la cuenta corriente ${req.params.currentAccountId}`);
  ok(res, { CurrentAccountFacility: account });
});
