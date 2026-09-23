// Datos de ejemplo. Estructura basada en BIAN "Party Reference Data Directory"
// con tipos y códigos de ISO 20022 (PartyIdentification, PostalAddress, AddressType2Code...).
export const parties = [
  {
    PartyReferenceDataDirectoryEntryReference: 'PRDD-000001',
    PartyReference: {
      PartyIdentification: { Identification: '1710034065', IdentificationType: 'NIDN', Issuer: 'Registro Civil del Ecuador' },
      PartyType: 'Individual',
      PartyName: { Name: 'María Fernanda Andrade López', GivenName: 'María Fernanda', FamilyName: 'Andrade López' },
    },
    PartyLifecycleStatus: 'Active',
    DateOfBirth: '1988-04-12',
    Nationality: 'EC',
    ContactPoint: [
      { ContactPointType: 'Email', Value: 'maria.andrade@example.com' },
      { ContactPointType: 'Mobile', Value: '+593-991234567' },
    ],
    PostalAddress: [
      {
        AddressType: 'HOME',
        StreetName: 'Av. República de El Salvador',
        BuildingNumber: 'N34-183',
        BuildingName: 'Edificio Torre Azul',
        Floor: '5',
        PostCode: '170135',
        TownName: 'Quito',
        CountrySubDivision: 'Pichincha',
        Country: 'EC',
        AddressLine: ['Av. República de El Salvador N34-183 y Suiza'],
      },
      {
        AddressType: 'BIZZ',
        StreetName: 'Av. Amazonas',
        BuildingNumber: 'N21-147',
        PostCode: '170517',
        TownName: 'Quito',
        CountrySubDivision: 'Pichincha',
        Country: 'EC',
        AddressLine: ['Av. Amazonas N21-147 y Roca'],
      },
    ],
  },
  {
    PartyReferenceDataDirectoryEntryReference: 'PRDD-000002',
    PartyReference: {
      PartyIdentification: { Identification: '0912345675', IdentificationType: 'NIDN', Issuer: 'Registro Civil del Ecuador' },
      PartyType: 'Individual',
      PartyName: { Name: 'Carlos Alberto Mendoza Ruiz', GivenName: 'Carlos Alberto', FamilyName: 'Mendoza Ruiz' },
    },
    PartyLifecycleStatus: 'Active',
    DateOfBirth: '1979-11-03',
    Nationality: 'EC',
    ContactPoint: [
      { ContactPointType: 'Email', Value: 'carlos.mendoza@example.com' },
      { ContactPointType: 'Mobile', Value: '+593-987654321' },
    ],
    PostalAddress: [
      {
        AddressType: 'HOME',
        StreetName: 'Av. Francisco de Orellana',
        BuildingNumber: 'Mz 111 Villa 4',
        PostCode: '090505',
        TownName: 'Guayaquil',
        CountrySubDivision: 'Guayas',
        Country: 'EC',
        AddressLine: ['Cdla. Kennedy Norte, Av. Francisco de Orellana Mz 111 Villa 4'],
      },
    ],
  },
  {
    PartyReferenceDataDirectoryEntryReference: 'PRDD-000003',
    PartyReference: {
      PartyIdentification: { Identification: '0102030405', IdentificationType: 'NIDN', Issuer: 'Registro Civil del Ecuador' },
      PartyType: 'Individual',
      PartyName: { Name: 'Lucía Esperanza Vintimilla Cordero', GivenName: 'Lucía Esperanza', FamilyName: 'Vintimilla Cordero' },
    },
    PartyLifecycleStatus: 'Inactive',
    DateOfBirth: '1995-07-21',
    Nationality: 'EC',
    ContactPoint: [{ ContactPointType: 'Email', Value: 'lucia.vintimilla@example.com' }],
    PostalAddress: [
      {
        AddressType: 'HOME',
        StreetName: 'Calle Larga',
        BuildingNumber: '7-45',
        PostCode: '010101',
        TownName: 'Cuenca',
        CountrySubDivision: 'Azuay',
        Country: 'EC',
        AddressLine: ['Calle Larga 7-45 y Presidente Borrero'],
      },
      {
        AddressType: 'PBOX',
        PostBox: '01-01-1234',
        TownName: 'Cuenca',
        CountrySubDivision: 'Azuay',
        Country: 'EC',
        AddressLine: ['Casilla Postal 01-01-1234'],
      },
    ],
  },
  {
    PartyReferenceDataDirectoryEntryReference: 'PRDD-000004',
    PartyReference: {
      PartyIdentification: { Identification: '1790012345001', IdentificationType: 'TXID', Issuer: 'Servicio de Rentas Internas' },
      PartyType: 'Organisation',
      PartyName: { Name: 'Comercializadora Andina S.A.', LegalName: 'Comercializadora Andina Sociedad Anónima' },
    },
    PartyLifecycleStatus: 'Active',
    DateOfIncorporation: '2008-02-15',
    Nationality: 'EC',
    ContactPoint: [
      { ContactPointType: 'Email', Value: 'tesoreria@andina.example.com' },
      { ContactPointType: 'Phone', Value: '+593-2-2567890' },
    ],
    PostalAddress: [
      {
        AddressType: 'BIZZ',
        StreetName: 'Av. De los Shyris',
        BuildingNumber: 'N35-52',
        BuildingName: 'Centro Corporativo Shyris',
        Floor: '12',
        PostCode: '170505',
        TownName: 'Quito',
        CountrySubDivision: 'Pichincha',
        Country: 'EC',
        AddressLine: ['Av. De los Shyris N35-52 y Portugal'],
      },
      {
        AddressType: 'DLVY',
        StreetName: 'Panamericana Norte',
        BuildingNumber: 'Km 12.5',
        TownName: 'Quito',
        CountrySubDivision: 'Pichincha',
        Country: 'EC',
        AddressLine: ['Panamericana Norte Km 12.5, Bodega 3'],
      },
    ],
  },
];

export const findParty = (identification) =>
  parties.find((p) => p.PartyReference.PartyIdentification.Identification === identification);
