// Movimientos de ejemplo. Estructura basada en BIAN "Position Keeping" (FinancialTransaction)
// con elementos de ISO 20022 camt.052/053 ReportEntry (Amount, CreditDebitIndicator, Status,
// BookingDate, ValueDate, BankTransactionCode, EntryDetails, RelatedParties, RemittanceInformation).
//
// Los datos son coherentes con cuentas-api: el saldo contable tras el último movimiento
// registrado (BOOK) coincide con el saldo ITBD de cada cuenta, y los movimientos pendientes
// (PDNG) explican la diferencia con el saldo disponible ITAV.

const OWN_BANK = { BICFI: 'BDEMECE1XXX', Name: 'Banco Demo S.A.' };
const OTHER_BANK = { BICFI: 'BLITECE1XXX', Name: 'Banco del Litoral S.A.' };

// Cuentas conocidas: titular, tarjeta de débito asociada y saldo contable actual (en centavos)
export const accounts = {
  '2200145678': { holder: 'María Fernanda Andrade López', card: '************4821', bookedBalance: 548045 },
  '2200198765': { holder: 'María Fernanda Andrade López', bookedBalance: 1875000 },
  '2200234567': { holder: 'Carlos Alberto Mendoza Ruiz', card: '************7310', bookedBalance: 84210 },
  '2200345678': { holder: 'Lucía Esperanza Vintimilla Cordero', card: '************0954', bookedBalance: 1235 },
  '1100456789': { holder: 'María Fernanda Andrade López', bookedBalance: 241080 },
  '1100567890': { holder: 'Comercializadora Andina S.A.', bookedBalance: 15230000 },
  '1100678901': { holder: 'Carlos Alberto Mendoza Ruiz', card: '************7310', bookedBalance: -32040 },
};

// Tipos de movimiento → ISO 20022 BankTransactionCode (Domain / Family / SubFamily) + código propietario
const KINDS = {
  salary: { cdi: 'CRDT', domain: 'PMNT', family: 'RCDT', sub: 'SALA', proprietary: 'NOMINA', channel: 'SYSTEM' },
  transfer_in: { cdi: 'CRDT', domain: 'PMNT', family: 'RCDT', sub: 'DMCT', proprietary: 'TRF-RECIBIDA', channel: 'ONLINE_BANKING' },
  transfer_out: { cdi: 'DBIT', domain: 'PMNT', family: 'ICDT', sub: 'DMCT', proprietary: 'TRF-ENVIADA', channel: 'ONLINE_BANKING' },
  internal_in: { cdi: 'CRDT', domain: 'PMNT', family: 'RCDT', sub: 'BOOK', proprietary: 'TRF-INTERNA', channel: 'SYSTEM' },
  internal_out: { cdi: 'DBIT', domain: 'PMNT', family: 'ICDT', sub: 'BOOK', proprietary: 'TRF-INTERNA', channel: 'SYSTEM' },
  bill: { cdi: 'DBIT', domain: 'PMNT', family: 'ICDT', sub: 'DMCT', proprietary: 'PAGO-SERVICIO', channel: 'MOBILE_BANKING' },
  pos: { cdi: 'DBIT', domain: 'PMNT', family: 'CCRD', sub: 'POSD', proprietary: 'COMPRA-TARJETA', channel: 'POS' },
  atm: { cdi: 'DBIT', domain: 'PMNT', family: 'CCRD', sub: 'CWDL', proprietary: 'RETIRO-ATM', channel: 'ATM' },
  cash_deposit: { cdi: 'CRDT', domain: 'PMNT', family: 'CNTR', sub: 'CDPT', proprietary: 'DEPOSITO-EFECTIVO', channel: 'BRANCH' },
  cheque: { cdi: 'DBIT', domain: 'PMNT', family: 'ICHQ', sub: 'CCHQ', proprietary: 'CHEQUE-PAGADO', channel: 'BRANCH' },
  interest: { cdi: 'CRDT', domain: 'ACMT', family: 'MCOP', sub: 'INTR', proprietary: 'INTERES', channel: 'SYSTEM' },
  fee: { cdi: 'DBIT', domain: 'ACMT', family: 'MDOP', sub: 'CHRG', proprietary: 'COMISION', channel: 'SYSTEM' },
};

// Movimientos por cuenta (orden cronológico). `party` es la contraparte; `e2e` enlaza las dos
// patas de una transferencia entre cuentas del mismo banco.
const raw = {
  '2200145678': [
    { at: '2026-08-25T08:30:00-05:00', kind: 'salary', amount: '2850.00', description: 'Pago de nómina agosto 2026', party: { name: 'Tecnología Andina Cía. Ltda.', account: '3300123456', agent: OTHER_BANK } },
    { at: '2026-08-28T19:12:00-05:00', kind: 'bill', amount: '45.60', description: 'Pago planilla de energía eléctrica', party: { name: 'Empresa Eléctrica Regional', account: '0000778899', agent: OTHER_BANK }, remittance: 'Contrato 4455120 - periodo 08/2026' },
    { at: '2026-08-31T23:59:00-05:00', kind: 'interest', amount: '5.98', description: 'Capitalización de intereses agosto 2026' },
    { at: '2026-09-02T10:05:00-05:00', kind: 'internal_out', amount: '600.00', description: 'Transferencia a Carlos Mendoza', party: { name: 'Carlos Alberto Mendoza Ruiz', account: '2200234567', agent: OWN_BANK }, e2e: 'E2E20260902BDEM000187', remittance: 'Préstamo personal', channel: 'MOBILE_BANKING' },
    { at: '2026-09-05T13:47:00-05:00', kind: 'pos', amount: '87.35', description: 'Compra Supermercado La Colina', merchant: { name: 'Supermercado La Colina', mcc: '5411', town: 'Quito' } },
    { at: '2026-09-10T18:22:00-05:00', kind: 'atm', amount: '200.00', description: 'Retiro en cajero automático', atm: { id: 'ATM-UIO-0231', location: 'C.C. El Bosque, Quito' } },
    { at: '2026-09-15T09:40:00-05:00', kind: 'transfer_in', amount: '150.00', description: 'Transferencia recibida de Andrés Salazar', party: { name: 'Andrés Salazar Vega', account: '4400556677', agent: OTHER_BANK }, remittance: 'Devolución cena' },
    { at: '2026-09-20T00:05:00-05:00', kind: 'fee', amount: '0.36', description: 'Comisión envío de estado de cuenta físico' },
    { at: '2026-09-21T20:14:00-05:00', kind: 'pos', amount: '250.00', status: 'PDNG', description: 'Compra Tienda Deportiva Andes (autorización pendiente)', merchant: { name: 'Tienda Deportiva Andes', mcc: '5941', town: 'Quito' } },
  ],
  '2200198765': [
    { at: '2026-07-01T06:00:00-05:00', kind: 'internal_in', amount: '500.00', description: 'Depósito programado Meta Vivienda', party: { name: 'María Fernanda Andrade López', account: '1100456789', agent: OWN_BANK }, e2e: 'E2E20260701BDEM000011' },
    { at: '2026-07-10T23:59:00-05:00', kind: 'interest', amount: '238.44', description: 'Pago de intereses trimestral' },
    { at: '2026-08-01T06:00:00-05:00', kind: 'internal_in', amount: '500.00', description: 'Depósito programado Meta Vivienda', party: { name: 'María Fernanda Andrade López', account: '1100456789', agent: OWN_BANK }, e2e: 'E2E20260801BDEM000009' },
    { at: '2026-09-01T06:00:00-05:00', kind: 'internal_in', amount: '500.00', description: 'Depósito programado Meta Vivienda', party: { name: 'María Fernanda Andrade López', account: '1100456789', agent: OWN_BANK }, e2e: 'E2E20260901BDEM000014' },
  ],
  '2200234567': [
    { at: '2026-08-30T08:00:00-05:00', kind: 'salary', amount: '1450.00', description: 'Pago de nómina agosto 2026', party: { name: 'Importadora del Pacífico S.A.', account: '5500889900', agent: OTHER_BANK } },
    { at: '2026-08-31T23:59:00-05:00', kind: 'interest', amount: '1.12', description: 'Capitalización de intereses agosto 2026' },
    { at: '2026-09-02T10:05:00-05:00', kind: 'internal_in', amount: '600.00', description: 'Transferencia recibida de María Andrade', party: { name: 'María Fernanda Andrade López', account: '2200145678', agent: OWN_BANK }, e2e: 'E2E20260902BDEM000187', remittance: 'Préstamo personal' },
    { at: '2026-09-03T12:30:00-05:00', kind: 'bill', amount: '900.00', description: 'Pago tarjeta de crédito', party: { name: 'Banco del Litoral S.A. - Tarjetas', account: '9900001122', agent: OTHER_BANK }, remittance: 'Tarjeta terminada en 5567' },
    { at: '2026-09-06T21:10:00-05:00', kind: 'atm', amount: '200.00', description: 'Retiro en cajero automático', atm: { id: 'ATM-GYE-0112', location: 'Av. Francisco de Orellana, Guayaquil' } },
    { at: '2026-09-12T17:45:00-05:00', kind: 'pos', amount: '63.90', description: 'Compra Farmacia San Andrés', merchant: { name: 'Farmacia San Andrés', mcc: '5912', town: 'Guayaquil' } },
    { at: '2026-09-18T11:20:00-05:00', kind: 'internal_out', amount: '150.00', description: 'Transferencia a cuenta corriente propia', party: { name: 'Carlos Alberto Mendoza Ruiz', account: '1100678901', agent: OWN_BANK }, e2e: 'E2E20260918BDEM000342', channel: 'ONLINE_BANKING' },
    { at: '2026-09-21T10:02:00-05:00', kind: 'cash_deposit', amount: '80.00', description: 'Depósito en efectivo en ventanilla', branch: 'Agencia Kennedy Guayaquil' },
  ],
  '2200345678': [
    { at: '2024-10-31T23:59:00-05:00', kind: 'interest', amount: '0.02', description: 'Capitalización de intereses octubre 2024' },
    { at: '2024-11-15T16:40:00-05:00', kind: 'atm', amount: '40.00', description: 'Retiro en cajero automático', atm: { id: 'ATM-CUE-0045', location: 'Parque Calderón, Cuenca' } },
    { at: '2024-11-30T00:05:00-05:00', kind: 'fee', amount: '1.50', description: 'Comisión mantenimiento de cuenta inactiva' },
  ],
  '1100456789': [
    { at: '2026-07-01T06:00:00-05:00', kind: 'internal_out', amount: '500.00', description: 'Débito automático ahorro programado', party: { name: 'María Fernanda Andrade López', account: '2200198765', agent: OWN_BANK }, e2e: 'E2E20260701BDEM000011' },
    { at: '2026-08-01T06:00:00-05:00', kind: 'internal_out', amount: '500.00', description: 'Débito automático ahorro programado', party: { name: 'María Fernanda Andrade López', account: '2200198765', agent: OWN_BANK }, e2e: 'E2E20260801BDEM000009' },
    { at: '2026-08-05T11:15:00-05:00', kind: 'cheque', amount: '350.00', description: 'Cheque pagado No. 000151', cheque: '000151', party: { name: 'Inmobiliaria Los Álamos' } },
    { at: '2026-08-15T15:00:00-05:00', kind: 'internal_in', amount: '1800.00', description: 'Honorarios consultoría julio 2026', party: { name: 'Comercializadora Andina S.A.', account: '1100567890', agent: OWN_BANK }, e2e: 'E2E20260815BDEM000256', remittance: 'Factura 001-001-000000321' },
    { at: '2026-09-01T06:00:00-05:00', kind: 'internal_out', amount: '500.00', description: 'Débito automático ahorro programado', party: { name: 'María Fernanda Andrade López', account: '2200198765', agent: OWN_BANK }, e2e: 'E2E20260901BDEM000014' },
    { at: '2026-09-05T00:05:00-05:00', kind: 'fee', amount: '2.50', description: 'Comisión mantenimiento cuenta corriente' },
    { at: '2026-09-21T09:30:00-05:00', kind: 'bill', amount: '120.45', description: 'Pago servicio de internet', party: { name: 'NetAndes Telecomunicaciones', account: '0000123987', agent: OTHER_BANK }, remittance: 'Cliente 88213 - septiembre 2026' },
    { at: '2026-09-22T10:10:00-05:00', kind: 'cheque', amount: '100.00', status: 'PDNG', description: 'Cheque No. 000152 en proceso de compensación', cheque: '000152', party: { name: 'Jorge Luis Paredes' } },
  ],
  '1100567890': [
    { at: '2026-08-15T15:00:00-05:00', kind: 'internal_out', amount: '1800.00', description: 'Pago honorarios consultoría', party: { name: 'María Fernanda Andrade López', account: '1100456789', agent: OWN_BANK }, e2e: 'E2E20260815BDEM000256', remittance: 'Factura 001-001-000000321' },
    { at: '2026-09-05T09:20:00-05:00', kind: 'transfer_in', amount: '45200.00', description: 'Cobro factura 001-002-000004521', party: { name: 'Distribuidora Costa Norte S.A.', account: '6600443322', agent: OTHER_BANK }, remittance: 'Factura 001-002-000004521' },
    { at: '2026-09-10T07:00:00-05:00', kind: 'transfer_out', amount: '28750.50', description: 'Pago nómina septiembre 2026 (lote 45 empleados)', party: { name: 'Nómina Comercializadora Andina (45 beneficiarios)' }, remittance: 'Lote de nómina 2026-09' },
    { at: '2026-09-15T14:05:00-05:00', kind: 'cheque', amount: '5600.00', description: 'Cheque pagado No. 004501', cheque: '004501', party: { name: 'Transportes Sierra Norte' } },
    { at: '2026-09-18T17:30:00-05:00', kind: 'cash_deposit', amount: '12450.00', description: 'Depósito de recaudación diaria', branch: 'Matriz Quito' },
    { at: '2026-09-20T00:05:00-05:00', kind: 'fee', amount: '15.00', description: 'Comisión mantenimiento cuenta corriente empresarial' },
    { at: '2026-09-22T08:45:00-05:00', kind: 'transfer_in', amount: '8900.00', description: 'Cobro factura 001-002-000004588', party: { name: 'Supermercados del Valle S.A.', account: '7700112233', agent: OTHER_BANK }, remittance: 'Factura 001-002-000004588' },
    { at: '2026-09-22T09:15:00-05:00', kind: 'transfer_out', amount: '3379.67', status: 'PDNG', description: 'Pago a proveedor Plásticos del Sur (en proceso)', party: { name: 'Plásticos del Sur Cía. Ltda.', account: '8800223344', agent: OTHER_BANK }, remittance: 'Orden de compra OC-2026-0877' },
  ],
  '1100678901': [
    { at: '2026-08-10T12:00:00-05:00', kind: 'transfer_in', amount: '250.00', description: 'Transferencia recibida de Patricia Ruiz', party: { name: 'Patricia Ruiz Cedeño', account: '4400998877', agent: OTHER_BANK } },
    { at: '2026-08-25T10:30:00-05:00', kind: 'bill', amount: '620.00', description: 'Pago cuota crédito vehicular', party: { name: 'Automotores del Guayas S.A.', account: '0000556611', agent: OTHER_BANK }, remittance: 'Crédito 20231144 - cuota 34/48' },
    { at: '2026-09-05T00:05:00-05:00', kind: 'fee', amount: '2.50', description: 'Comisión mantenimiento cuenta corriente' },
    { at: '2026-09-08T19:25:00-05:00', kind: 'pos', amount: '77.90', description: 'Compra Gasolinera Ruta Sur', merchant: { name: 'Gasolinera Ruta Sur', mcc: '5541', town: 'Guayaquil' } },
    { at: '2026-09-12T13:00:00-05:00', kind: 'bill', amount: '200.00', description: 'Pago tarjeta de crédito', party: { name: 'Banco del Litoral S.A. - Tarjetas', account: '9900001122', agent: OTHER_BANK }, remittance: 'Tarjeta terminada en 5567' },
    { at: '2026-09-18T11:20:00-05:00', kind: 'internal_in', amount: '150.00', description: 'Transferencia desde cuenta de ahorros propia', party: { name: 'Carlos Alberto Mendoza Ruiz', account: '2200234567', agent: OWN_BANK }, e2e: 'E2E20260918BDEM000342' },
  ],
};

// ---------- Construcción de los movimientos con estructura ISO 20022 ----------

const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => (Math.abs(cents) / 100).toFixed(2);
const money = (cents) => ({ Amount: fromCents(cents), Currency: 'USD' });

function relatedParties(accountNumber, t, cdi) {
  if (!t.party) return {};
  const holder = { Party: { Name: accounts[accountNumber].holder }, Account: { Identification: accountNumber, SchemeName: 'BBAN' }, Agent: OWN_BANK };
  const counterparty = {
    Party: { Name: t.party.name },
    ...(t.party.account && { Account: { Identification: t.party.account, SchemeName: 'BBAN' } }),
    ...(t.party.agent && { Agent: t.party.agent }),
  };
  const [debtor, creditor] = cdi === 'CRDT' ? [counterparty, holder] : [holder, counterparty];
  return {
    RelatedParties: {
      Debtor: debtor.Party,
      ...(debtor.Account && { DebtorAccount: debtor.Account }),
      Creditor: creditor.Party,
      ...(creditor.Account && { CreditorAccount: creditor.Account }),
    },
    ...((debtor.Agent || creditor.Agent) && {
      RelatedAgents: {
        ...(debtor.Agent && { DebtorAgent: debtor.Agent }),
        ...(creditor.Agent && { CreditorAgent: creditor.Agent }),
      },
    }),
  };
}

function cardTransaction(accountNumber, t) {
  if (!t.merchant && !t.atm) return {};
  return {
    CardTransaction: {
      Card: { MaskedPAN: accounts[accountNumber].card, CardScheme: 'MASTERCARD', CardType: 'DEBIT' },
      ...(t.merchant && { Merchant: { Name: t.merchant.name, MerchantCategoryCode: t.merchant.mcc, TownName: t.merchant.town, Country: 'EC' } }),
      ...(t.atm && { ATM: { Identification: t.atm.id, Location: t.atm.location, Country: 'EC' } }),
    },
  };
}

function build() {
  const entries = [];
  for (const [accountNumber, list] of Object.entries(raw)) {
    // Saldo contable hacia atrás desde el saldo actual: el último BOOK termina en ITBD
    let balance = accounts[accountNumber].bookedBalance;
    const withBalance = [...list].reverse().map((t) => {
      const kind = KINDS[t.kind];
      const status = t.status ?? 'BOOK';
      const signed = kind.cdi === 'CRDT' ? toCents(t.amount) : -toCents(t.amount);
      let balanceAfter;
      if (status === 'BOOK') {
        balanceAfter = balance;
        balance -= signed;
      }
      return { accountNumber, t, kind, status, balanceAfter };
    });
    entries.push(...withBalance.reverse());
  }

  // Id global en orden cronológico
  entries.sort((a, b) => new Date(a.t.at) - new Date(b.t.at));

  return entries.map(({ accountNumber, t, kind, status, balanceAfter }, i) => {
    const id = `MOV-${t.at.slice(0, 10).replaceAll('-', '')}-${String(i + 1).padStart(6, '0')}`;
    const references = {
      AccountServicerReference: id,
      ...(t.e2e && { EndToEndIdentification: t.e2e }),
      ...(!t.e2e && t.party?.account && { EndToEndIdentification: `E2E${t.at.slice(0, 10).replaceAll('-', '')}${String(i + 1).padStart(9, '0')}` }),
      ...(t.cheque && { ChequeNumber: t.cheque }),
    };
    return {
      TransactionIdentification: id,
      AccountIdentification: { Identification: accountNumber, SchemeName: 'BBAN' },
      Amount: money(toCents(t.amount)),
      CreditDebitIndicator: kind.cdi,
      Status: status,
      BookingDate: t.at,
      ValueDate: t.at.slice(0, 10),
      BankTransactionCode: {
        Domain: { Code: kind.domain, Family: { Code: kind.family, SubFamilyCode: kind.sub } },
        Proprietary: { Code: kind.proprietary, Issuer: OWN_BANK.BICFI },
      },
      TransactionDescription: t.description,
      Channel: t.channel ?? kind.channel,
      ...(balanceAfter !== undefined && {
        BalanceAfterTransaction: { Amount: money(balanceAfter), CreditDebitIndicator: balanceAfter < 0 ? 'DBIT' : 'CRDT' },
      }),
      EntryDetails: {
        References: references,
        ...relatedParties(accountNumber, t, kind.cdi),
        ...cardTransaction(accountNumber, t),
        ...(t.remittance && { RemittanceInformation: { Unstructured: [t.remittance] } }),
        ...(t.branch && { Branch: { Name: t.branch } }),
      },
    };
  });
}

export const transactions = build();

export const findTransaction = (id) => transactions.find((t) => t.TransactionIdentification === id);

export const transactionsByAccount = (accountNumber) =>
  transactions
    .filter((t) => t.AccountIdentification.Identification === accountNumber)
    .sort((a, b) => new Date(b.BookingDate) - new Date(a.BookingDate)); // más reciente primero
