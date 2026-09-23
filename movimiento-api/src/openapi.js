const json = (ref) => ({ 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } });
const errorResponse = (description) => ({ description, content: json('ErrorResponse') });

const queryParam = (name, description, schema, example) => ({ name, in: 'query', required: false, description, schema, example });

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'movimiento-api',
    version: '1.0.0',
    description:
      'API de movimientos de cuenta basada en el Service Domain BIAN **Position Keeping** (FinancialTransaction). ' +
      'La estructura de cada movimiento sigue el *ReportEntry* de ISO 20022 camt.052/camt.053 ' +
      '(Amount, CreditDebitIndicator, Status, BookingDate, ValueDate, BankTransactionCode, EntryDetails). ' +
      'No distingue entre cuentas de ahorro y corrientes: basta el número de cuenta.',
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Position Keeping', description: 'BIAN Service Domain: registro de movimientos financieros de una cuenta' }],
  paths: {
    '/position-keeping/v1/accounts/{accountNumber}/transactions': {
      get: {
        tags: ['Position Keeping'],
        operationId: 'retrieveAccountTransactions',
        summary: 'Lista de movimientos de una cuenta (ahorro o corriente)',
        description: 'Devuelve los movimientos ordenados del más reciente al más antiguo. Incluye movimientos registrados (BOOK) y pendientes (PDNG).',
        'x-bian-operation': 'PositionKeeping/{positionkeepingid}/FinancialTransaction/Retrieve',
        parameters: [
          {
            name: 'accountNumber',
            in: 'path',
            required: true,
            description: 'Número de cuenta de ahorro o corriente (10 dígitos)',
            schema: { type: 'string', pattern: '^\\d{10}$' },
            examples: {
              ahorro: { summary: 'Cuenta de ahorros', value: '2200145678' },
              corriente: { summary: 'Cuenta corriente', value: '1100567890' },
            },
          },
          queryParam('fromBookingDate', 'Fecha contable desde (inclusive)', { type: 'string', format: 'date' }, '2026-09-01'),
          queryParam('toBookingDate', 'Fecha contable hasta (inclusive)', { type: 'string', format: 'date' }, '2026-09-30'),
          queryParam('creditDebitIndicator', 'Filtra créditos (CRDT) o débitos (DBIT)', { type: 'string', enum: ['CRDT', 'DBIT'] }),
          queryParam('status', 'Filtra por estado del movimiento', { type: 'string', enum: ['BOOK', 'PDNG'] }),
          queryParam('limit', 'Número máximo de registros', { type: 'integer', minimum: 1, maximum: 100, default: 50 }),
          queryParam('offset', 'Registros a omitir (paginación)', { type: 'integer', minimum: 0, default: 0 }),
        ],
        responses: {
          200: { description: 'Movimientos de la cuenta', content: json('TransactionListResponse') },
          400: errorResponse('Número de cuenta o filtro inválido'),
          404: errorResponse('Cuenta no encontrada'),
        },
      },
    },
    '/position-keeping/v1/transactions/{transactionId}': {
      get: {
        tags: ['Position Keeping'],
        operationId: 'retrieveTransaction',
        summary: 'Detalle de un movimiento',
        'x-bian-operation': 'PositionKeeping/{positionkeepingid}/FinancialTransaction/{financialtransactionid}/Retrieve',
        parameters: [
          {
            name: 'transactionId',
            in: 'path',
            required: true,
            description: 'Identificador del movimiento',
            schema: { type: 'string', pattern: '^MOV-\\d{8}-\\d{6}$' },
            examples: {
              transferencia: { summary: 'Transferencia interna', value: 'MOV-20260902-000021' },
              tarjeta: { summary: 'Compra con tarjeta', value: 'MOV-20260905-000027' },
            },
          },
        ],
        responses: {
          200: { description: 'Detalle del movimiento', content: json('TransactionDetailResponse') },
          400: errorResponse('Id de movimiento inválido'),
          404: errorResponse('Movimiento no encontrado'),
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
        description: 'ISO 20022 ActiveCurrencyAndAmount (importe como string decimal)',
        required: ['Amount', 'Currency'],
        properties: {
          Amount: { type: 'string', pattern: '^\\d{1,18}(\\.\\d{1,5})?$', example: '87.35' },
          Currency: { type: 'string', pattern: '^[A-Z]{3}$', description: 'ISO 4217', example: 'USD' },
        },
      },
      CreditDebitIndicator: { type: 'string', description: 'ISO 20022 CreditDebitCode', enum: ['CRDT', 'DBIT'] },
      AccountIdentification: {
        type: 'object',
        description: 'ISO 20022 GenericAccountIdentification1',
        required: ['Identification', 'SchemeName'],
        properties: {
          Identification: { type: 'string', example: '2200145678' },
          SchemeName: { type: 'string', enum: ['BBAN', 'IBAN'] },
        },
      },
      FinancialInstitution: {
        type: 'object',
        description: 'ISO 20022 BranchAndFinancialInstitutionIdentification (simplificado)',
        properties: {
          BICFI: { type: 'string', pattern: '^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$', example: 'BDEMECE1XXX' },
          Name: { type: 'string', example: 'Banco Demo S.A.' },
        },
      },
      PartyName: { type: 'object', properties: { Name: { type: 'string' } } },
      BankTransactionCode: {
        type: 'object',
        description: 'ISO 20022 BankTransactionCodeStructure4',
        properties: {
          Domain: {
            type: 'object',
            properties: {
              Code: { type: 'string', description: 'PMNT=pagos, ACMT=gestión de cuenta', enum: ['PMNT', 'ACMT'] },
              Family: {
                type: 'object',
                properties: {
                  Code: {
                    type: 'string',
                    description: 'RCDT=transferencia recibida, ICDT=transferencia emitida, CCRD=tarjeta, CNTR=ventanilla, ICHQ=cheque emitido, MCOP/MDOP=otros créditos/débitos',
                    enum: ['RCDT', 'ICDT', 'CCRD', 'CNTR', 'ICHQ', 'MCOP', 'MDOP'],
                  },
                  SubFamilyCode: {
                    type: 'string',
                    description: 'SALA=nómina, DMCT=transferencia doméstica, BOOK=transferencia interna, POSD=compra POS, CWDL=retiro ATM, CDPT=depósito, CCHQ=cheque, INTR=intereses, CHRG=comisiones',
                    enum: ['SALA', 'DMCT', 'BOOK', 'POSD', 'CWDL', 'CDPT', 'CCHQ', 'INTR', 'CHRG'],
                  },
                },
              },
            },
          },
          Proprietary: {
            type: 'object',
            properties: { Code: { type: 'string', example: 'COMPRA-TARJETA' }, Issuer: { type: 'string', example: 'BDEMECE1XXX' } },
          },
        },
      },
      BalanceAfterTransaction: {
        type: 'object',
        description: 'Saldo contable tras aplicar el movimiento (solo movimientos BOOK)',
        properties: {
          Amount: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
          CreditDebitIndicator: { $ref: '#/components/schemas/CreditDebitIndicator' },
        },
      },
      TransactionSummary: {
        type: 'object',
        required: ['TransactionIdentification', 'Amount', 'CreditDebitIndicator', 'Status', 'BookingDate'],
        properties: {
          TransactionIdentification: { type: 'string', example: 'MOV-20260905-000027' },
          Amount: { $ref: '#/components/schemas/ActiveCurrencyAndAmount' },
          CreditDebitIndicator: { $ref: '#/components/schemas/CreditDebitIndicator' },
          Status: { type: 'string', description: 'ISO 20022 ExternalEntryStatus1Code: BOOK=registrado, PDNG=pendiente', enum: ['BOOK', 'PDNG'] },
          BookingDate: { type: 'string', format: 'date-time' },
          ValueDate: { type: 'string', format: 'date' },
          BankTransactionCode: { $ref: '#/components/schemas/BankTransactionCode' },
          TransactionDescription: { type: 'string', example: 'Compra Supermercado La Colina' },
          Channel: { type: 'string', enum: ['ONLINE_BANKING', 'MOBILE_BANKING', 'POS', 'ATM', 'BRANCH', 'SYSTEM'] },
          BalanceAfterTransaction: { $ref: '#/components/schemas/BalanceAfterTransaction' },
        },
      },
      EntryDetails: {
        type: 'object',
        description: 'ISO 20022 EntryTransaction (simplificado)',
        properties: {
          References: {
            type: 'object',
            properties: {
              AccountServicerReference: { type: 'string' },
              EndToEndIdentification: { type: 'string', description: 'Igual en ambas cuentas cuando es una transferencia interna' },
              ChequeNumber: { type: 'string' },
            },
          },
          RelatedParties: {
            type: 'object',
            properties: {
              Debtor: { $ref: '#/components/schemas/PartyName' },
              DebtorAccount: { $ref: '#/components/schemas/AccountIdentification' },
              Creditor: { $ref: '#/components/schemas/PartyName' },
              CreditorAccount: { $ref: '#/components/schemas/AccountIdentification' },
            },
          },
          RelatedAgents: {
            type: 'object',
            properties: {
              DebtorAgent: { $ref: '#/components/schemas/FinancialInstitution' },
              CreditorAgent: { $ref: '#/components/schemas/FinancialInstitution' },
            },
          },
          CardTransaction: {
            type: 'object',
            properties: {
              Card: {
                type: 'object',
                properties: {
                  MaskedPAN: { type: 'string', example: '************4821' },
                  CardScheme: { type: 'string' },
                  CardType: { type: 'string', enum: ['DEBIT', 'CREDIT'] },
                },
              },
              Merchant: {
                type: 'object',
                properties: {
                  Name: { type: 'string' },
                  MerchantCategoryCode: { type: 'string', description: 'ISO 18245 MCC', example: '5411' },
                  TownName: { type: 'string' },
                  Country: { type: 'string' },
                },
              },
              ATM: {
                type: 'object',
                properties: { Identification: { type: 'string' }, Location: { type: 'string' }, Country: { type: 'string' } },
              },
            },
          },
          RemittanceInformation: {
            type: 'object',
            properties: { Unstructured: { type: 'array', items: { type: 'string', maxLength: 140 } } },
          },
          Branch: { type: 'object', properties: { Name: { type: 'string' } } },
        },
      },
      Transaction: {
        allOf: [
          { $ref: '#/components/schemas/TransactionSummary' },
          {
            type: 'object',
            properties: {
              AccountIdentification: { $ref: '#/components/schemas/AccountIdentification' },
              EntryDetails: { $ref: '#/components/schemas/EntryDetails' },
            },
          },
        ],
      },
      TransactionListResponse: {
        type: 'object',
        properties: {
          GroupHeader: { $ref: '#/components/schemas/GroupHeader' },
          AccountIdentification: { $ref: '#/components/schemas/AccountIdentification' },
          Transactions: { type: 'array', items: { $ref: '#/components/schemas/TransactionSummary' } },
          Pagination: {
            type: 'object',
            properties: { Offset: { type: 'integer' }, Limit: { type: 'integer' }, TotalRecords: { type: 'integer' } },
          },
        },
      },
      TransactionDetailResponse: {
        type: 'object',
        properties: {
          GroupHeader: { $ref: '#/components/schemas/GroupHeader' },
          Transaction: { $ref: '#/components/schemas/Transaction' },
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
              properties: { Code: { type: 'string', example: 'TRANSACTION_NOT_FOUND' }, Message: { type: 'string' } },
            },
          },
        },
      },
    },
  },
};
