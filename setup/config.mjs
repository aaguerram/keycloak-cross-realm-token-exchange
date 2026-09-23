// Configuración compartida por los scripts de setup y de prueba.
// Cada reino de Keycloak es el único emisor de tokens aceptado por su producto de WSO2.

export const VERSION = '1.0.0';

export const KEYCLOAK = {
  url: process.env.KEYCLOAK_URL ?? 'http://keycloak:8080', // red interna de Docker
  publicUrl: process.env.KEYCLOAK_PUBLIC_URL ?? 'http://localhost:8180', // = KC_HOSTNAME (issuer de los tokens)
  adminUser: process.env.KEYCLOAK_ADMIN_USER ?? 'admin',
  adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin',
  // Cliente con el que WSO2 registra aplicaciones (DCR) en cada reino
  wso2ClientId: 'wso2-km',
  wso2ClientSecret: process.env.KEYCLOAK_WSO2_CLIENT_SECRET ?? 'wso2-km-secret',
};

export const WSO2 = {
  url: process.env.WSO2_URL ?? 'https://wso2am:9443',
  gatewayUrl: process.env.GATEWAY_URL ?? 'https://wso2am:8243',
  gatewayVhost: process.env.GATEWAY_VHOST ?? 'localhost', // = PUBLIC_HOST (host de http_endpoint en deployment.toml)
  adminUser: process.env.WSO2_ADMIN_USER ?? 'admin',
  adminPassword: process.env.WSO2_ADMIN_PASSWORD ?? 'admin',
};

export const APIS = [
  { name: 'clientes-api', context: '/clientes', backend: 'http://clientes-api:3001' },
  { name: 'cuentas-api', context: '/cuentas', backend: 'http://cuentas-api:3002' },
  { name: 'movimiento-api', context: '/movimientos', backend: 'http://movimiento-api:3003' },
];

// reino ↔ Key Manager ↔ producto (el nombre del producto es también la audiencia exigida)
export const REALMS = [
  {
    realm: 'reino-cliente',
    displayName: 'Reino Clientes',
    keyManager: 'KM-reino-cliente',
    product: {
      name: 'pro-cliente',
      context: '/pro-cliente',
      description: 'Producto de clientes: datos de referencia y direcciones. Solo acepta tokens de reino-cliente.',
      apis: ['clientes-api'],
    },
  },
  {
    realm: 'reino-cuenta',
    displayName: 'Reino Cuentas',
    keyManager: 'KM-reino-cuenta',
    product: {
      name: 'pro-cuenta',
      context: '/pro-cuenta',
      description: 'Producto de cuentas: ahorro, corriente y movimientos. Solo acepta tokens de reino-cuenta.',
      apis: ['cuentas-api', 'movimiento-api'],
    },
  },
];

export const realmOfApi = (apiName) => REALMS.find((r) => r.product.apis.includes(apiName));

// ---------- Permisos (scopes OAuth 2.0) ----------
// Cada operación del gateway exige un scope. Lo emite el reino dueño de la API, y solo a quien
// tenga un rol (perfil) autorizado para ese scope.
export const SCOPES = [
  // reino-cliente → clientes-api
  { name: 'party:list', api: 'clientes-api', description: 'Listar clientes', operations: [['GET', '/party-reference-data-directory/v1/parties']] },
  { name: 'party:read', api: 'clientes-api', description: 'Consultar un cliente', operations: [['GET', '/party-reference-data-directory/v1/parties/{partyIdentification}']] },
  { name: 'party-address:read', api: 'clientes-api', description: 'Consultar direcciones de un cliente', operations: [['GET', '/party-reference-data-directory/v1/parties/{partyIdentification}/addresses']] },
  // reino-cuenta → cuentas-api
  {
    name: 'savings-account:read', api: 'cuentas-api', description: 'Consultar cuentas de ahorro',
    operations: [['GET', '/savings-account/v1/parties/{partyIdentification}/savings-accounts'], ['GET', '/savings-account/v1/savings-accounts/{savingsAccountId}']],
  },
  {
    name: 'current-account:read', api: 'cuentas-api', description: 'Consultar cuentas corrientes',
    operations: [['GET', '/current-account/v1/parties/{partyIdentification}/current-accounts'], ['GET', '/current-account/v1/current-accounts/{currentAccountId}']],
  },
  // reino-cuenta → movimiento-api
  { name: 'transaction:list', api: 'movimiento-api', description: 'Listar movimientos de una cuenta', operations: [['GET', '/position-keeping/v1/accounts/{accountNumber}/transactions']] },
  { name: 'transaction:read', api: 'movimiento-api', description: 'Consultar un movimiento', operations: [['GET', '/position-keeping/v1/transactions/{transactionId}']] },
];

export const realmOfScope = (scope) => realmOfApi(SCOPES.find((s) => s.name === scope).api).realm;

// ---------- Canales (aplicaciones consumidoras) ----------
// Cada canal tiene un cliente en un reino de canal, donde se autentica con Client Credentials. Varios
// canales pueden compartir reino (banca-mujer está registrado en reino-banca-persona). Los reinos de las
// APIs (reino-cliente, reino-cuenta) confían en el reino del canal como Identity Provider y aceptan
// su token como client assertion (RFC 7523, "federated client authentication"): el canal no tiene
// secretos en los reinos de las APIs. En cada reino de API, el canal recibe el rol perfil-<canal>,
// que solo habilita los scopes listados en `permissions`.
export const CHANNELS = [
  {
    name: 'banca-persona',
    realm: 'reino-banca-persona',
    displayName: 'Reino Banca Persona',
    clientSecret: process.env.BANCA_PERSONA_CLIENT_SECRET ?? 'banca-persona-secret',
    description: 'Canal de banca de personas',
    permissions: ['party:list', 'party:read', 'party-address:read', 'savings-account:read', 'current-account:read', 'transaction:list'],
  },
  {
    name: 'banca-empresa',
    realm: 'reino-banca-empresa',
    displayName: 'Reino Banca Empresa',
    clientSecret: process.env.BANCA_EMPRESA_CLIENT_SECRET ?? 'banca-empresa-secret',
    description: 'Canal de banca de empresas',
    permissions: ['party:read', 'savings-account:read', 'current-account:read', 'transaction:list', 'transaction:read'],
  },
  {
    name: 'banca-mujer',
    realm: 'reino-banca-persona',
    displayName: 'Reino Banca Persona',
    clientSecret: process.env.BANCA_MUJER_CLIENT_SECRET ?? 'banca-mujer-secret',
    description: 'Canal de banca mujer',
    permissions: ['party:list', 'savings-account:read', 'current-account:read', 'transaction:read'],
  },
];

export const roleOfChannel = (channel) => `perfil-${channel.name}`;
