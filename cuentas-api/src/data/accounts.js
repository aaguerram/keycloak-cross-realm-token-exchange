// Datos de ejemplo. Estructura basada en BIAN "Savings Account" (SavingsAccountFacility)
// y "Current Account" (CurrentAccountFacility), con tipos y códigos de ISO 20022
// (CashAccountType SVGS/CACC, BalanceType, CreditDebitIndicator, AccountStatus, Frequency...).
const servicer = (branchId, branchName) => ({
  BICFI: 'BDEMECE1XXX',
  Name: 'Banco Demo S.A.',
  BranchIdentification: branchId,
  BranchName: branchName,
});

const customer = (Identification, IdentificationType, Name) => ({
  PartyIdentification: { Identification, IdentificationType },
  PartyName: Name,
});

const amount = (value, Currency = 'USD') => ({ Amount: value, Currency });

const balances = (available, booked, dateTime) => [
  { BalanceType: 'ITAV', Amount: amount(available), CreditDebitIndicator: 'CRDT', DateTime: dateTime },
  { BalanceType: 'ITBD', Amount: amount(booked), CreditDebitIndicator: 'CRDT', DateTime: dateTime },
];

export const savingsAccounts = [
  {
    SavingsAccountFacilityReference: '2200145678',
    AccountIdentification: { Identification: '2200145678', SchemeName: 'BBAN' },
    AccountType: 'SVGS',
    AccountName: 'Cuenta de Ahorros Transaccional',
    ProductReference: { ProductIdentification: 'AHO-TRX', ProductName: 'Ahorro Transaccional' },
    CustomerReference: customer('1710034065', 'NIDN', 'María Fernanda Andrade López'),
    AccountCurrency: 'USD',
    AccountStatus: 'ENAB',
    Servicer: servicer('001', 'Matriz Quito'),
    OpeningDate: '2016-03-15',
    LastActivityDate: '2026-09-20',
    Balance: balances('5230.45', '5480.45', '2026-09-22T08:00:00-05:00'),
    InterestRate: { RateType: 'Fixed', AnnualRate: '1.50', DayCountBasis: 'Actual/365', PaymentFrequency: 'MNTH', AccruedInterest: amount('6.42') },
    SavingsAccountFeatures: {
      MinimumBalance: amount('10.00'),
      DailyWithdrawalLimit: amount('1000.00'),
      MonthlyWithdrawalCountLimit: 30,
    },
    StatementFrequency: 'MNTH',
  },
  {
    SavingsAccountFacilityReference: '2200198765',
    AccountIdentification: { Identification: '2200198765', SchemeName: 'BBAN' },
    AccountType: 'SVGS',
    AccountName: 'Ahorro Programado Meta Vivienda',
    ProductReference: { ProductIdentification: 'AHO-PROG', ProductName: 'Ahorro Programado' },
    CustomerReference: customer('1710034065', 'NIDN', 'María Fernanda Andrade López'),
    AccountCurrency: 'USD',
    AccountStatus: 'ENAB',
    Servicer: servicer('001', 'Matriz Quito'),
    OpeningDate: '2023-01-10',
    MaturityDate: '2028-01-10',
    LastActivityDate: '2026-09-01',
    Balance: balances('18750.00', '18750.00', '2026-09-22T08:00:00-05:00'),
    InterestRate: { RateType: 'Fixed', AnnualRate: '5.25', DayCountBasis: 'Actual/365', PaymentFrequency: 'QURT', AccruedInterest: amount('243.10') },
    SavingsAccountFeatures: {
      MinimumBalance: amount('0.00'),
      ScheduledDeposit: { Amount: amount('500.00'), Frequency: 'MNTH', NextDate: '2026-10-01' },
      TargetAmount: amount('30000.00'),
      WithdrawalRestricted: true,
    },
    StatementFrequency: 'QURT',
  },
  {
    SavingsAccountFacilityReference: '2200234567',
    AccountIdentification: { Identification: '2200234567', SchemeName: 'BBAN' },
    AccountType: 'SVGS',
    AccountName: 'Cuenta de Ahorros Transaccional',
    ProductReference: { ProductIdentification: 'AHO-TRX', ProductName: 'Ahorro Transaccional' },
    CustomerReference: customer('0912345675', 'NIDN', 'Carlos Alberto Mendoza Ruiz'),
    AccountCurrency: 'USD',
    AccountStatus: 'ENAB',
    Servicer: servicer('020', 'Agencia Kennedy Guayaquil'),
    OpeningDate: '2012-08-22',
    LastActivityDate: '2026-09-21',
    Balance: balances('842.10', '842.10', '2026-09-22T08:00:00-05:00'),
    InterestRate: { RateType: 'Fixed', AnnualRate: '1.50', DayCountBasis: 'Actual/365', PaymentFrequency: 'MNTH', AccruedInterest: amount('1.04') },
    SavingsAccountFeatures: {
      MinimumBalance: amount('10.00'),
      DailyWithdrawalLimit: amount('1000.00'),
      MonthlyWithdrawalCountLimit: 30,
    },
    StatementFrequency: 'MNTH',
  },
  {
    SavingsAccountFacilityReference: '2200345678',
    AccountIdentification: { Identification: '2200345678', SchemeName: 'BBAN' },
    AccountType: 'SVGS',
    AccountName: 'Cuenta de Ahorros Transaccional',
    ProductReference: { ProductIdentification: 'AHO-TRX', ProductName: 'Ahorro Transaccional' },
    CustomerReference: customer('0102030405', 'NIDN', 'Lucía Esperanza Vintimilla Cordero'),
    AccountCurrency: 'USD',
    AccountStatus: 'DISA',
    Servicer: servicer('030', 'Agencia Centro Cuenca'),
    OpeningDate: '2018-05-02',
    LastActivityDate: '2024-11-30',
    Balance: balances('12.35', '12.35', '2026-09-22T08:00:00-05:00'),
    InterestRate: { RateType: 'Fixed', AnnualRate: '1.50', DayCountBasis: 'Actual/365', PaymentFrequency: 'MNTH', AccruedInterest: amount('0.00') },
    SavingsAccountFeatures: {
      MinimumBalance: amount('10.00'),
      DailyWithdrawalLimit: amount('1000.00'),
      MonthlyWithdrawalCountLimit: 30,
    },
    StatementFrequency: 'MNTH',
  },
];

export const currentAccounts = [
  {
    CurrentAccountFacilityReference: '1100456789',
    AccountIdentification: { Identification: '1100456789', SchemeName: 'BBAN' },
    AccountType: 'CACC',
    AccountName: 'Cuenta Corriente Personal',
    ProductReference: { ProductIdentification: 'CTE-PER', ProductName: 'Corriente Personal' },
    CustomerReference: customer('1710034065', 'NIDN', 'María Fernanda Andrade López'),
    AccountCurrency: 'USD',
    AccountStatus: 'ENAB',
    Servicer: servicer('001', 'Matriz Quito'),
    OpeningDate: '2019-06-01',
    LastActivityDate: '2026-09-21',
    Balance: balances('2310.80', '2410.80', '2026-09-22T08:00:00-05:00'),
    OverdraftFacility: {
      OverdraftLimit: amount('1500.00'),
      OverdraftUsed: amount('0.00'),
      OverdraftInterestRate: { RateType: 'Fixed', AnnualRate: '15.60', DayCountBasis: 'Actual/360' },
    },
    ChequeBook: { ChequeBookEnabled: true, LastChequeBookIssueDate: '2026-02-14', ChequeNumberRange: { From: '000151', To: '000200' } },
    ServiceCharge: { MonthlyMaintenanceFee: amount('2.50'), ChargeFrequency: 'MNTH' },
    StatementFrequency: 'MNTH',
  },
  {
    CurrentAccountFacilityReference: '1100567890',
    AccountIdentification: { Identification: '1100567890', SchemeName: 'BBAN' },
    AccountType: 'CACC',
    AccountName: 'Cuenta Corriente Empresarial',
    ProductReference: { ProductIdentification: 'CTE-EMP', ProductName: 'Corriente Empresarial' },
    CustomerReference: customer('1790012345001', 'TXID', 'Comercializadora Andina S.A.'),
    AccountCurrency: 'USD',
    AccountStatus: 'ENAB',
    Servicer: servicer('001', 'Matriz Quito'),
    OpeningDate: '2008-03-01',
    LastActivityDate: '2026-09-22',
    Balance: balances('148920.33', '152300.00', '2026-09-22T08:00:00-05:00'),
    OverdraftFacility: {
      OverdraftLimit: amount('50000.00'),
      OverdraftUsed: amount('0.00'),
      OverdraftInterestRate: { RateType: 'Variable', AnnualRate: '11.83', DayCountBasis: 'Actual/360' },
    },
    ChequeBook: { ChequeBookEnabled: true, LastChequeBookIssueDate: '2026-08-30', ChequeNumberRange: { From: '004501', To: '005000' } },
    ServiceCharge: { MonthlyMaintenanceFee: amount('15.00'), ChargeFrequency: 'MNTH' },
    AuthorisedSignatories: [
      { PartyName: 'Roberto Salazar Pérez', PartyIdentification: { Identification: '1703456789', IdentificationType: 'NIDN' }, SignatoryRole: 'Primary' },
      { PartyName: 'Ana Cristina Paredes', PartyIdentification: { Identification: '1709876543', IdentificationType: 'NIDN' }, SignatoryRole: 'Secondary' },
    ],
    StatementFrequency: 'WEEK',
  },
  {
    CurrentAccountFacilityReference: '1100678901',
    AccountIdentification: { Identification: '1100678901', SchemeName: 'BBAN' },
    AccountType: 'CACC',
    AccountName: 'Cuenta Corriente Personal',
    ProductReference: { ProductIdentification: 'CTE-PER', ProductName: 'Corriente Personal' },
    CustomerReference: customer('0912345675', 'NIDN', 'Carlos Alberto Mendoza Ruiz'),
    AccountCurrency: 'USD',
    AccountStatus: 'ENAB',
    Servicer: servicer('020', 'Agencia Kennedy Guayaquil'),
    OpeningDate: '2020-10-15',
    LastActivityDate: '2026-09-18',
    Balance: [
      { BalanceType: 'ITAV', Amount: amount('0.00'), CreditDebitIndicator: 'CRDT', DateTime: '2026-09-22T08:00:00-05:00' },
      { BalanceType: 'ITBD', Amount: amount('320.40'), CreditDebitIndicator: 'DBIT', DateTime: '2026-09-22T08:00:00-05:00' },
    ],
    OverdraftFacility: {
      OverdraftLimit: amount('500.00'),
      OverdraftUsed: amount('320.40'),
      OverdraftInterestRate: { RateType: 'Fixed', AnnualRate: '15.60', DayCountBasis: 'Actual/360' },
    },
    ChequeBook: { ChequeBookEnabled: false },
    ServiceCharge: { MonthlyMaintenanceFee: amount('2.50'), ChargeFrequency: 'MNTH' },
    StatementFrequency: 'MNTH',
  },
];

const byParty = (id) => (a) => a.CustomerReference.PartyIdentification.Identification === id;

export const savingsAccountsByParty = (id) => savingsAccounts.filter(byParty(id));
export const currentAccountsByParty = (id) => currentAccounts.filter(byParty(id));
export const findSavingsAccount = (id) => savingsAccounts.find((a) => a.SavingsAccountFacilityReference === id);
export const findCurrentAccount = (id) => currentAccounts.find((a) => a.CurrentAccountFacilityReference === id);
