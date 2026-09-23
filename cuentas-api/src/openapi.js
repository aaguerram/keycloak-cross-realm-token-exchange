const json = (ref) => ({ 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } });

const partyIdentificationParam = {
  name: 'partyIdentification',
  in: 'path',
  required: true,
  description: 'Identificación del cliente: cédula (10 dígitos) o RUC (13 dígitos)',
  schema: { type: 'string', pattern: '^\\d{10}(\\d{3})?$' },
  examples: {
    persona: { summary: 'Cédula', value: '1710034065' },
    empresa: { summary: 'RUC', value: '1790012345001' },
  },
};

const accountParam = (name, example) => ({
  name,
  in: 'path',
  required: true,
  description: 'Número de cuenta (10 dígitos)',
  schema: { type: 'string', pattern: '^\\d{10}$' },
  example,
});

const badRequest = { description: 'Parámetro inválido', content: json('ErrorResponse') };
const notFound = { description: 'Cuenta no encontrada', content: json('ErrorResponse') };

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'cuentas-api',
    version: '1.0.0',
    description:
      'API de cuentas basada en los Service Domains BIAN **Savings Account** y **Current Account**. ' +
      'Los elementos de datos siguen ISO 20022 (CashAccountType, BalanceType, CreditDebitIndicator, AccountStatus, Frequency).',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Savings Account', description: 'BIAN Service Domain: cuentas de ahorro' },
    { name: 'Current Account', description: 'BIAN Service Domain: cuentas corrientes' },
  ],
  paths: {
    '/savings-account/v1/parties/{partyIdentification}/savings-accounts': {
      get: {
        tags: ['Savings Account'],
        operationId: 'retrieveSavingsAccountsByParty',
        summary: 'Lista de cuentas de ahorro de un cliente',
        'x-bian-operation': 'SavingsAccount/Retrieve (filtro CustomerReference)',
        parameters: [partyIdentificationParam],
        responses: { 200: { description: 'Cuentas de ahorro del cliente', content: json('SavingsAccountListResponse') }, 400: badRequest },
      },
    },
    '/savings-account/v1/savings-accounts/{savingsAccountId}': {
      get: {
        tags: ['Savings Account'],
        operationId: 'retrieveSavingsAccount',
        summary: 'Detalle de una cuenta de ahorro',
        'x-bian-operation': 'SavingsAccount/{savingsaccountid}/Retrieve',
        parameters: [accountParam('savingsAccountId', '2200145678')],
        responses: {
          200: { description: 'Detalle de la cuenta de ahorro', content: json('SavingsAccountDetailResponse') },
          400: badRequest,
          404: notFound,
        },
      },
    },
    '/current-account/v1/parties/{partyIdentification}/current-accounts': {
      get: {
        tags: ['Current Account'],
        operationId: 'retrieveCurrentAccountsByParty',
        summary: 'Lista de cuentas corrientes de un cliente',
        'x-bian-operation': 'CurrentAccount/Retrieve (filtro CustomerReference)',
        parameters: [partyIdentificationParam],
        responses: { 200: { description: 'Cuentas corrientes del cliente', content: json('CurrentAccountListResponse') }, 400: badRequest },
      },
    },
    '/current-account/v1/current-accounts/{currentAccountId}': {
      get: {
        tags: ['Current Account'],
        operationId: 'retrieveCurrentAccount',
        summary: 'Detalle de una cuenta corriente',
        'x-bian-operation': 'CurrentAccount/{currentaccountid}/Retrieve',
        parameters: [accountParam('currentAccountId', '1100456789')],
        responses: {
          200: { description: 'Detalle de la cuenta corriente', content: json('CurrentAccountDetailResponse') },
          400: badRequest,
          404: notFound,
        },
      },
    },
    '/health': {
      get: { tags: ['Operación'], summary: 'Health check', responses: { 200: { description: 'Servicio disponible' } } },
    },
  },
  components: {
    schemas: {
      GroupHeader: {
        type: 'object',
        description: 'Cabecera de mensaje (ISO 20022 GroupHeader)',
        required: ['MessageIdentification', 'CreationDateTime'],
        properties: {
          MessageIdentification: { type: 'string', format: 'uuid' },
          CreationDateTime: { type: 'string', format: 'date-time' },
        },
      },
      ActiveCurrencyAndAmount: {
        type: 'object',
        description: 'ISO 20022 ActiveCurrencyAndAmount (importe como string decimal para evitar errores de coma flotante)',
        required: ['Amount', 'Currency'],
        properties: {
          Amount: { type: 'string', pattern: '^\\d{1,18}(\\.\\d{1,5})?$', example: '5230.45' },
          Currency: { type: 'string', pattern: '^[A-Z]{3}$', description: 'ISO 4217', example: 'USD' },
        },
      },
      AccountIdentification: {
        type: 'object',
        description: 'ISO 20022 GenericAccountIdentification1',
        required: ['Identification', 'SchemeName'],
        properties: {
          Identification: { type: 'string', example: '2200145678' },
          SchemeName: { type: 'string', enum: ['BBAN', 'IBAN'] },
        },
      },
      AccountStatus: {
        type: 'string',
        description: 'ISO 20022 AccountStatus3Code: ENAB=habilitada, DISA=deshabilitada, DELE=eliminada, PROC=en proceso',
        enum: ['ENAB', 'DISA', 'DELE', 'PROC'],
      },
      Frequency: {
        type: 'string',
        description: 'ISO 20022 Frequency6Code',
        enum: ['DAIL', 'WEEK', 'MNTH', 'QURT', 'MIAN', 'YEAR'],
      },
      ProductReference: {
        type: 'object',
        properties: { ProductIdentification: { type: 'string' }, ProductName: { type: 'string' } },
      },
      CustomerReference: {
        type: 'object',
        properties: {
          PartyIdentification: {
            type: 'object',
            properties: {
              Identification: { type: 'string' },
              IdentificationType: { type: 'string', enum: ['NIDN', 'TXID', 'CCPT'] },
            },
          },
          PartyName: { type: 'string' },
        },
      },
      Servicer: {
        type: 'object',
        description: 'Institución que administra la cuenta (ISO 20022 BranchAndFinancialInstitutionIdentification)',
        properties: {
          BICFI: { type: 'string', pattern: '^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$' },
          Name: { type: 'string' },
          BranchIdentification: { type: 'string' },
          BranchName: { type: 'string' },
        },
      },
      Balance: {
        type: 'object',
        description: 'ISO 20022 CashBalance',
        required: ['BalanceType', 'Amount', 'CreditDebitIndicator'],
        properties: {
          BalanceType: {
            type: 'string',
            description: 'ISO 20022 BalanceType12Code: ITAV=disponible, ITBD=contable, CLAV/CLBD=cierre, OPAV/OPBD=apertura',
            enum: ['ITAV', 'ITBD', 'CLAV', 'CLBD', 'OPAV', 'OPBD'],
          },
          Amount: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
          CreditDebitIndicator: { type: 'string', enum: ['CRDT', 'DBIT'] },
          DateTime: { type: 'string', format: 'date-time' },
        },
      },
      InterestRate: {
        type: 'object',
        properties: {
          RateType: { type: 'string', enum: ['Fixed', 'Variable'] },
          AnnualRate: { type: 'string', description: 'Tasa nominal anual en %', example: '5.25' },
          DayCountBasis: { type: 'string', example: 'Actual/365' },
          PaymentFrequency: { $ref: '#/components/schemas/Frequency' },
          AccruedInterest: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
        },
      },
      AccountSummary: {
        type: 'object',
        properties: {
          AccountIdentification: { $ref: '#/components/schemas/AccountIdentification' },
          AccountType: { type: 'string', description: 'ISO 20022 ExternalCashAccountType1Code', enum: ['SVGS', 'CACC'] },
          AccountName: { type: 'string' },
          ProductReference: { $ref: '#/components/schemas/ProductReference' },
          AccountCurrency: { type: 'string', pattern: '^[A-Z]{3}$' },
          AccountStatus: { $ref: '#/components/schemas/AccountStatus' },
          AvailableBalance: { $ref: '#/components/schemas/Balance' },
        },
      },
      AccountCommon: {
        type: 'object',
        properties: {
          AccountIdentification: { $ref: '#/components/schemas/AccountIdentification' },
          AccountType: { type: 'string', enum: ['SVGS', 'CACC'] },
          AccountName: { type: 'string' },
          ProductReference: { $ref: '#/components/schemas/ProductReference' },
          CustomerReference: { $ref: '#/components/schemas/CustomerReference' },
          AccountCurrency: { type: 'string', pattern: '^[A-Z]{3}$' },
          AccountStatus: { $ref: '#/components/schemas/AccountStatus' },
          Servicer: { $ref: '#/components/schemas/Servicer' },
          OpeningDate: { type: 'string', format: 'date' },
          LastActivityDate: { type: 'string', format: 'date' },
          Balance: { type: 'array', items: { $ref: '#/components/schemas/Balance' } },
          StatementFrequency: { $ref: '#/components/schemas/Frequency' },
        },
      },
      SavingsAccountSummary: {
        allOf: [
          { type: 'object', properties: { SavingsAccountFacilityReference: { type: 'string', example: '2200145678' } } },
          { $ref: '#/components/schemas/AccountSummary' },
        ],
      },
      CurrentAccountSummary: {
        allOf: [
          { type: 'object', properties: { CurrentAccountFacilityReference: { type: 'string', example: '1100456789' } } },
          { $ref: '#/components/schemas/AccountSummary' },
        ],
      },
      SavingsAccountFacility: {
        description: 'BIAN Savings Account - control record SavingsAccountFacility',
        allOf: [
          { type: 'object', properties: { SavingsAccountFacilityReference: { type: 'string' } } },
          { $ref: '#/components/schemas/AccountCommon' },
          {
            type: 'object',
            properties: {
              MaturityDate: { type: 'string', format: 'date' },
              InterestRate: { $ref: '#/components/schemas/InterestRate' },
              SavingsAccountFeatures: {
                type: 'object',
                properties: {
                  MinimumBalance: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
                  DailyWithdrawalLimit: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
                  MonthlyWithdrawalCountLimit: { type: 'integer' },
                  ScheduledDeposit: {
                    type: 'object',
                    properties: {
                      Amount: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
                      Frequency: { $ref: '#/components/schemas/Frequency' },
                      NextDate: { type: 'string', format: 'date' },
                    },
                  },
                  TargetAmount: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
                  WithdrawalRestricted: { type: 'boolean' },
                },
              },
            },
          },
        ],
      },
      CurrentAccountFacility: {
        description: 'BIAN Current Account - control record CurrentAccountFacility',
        allOf: [
          { type: 'object', properties: { CurrentAccountFacilityReference: { type: 'string' } } },
          { $ref: '#/components/schemas/AccountCommon' },
          {
            type: 'object',
            properties: {
              OverdraftFacility: {
                type: 'object',
                properties: {
                  OverdraftLimit: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
                  OverdraftUsed: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
                  OverdraftInterestRate: { $ref: '#/components/schemas/InterestRate' },
                },
              },
              ChequeBook: {
                type: 'object',
                properties: {
                  ChequeBookEnabled: { type: 'boolean' },
                  LastChequeBookIssueDate: { type: 'string', format: 'date' },
                  ChequeNumberRange: { type: 'object', properties: { From: { type: 'string' }, To: { type: 'string' } } },
                },
              },
              ServiceCharge: {
                type: 'object',
                properties: {
                  MonthlyMaintenanceFee: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
                  ChargeFrequency: { $ref: '#/components/schemas/Frequency' },
                },
              },
              AuthorisedSignatories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    PartyName: { type: 'string' },
                    PartyIdentification: { $ref: '#/components/schemas/CustomerReference/properties/PartyIdentification' },
                    SignatoryRole: { type: 'string', enum: ['Primary', 'Secondary'] },
                  },
                },
              },
            },
          },
        ],
      },
      SavingsAccountListResponse: {
        type: 'object',
        properties: {
          GroupHeader: { $ref: '#/components/schemas/GroupHeader' },
          CustomerReference: { $ref: '#/components/schemas/CustomerReference' },
          SavingsAccounts: { type: 'array', items: { $ref: '#/components/schemas/SavingsAccountSummary' } },
          TotalRecords: { type: 'integer' },
        },
      },
      CurrentAccountListResponse: {
        type: 'object',
        properties: {
          GroupHeader: { $ref: '#/components/schemas/GroupHeader' },
          CustomerReference: { $ref: '#/components/schemas/CustomerReference' },
          CurrentAccounts: { type: 'array', items: { $ref: '#/components/schemas/CurrentAccountSummary' } },
          TotalRecords: { type: 'integer' },
        },
      },
      SavingsAccountDetailResponse: {
        type: 'object',
        properties: {
          GroupHeader: { $ref: '#/components/schemas/GroupHeader' },
          SavingsAccountFacility: { $ref: '#/components/schemas/SavingsAccountFacility' },
        },
      },
      CurrentAccountDetailResponse: {
        type: 'object',
        properties: {
          GroupHeader: { $ref: '#/components/schemas/GroupHeader' },
          CurrentAccountFacility: { $ref: '#/components/schemas/CurrentAccountFacility' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          GroupHeader: { $ref: '#/components/schemas/GroupHeader' },
          Errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: { Code: { type: 'string', example: 'ACCOUNT_NOT_FOUND' }, Message: { type: 'string' } },
            },
          },
        },
      },
    },
  },
};
