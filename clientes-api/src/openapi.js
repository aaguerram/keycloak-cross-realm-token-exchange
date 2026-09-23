const errorResponses = {
  400: { description: 'Identificación inválida', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
  404: { description: 'Cliente no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
};

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

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'clientes-api',
    version: '1.0.0',
    description:
      'API de clientes basada en el Service Domain BIAN **Party Reference Data Directory**. ' +
      'Los elementos de datos (PartyIdentification, PostalAddress, códigos AddressType, IdentificationType) siguen ISO 20022.',
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Party Reference Data Directory', description: 'BIAN Service Domain: directorio de datos de referencia de clientes' }],
  paths: {
    '/party-reference-data-directory/v1/parties': {
      get: {
        tags: ['Party Reference Data Directory'],
        operationId: 'retrieveParties',
        summary: 'Lista de clientes',
        'x-bian-operation': 'PartyReferenceDataDirectory/Retrieve',
        responses: {
          200: {
            description: 'Lista de clientes',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PartyListResponse' } } },
          },
        },
      },
    },
    '/party-reference-data-directory/v1/parties/{partyIdentification}': {
      get: {
        tags: ['Party Reference Data Directory'],
        operationId: 'retrievePartyByIdentification',
        summary: 'Detalle de un cliente por identificación',
        'x-bian-operation': 'PartyReferenceDataDirectory/{partyreferencedatadirectoryid}/Retrieve',
        parameters: [partyIdentificationParam],
        responses: {
          200: {
            description: 'Detalle del cliente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PartyDetailResponse' } } },
          },
          ...errorResponses,
        },
      },
    },
    '/party-reference-data-directory/v1/parties/{partyIdentification}/addresses': {
      get: {
        tags: ['Party Reference Data Directory'],
        operationId: 'retrievePartyAddresses',
        summary: 'Direcciones de un cliente por identificación',
        'x-bian-operation': 'PartyReferenceDataDirectory/{partyreferencedatadirectoryid}/Address/Retrieve',
        parameters: [partyIdentificationParam],
        responses: {
          200: {
            description: 'Direcciones del cliente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PartyAddressesResponse' } } },
          },
          ...errorResponses,
        },
      },
    },
    '/health': {
      get: {
        tags: ['Operación'],
        summary: 'Health check',
        responses: { 200: { description: 'Servicio disponible' } },
      },
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
      PartyIdentification: {
        type: 'object',
        required: ['Identification', 'IdentificationType'],
        properties: {
          Identification: { type: 'string', example: '1710034065' },
          IdentificationType: {
            type: 'string',
            description: 'ISO 20022 ExternalPersonIdentification1Code / ExternalOrganisationIdentification1Code (NIDN=documento nacional, TXID=identificación tributaria, CCPT=pasaporte)',
            enum: ['NIDN', 'TXID', 'CCPT'],
          },
          Issuer: { type: 'string', example: 'Registro Civil del Ecuador' },
        },
      },
      PartyName: {
        type: 'object',
        required: ['Name'],
        properties: {
          Name: { type: 'string' },
          GivenName: { type: 'string' },
          FamilyName: { type: 'string' },
          LegalName: { type: 'string' },
        },
      },
      PartyReference: {
        type: 'object',
        required: ['PartyIdentification', 'PartyType', 'PartyName'],
        properties: {
          PartyIdentification: { $ref: '#/components/schemas/PartyIdentification' },
          PartyType: { type: 'string', enum: ['Individual', 'Organisation'] },
          PartyName: { $ref: '#/components/schemas/PartyName' },
        },
      },
      PostalAddress: {
        type: 'object',
        description: 'ISO 20022 PostalAddress24',
        required: ['AddressType', 'Country'],
        properties: {
          AddressType: {
            type: 'string',
            description: 'ISO 20022 AddressType2Code: ADDR=postal, PBOX=casilla, HOME=domicilio, BIZZ=trabajo, MLTO=correspondencia, DLVY=entrega',
            enum: ['ADDR', 'PBOX', 'HOME', 'BIZZ', 'MLTO', 'DLVY'],
          },
          StreetName: { type: 'string', maxLength: 70 },
          BuildingNumber: { type: 'string', maxLength: 16 },
          BuildingName: { type: 'string', maxLength: 35 },
          Floor: { type: 'string', maxLength: 70 },
          PostBox: { type: 'string', maxLength: 16 },
          PostCode: { type: 'string', maxLength: 16 },
          TownName: { type: 'string', maxLength: 35 },
          CountrySubDivision: { type: 'string', maxLength: 35 },
          Country: { type: 'string', pattern: '^[A-Z]{2}$', description: 'ISO 3166-1 alfa-2', example: 'EC' },
          AddressLine: { type: 'array', maxItems: 7, items: { type: 'string', maxLength: 70 } },
        },
      },
      ContactPoint: {
        type: 'object',
        properties: {
          ContactPointType: { type: 'string', enum: ['Email', 'Mobile', 'Phone'] },
          Value: { type: 'string' },
        },
      },
      PartySummary: {
        type: 'object',
        required: ['PartyReferenceDataDirectoryEntryReference', 'PartyReference', 'PartyLifecycleStatus'],
        properties: {
          PartyReferenceDataDirectoryEntryReference: { type: 'string', example: 'PRDD-000001' },
          PartyReference: { $ref: '#/components/schemas/PartyReference' },
          PartyLifecycleStatus: { type: 'string', enum: ['Active', 'Inactive'] },
        },
      },
      Party: {
        allOf: [
          { $ref: '#/components/schemas/PartySummary' },
          {
            type: 'object',
            properties: {
              DateOfBirth: { type: 'string', format: 'date' },
              DateOfIncorporation: { type: 'string', format: 'date' },
              Nationality: { type: 'string', pattern: '^[A-Z]{2}$' },
              ContactPoint: { type: 'array', items: { $ref: '#/components/schemas/ContactPoint' } },
              PostalAddress: { type: 'array', items: { $ref: '#/components/schemas/PostalAddress' } },
            },
          },
        ],
      },
      PartyListResponse: {
        type: 'object',
        properties: {
          GroupHeader: { $ref: '#/components/schemas/GroupHeader' },
          Parties: { type: 'array', items: { $ref: '#/components/schemas/PartySummary' } },
          TotalRecords: { type: 'integer' },
        },
      },
      PartyDetailResponse: {
        type: 'object',
        properties: {
          GroupHeader: { $ref: '#/components/schemas/GroupHeader' },
          Party: { $ref: '#/components/schemas/Party' },
        },
      },
      PartyAddressesResponse: {
        type: 'object',
        properties: {
          GroupHeader: { $ref: '#/components/schemas/GroupHeader' },
          PartyIdentification: { $ref: '#/components/schemas/PartyIdentification' },
          PartyName: { type: 'string' },
          PostalAddress: { type: 'array', items: { $ref: '#/components/schemas/PostalAddress' } },
          TotalRecords: { type: 'integer' },
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
              properties: { Code: { type: 'string', example: 'PARTY_NOT_FOUND' }, Message: { type: 'string' } },
            },
          },
        },
      },
    },
  },
};
