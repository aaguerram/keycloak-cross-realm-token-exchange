import { Router } from 'express';
import { parties, findParty } from '../data/parties.js';
import { ok, error } from '../lib/response.js';

// Cédula (10 dígitos) o RUC (13 dígitos)
const IDENTIFICATION_PATTERN = /^\d{10}(\d{3})?$/;

const toSummary = ({ PartyReferenceDataDirectoryEntryReference, PartyReference, PartyLifecycleStatus }) => ({
  PartyReferenceDataDirectoryEntryReference,
  PartyReference,
  PartyLifecycleStatus,
});

export const partiesRouter = Router();

partiesRouter.param('partyIdentification', (req, res, next, id) => {
  if (!IDENTIFICATION_PATTERN.test(id)) {
    return error(res, 400, 'INVALID_IDENTIFICATION', 'La identificación debe ser una cédula (10 dígitos) o RUC (13 dígitos)');
  }
  req.party = findParty(id);
  if (!req.party) return error(res, 404, 'PARTY_NOT_FOUND', `No existe un cliente con identificación ${id}`);
  next();
});

// BIAN: PartyReferenceDataDirectory / Retrieve (colección)
partiesRouter.get('/parties', (_req, res) => {
  ok(res, { Parties: parties.map(toSummary), TotalRecords: parties.length });
});

// BIAN: PartyReferenceDataDirectory/{id}/Retrieve
partiesRouter.get('/parties/:partyIdentification', (req, res) => {
  ok(res, { Party: req.party });
});

// BIAN: PartyReferenceDataDirectory/{id}/Address/Retrieve
partiesRouter.get('/parties/:partyIdentification/addresses', (req, res) => {
  const { PartyReference, PostalAddress } = req.party;
  ok(res, {
    PartyIdentification: PartyReference.PartyIdentification,
    PartyName: PartyReference.PartyName.Name,
    PostalAddress,
    TotalRecords: PostalAddress.length,
  });
});
