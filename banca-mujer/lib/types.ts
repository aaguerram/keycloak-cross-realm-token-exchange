// Subconjunto de los mensajes BIAN / ISO 20022 que muestra la página
export type Amount = { Amount: string; Currency: string };
export type Address = {
  AddressType: string;
  StreetName?: string;
  BuildingNumber?: string;
  BuildingName?: string;
  Floor?: string;
  PostCode?: string;
  AddressLine?: string[];
  TownName?: string;
  CountrySubDivision?: string;
  Country?: string;
};
export type PartyReference = {
  PartyIdentification: { Identification: string; IdentificationType: string; Issuer: string };
  PartyType: string;
  PartyName: { Name: string; GivenName?: string; FamilyName?: string; LegalName?: string };
};
export type PartyEntry = { PartyReferenceDataDirectoryEntryReference: string; PartyReference: PartyReference; PartyLifecycleStatus: string };
export type PartyDetail = PartyEntry & {
  DateOfBirth?: string;
  DateOfIncorporation?: string;
  Nationality?: string;
  ContactPoint?: { ContactPointType: string; Value: string }[];
  PostalAddress?: Address[];
};
export type Account = {
  AccountIdentification: { Identification: string };
  AccountType: string;
  AccountName: string;
  ProductReference: { ProductName: string };
  AccountStatus: string;
  AvailableBalance: { Amount: Amount; CreditDebitIndicator: string };
};
export type Transaction = {
  TransactionIdentification: string;
  AccountIdentification?: { Identification: string };
  Amount: Amount;
  CreditDebitIndicator: 'CRDT' | 'DBIT';
  Status: string;
  BookingDate: string;
  TransactionDescription: string;
  Channel?: string;
  BalanceAfterTransaction?: { Amount: Amount; CreditDebitIndicator: string };
};
export type Balance = { BalanceType: string; Amount: Amount; CreditDebitIndicator: string; DateTime: string };
type AccountFacility = {
  AccountIdentification: { Identification: string; SchemeName: string };
  AccountType: string;
  AccountName: string;
  ProductReference: { ProductIdentification: string; ProductName: string };
  CustomerReference: { PartyIdentification: { Identification: string; IdentificationType: string }; PartyName: string };
  AccountCurrency: string;
  AccountStatus: string;
  Servicer: { BICFI: string; Name: string; BranchIdentification: string; BranchName: string };
  OpeningDate: string;
  LastActivityDate?: string;
  Balance: Balance[];
  StatementFrequency?: string;
};
export type SavingsAccountFacility = AccountFacility & {
  InterestRate?: { RateType: string; AnnualRate: string; DayCountBasis: string; PaymentFrequency: string; AccruedInterest?: Amount };
  SavingsAccountFeatures?: { MinimumBalance?: Amount; DailyWithdrawalLimit?: Amount; MonthlyWithdrawalCountLimit?: number };
};
export type CurrentAccountFacility = AccountFacility & {
  OverdraftFacility?: { OverdraftLimit: Amount; OverdraftUsed: Amount; OverdraftInterestRate?: { AnnualRate: string; DayCountBasis: string } };
  ChequeBook?: { ChequeBookEnabled: boolean; LastChequeBookIssueDate?: string; ChequeNumberRange?: { From: string; To: string } };
  ServiceCharge?: { MonthlyMaintenanceFee: Amount; ChargeFrequency: string };
};
