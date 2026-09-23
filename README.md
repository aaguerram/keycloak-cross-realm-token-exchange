# APIs bancarias (BIAN / ISO 20022)

| Servicio | Puerto | Service Domain BIAN | Swagger |
|---|---|---|---|
| clientes-api | 3001 | Party Reference Data Directory | http://localhost:3001/docs |
| cuentas-api | 3002 | Savings Account + Current Account | http://localhost:3002/docs |
| movimiento-api | 3003 | Position Keeping | http://localhost:3003/docs |

La especificación OpenAPI 3.1 en JSON está en `/openapi.json` de cada servicio.

## Levantar

```bash
cp .env.example .env                                   # ajusta PUBLIC_HOST
sed -i "s/^WSO2_ENCRYPTION_KEY=.*/WSO2_ENCRYPTION_KEY=$(openssl rand -hex 32)/" .env
docker compose up -d --build
```

## Endpoints

### clientes-api
- `GET /party-reference-data-directory/v1/parties`: lista de clientes
- `GET /party-reference-data-directory/v1/parties/{partyIdentification}`: detalle del cliente
- `GET /party-reference-data-directory/v1/parties/{partyIdentification}/addresses`: direcciones del cliente

### cuentas-api
- `GET /savings-account/v1/parties/{partyIdentification}/savings-accounts`: cuentas de ahorro de un cliente
- `GET /savings-account/v1/savings-accounts/{savingsAccountId}`: detalle de una cuenta de ahorro
- `GET /current-account/v1/parties/{partyIdentification}/current-accounts`: cuentas corrientes de un cliente
- `GET /current-account/v1/current-accounts/{currentAccountId}`: detalle de una cuenta corriente

### movimiento-api
No distingue entre ahorro y corriente: basta el número de cuenta.
- `GET /position-keeping/v1/accounts/{accountNumber}/transactions`: movimientos de la cuenta (más reciente primero).
  Filtros opcionales: `fromBookingDate`, `toBookingDate` (YYYY-MM-DD), `creditDebitIndicator` (CRDT|DBIT), `status` (BOOK|PDNG), `limit` (1-100, por defecto 50), `offset`.
- `GET /position-keeping/v1/transactions/{transactionId}`: detalle de un movimiento (`MOV-YYYYMMDD-NNNNNN`).

Cada movimiento sigue el *ReportEntry* de ISO 20022 camt.052/053 (BankTransactionCode, EntryDetails, RelatedParties, RemittanceInformation).
El saldo tras el último movimiento `BOOK` coincide con el saldo contable (`ITBD`) de cuentas-api, y los `PDNG` explican la diferencia con el disponible (`ITAV`).
Las transferencias entre cuentas del banco aparecen en ambas cuentas con el mismo `EndToEndIdentification`.

## Datos de prueba

| Identificación | Cliente | Ahorros | Corrientes |
|---|---|---|---|
| 1710034065 | María Fernanda Andrade López | 2200145678, 2200198765 | 1100456789 |
| 0912345675 | Carlos Alberto Mendoza Ruiz | 2200234567 | 1100678901 (sobregirada) |
| 0102030405 | Lucía Esperanza Vintimilla Cordero (inactiva) | 2200345678 (DISA) | — |
| 1790012345001 | Comercializadora Andina S.A. (RUC) | — | 1100567890 |

## Caché de dependencias

Cada `Dockerfile` usa dos niveles de caché:
1. **Capa de Docker**: `package.json` y `package-lock.json` se copian antes que el código, así que la etapa `deps` solo se reconstruye cuando cambian las dependencias.
2. **Cache mount de BuildKit** (`--mount=type=cache,id=npm-cache,target=/root/.npm`): el caché de npm se guarda fuera de la imagen y lo comparten ambos servicios. Aunque cambie el lockfile, solo se descarga lo nuevo.

## Seguridad: Keycloak 26.7.4 + WSO2 API Manager 4.7.0

Cada producto de WSO2 **solo acepta tokens emitidos por su reino de Keycloak**:

| Reino Keycloak | Key Manager en WSO2 | Audiencia (`aud`) | Producto | APIs |
|---|---|---|---|---|
| `reino-cliente` | `KM-reino-cliente` | `pro-cliente` | `pro-cliente` → `/pro-cliente/1.0.0` | clientes-api |
| `reino-cuenta` | `KM-reino-cuenta` | `pro-cuenta` | `pro-cuenta` → `/pro-cuenta/1.0.0` | cuentas-api, movimiento-api |

Se aplican dos restricciones:
1. **Audiencia:** cada reino agrega a todos sus tokens `aud=<producto>` (client scope `aud-<producto>` por defecto del reino) y cada producto y sus APIs exigen esa audiencia. Un token de otro reino se rechaza con 403.
2. **Key Manager:** cada API (`/clientes`, `/cuentas`, `/movimientos`) solo acepta el Key Manager de su reino. Un token de otro reino o del Key Manager interno de WSO2 se rechaza con 401.

### Arranque

`docker compose up -d` levanta todo y ejecuta el job `setup` (`setup/index.mjs`), que es idempotente:
- **Keycloak** (`setup/keycloak.mjs`): crea los reinos, el client scope de audiencia, el client scope opcional `default` (WSO2 lo solicita al pedir tokens) y el cliente `wso2-km` con service account y roles `manage-clients`/`create-client`, con el que WSO2 registra las aplicaciones en el reino (DCR).
- **WSO2** (`setup/wso2.mjs`): registra los dos Key Managers de tipo KeyCloak, importa las 3 APIs desde su `/openapi.json`, crea los productos, aplica las restricciones, despliega y publica. Si algo ya existe con otra configuración, lo corrige y lo vuelve a desplegar.

La configuración compartida (reinos ↔ productos ↔ APIs) está en `setup/config.mjs`.

### Acceso desde otras máquinas (`PUBLIC_HOST`)

WSO2 redirige el login de sus consolas a su `hostname`, y Keycloak usa `KC_HOSTNAME` como issuer de los tokens. Ambos salen de **`PUBLIC_HOST` en `.env`** (copia `.env.example` a `.env`):

- `wso2/deployment.toml` (montado en el contenedor) usa `hostname = "$env{PUBLIC_HOST}"` y el mismo host en las URLs del gateway. La clave `[encryption]` con la que WSO2 cifra los secretos de su base de datos sale de **`WSO2_ENCRYPTION_KEY` en `.env`** (genérala con `openssl rand -hex 32`): no la cambies sin borrar el volumen `wso2am-db`.
- Keycloak: `KC_HOSTNAME=http://${PUBLIC_HOST}:8180`, y el issuer queda como `http://<PUBLIC_HOST>:8180/realms/<reino>`.

Para usar otra IP o un nombre DNS (por ejemplo la de la red local), cambia `PUBLIC_HOST` y ejecuta `docker compose up -d`. El job `setup` actualiza el issuer de los Key Managers y el vhost de los despliegues. Los tokens emitidos antes del cambio dejan de ser válidos.

| Consola | URL | Usuario |
|---|---|---|
| Keycloak | http://<PUBLIC_HOST>:8180/admin | admin / admin |
| WSO2 Publisher | https://<PUBLIC_HOST>:9443/publisher | admin / admin |
| WSO2 Developer Portal | https://<PUBLIC_HOST>:9443/devportal | admin / admin |
| WSO2 Admin (Key Managers) | https://<PUBLIC_HOST>:9443/admin | admin / admin |
| Gateway | https://<PUBLIC_HOST>:8243 (HTTPS), http://<PUBLIC_HOST>:8280 (HTTP) | token OAuth2 |

> Los reinos de Keycloak (incluido `master`) tienen `sslRequired=none`, porque Keycloak corre por HTTP y por defecto exige HTTPS a clientes fuera de redes privadas (las IPs 100.x de Tailscale no cuentan como privadas). Solo para desarrollo.
>
> Keycloak se publica en el puerto **8180** del host (el 8080 lo usa otro servicio). WSO2 usa un certificado autofirmado emitido para `localhost`: el navegador mostrará una advertencia que hay que aceptar.

Los datos persisten en los volúmenes `wso2am-db`, `wso2am-solr` (índice de búsqueda de WSO2) y `keycloak-data`. `docker compose down -v` los borra y el siguiente `up` recrea todo.

### Flujo M2M para un consumidor

1. En el Developer Portal, crear una aplicación y suscribirla a `pro-cliente` o `pro-cuenta`.
2. En *Production Keys*, elegir el Key Manager del reino (`KM-reino-cliente` o `KM-reino-cuenta`) y generar las claves con el grant **Client Credentials**. WSO2 crea el cliente en ese reino de Keycloak.
3. Pedir el token a Keycloak:
   ```bash
   curl -s -u "$CLIENT_ID:$CLIENT_SECRET" -d grant_type=client_credentials \
     http://<PUBLIC_HOST>:8180/realms/reino-cuenta/protocol/openid-connect/token
   ```
4. Llamar al gateway:
   ```bash
   curl -k -H "Authorization: Bearer $TOKEN" \
     https://<PUBLIC_HOST>:8243/pro-cuenta/1.0.0/position-keeping/v1/accounts/2200145678/transactions
   ```

### Prueba de aislamiento por reino

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 node setup/test-gateway.mjs
```

Recrea la aplicación `app-prueba-banca`, la suscribe a los 2 productos y las 3 APIs, genera claves en los dos reinos y en el Key Manager interno de WSO2, y verifica la matriz completa: solo el reino dueño obtiene 200, cualquier otro emisor recibe 401/403, y sin token se recibe 401.

## Canales: banca-persona, banca-empresa y banca-mujer (acceso entre reinos)

| Aplicación | URL | Reino del canal | Cliente |
|---|---|---|---|
| banca-persona (Next.js 16) | http://localhost:3101 | `reino-banca-persona` | `banca-persona` / `banca-persona-secret` |
| banca-empresa (Next.js 16) | http://localhost:3102 | `reino-banca-empresa` | `banca-empresa` / `banca-empresa-secret` |
| banca-mujer (Next.js 16) | http://localhost:3103 | `reino-banca-persona` | `banca-mujer` / `banca-mujer-secret` |

Cada aplicación **solo tiene credenciales en el reino de su canal** y usa OAuth 2.0 Client Credentials. Para llamar a `pro-cliente` y `pro-cuenta` necesita tokens de `reino-cliente` y `reino-cuenta`, que obtiene sin tener secretos en esos reinos.

Un reino de canal puede tener varias aplicaciones: `banca-mujer` está registrada en `reino-banca-persona`, junto a `banca-persona`. Ambas comparten el Identity Provider `reino-banca-persona` en los reinos de API, pero cada una tiene su propio cliente, su rol (`perfil-banca-persona` o `perfil-banca-mujer`) y sus permisos. Los reinos de API distinguen a las dos aplicaciones por el `sub` de la assertion (el service account de cada cliente).

### ¿Sirve Token Exchange entre reinos?

No directamente. En Keycloak 26.7:
- **Token Exchange estándar (RFC 8693, v2, soportado)** solo intercambia tokens **dentro del mismo reino**. Un `subject_token` de otro reino se rechaza (lo verifica `setup/test-canales.mjs`).
- **Token Exchange legacy (v1)** sí acepta tokens externos a través de un Identity Provider, pero exige habilitar la feature `token-exchange` (preview) y `admin-fine-grained-authz:v1` (**deprecada**). No se usa.
- La opción soportada es **Federated client authentication (RFC 7523)**, *supported* desde 26.6: el reino destino registra al reino del canal como Identity Provider y acepta sus tokens como `client_assertion`.

Por eso la solución **no usa Token Exchange**: solo Client Credentials y client assertions federadas.

```
banca-persona ──(1) client_credentials + secret  scope=aud-reino-cuenta ──▶ reino-banca-persona
              ◀─ token A  aud=reino-cuenta
              ──(2) client_credentials  client_assertion=A ──▶ reino-cuenta
                    (valida la firma con el JWKS de reino-banca-persona, iss, aud=reino-cuenta,
                     sub = service account de banca-persona, jti de un solo uso, ≤ 300 s)
              ◀─ token B  iss=reino-cuenta  azp=banca-persona  aud=pro-cuenta  scope=<según rol>
              ──(3) Bearer B ────────────────────────────────▶ WSO2 /pro-cuenta/1.0.0/...
```

La client assertion debe tener **una sola audiencia**, que es el reino destino. Por eso cada `aud-<reino>` es un client scope **opcional** del canal: el canal pide en `scope` solo el del reino al que va. Keycloak rechaza la assertion si se reutiliza (`Token reuse detected`) o si trae varias audiencias (`Multiple audiences not allowed`).

### Qué configura el setup

En `reino-banca-persona` y `reino-banca-empresa`:
- El cliente confidencial del canal, con service account, Token Exchange deshabilitado y `fullScopeAllowed=false` (sin roles en el token; con los roles por defecto del reino Keycloak agregaría `aud=account` y la assertion tendría varias audiencias).
- Un client scope `aud-<reino>` por cada reino de API (`reino-cliente`, `reino-cuenta`), asignado al canal como **opcional**.

En `reino-cliente` y `reino-cuenta`:
- **Identity Provider** `reino-banca-*` (OIDC), uno por reino de canal: `supportsClientAssertions`, `allowClientIdAsAudience` con `clientId=<reino>`, validación de firma por JWKS y sin reutilización. Tiene `hideOnLogin` y `linkOnly`, así que no sirve para iniciar sesión.
- **Cliente** `banca-*` (uno por aplicación) con autenticador `federated-jwt` (*Signed JWT - Federated*): `jwt.credential.issuer=<alias del IdP>` y `jwt.credential.sub=<id del service account en el reino del canal>`. No tiene secreto.
- **Roles** `perfil-banca-persona`, `perfil-banca-empresa` y `perfil-banca-mujer`, asignados al service account del cliente correspondiente.
- **Scopes de permiso** (client scopes): cada uno tiene como *role scope mapping* los perfiles autorizados, y Keycloak solo lo incluye en el token si el service account tiene uno de esos roles.

En WSO2:
- Cada operación exige su scope (scopes locales de la API, propagados a los productos).
- Las aplicaciones `banca-persona`, `banca-empresa` y `banca-mujer` están suscritas a los dos productos, con sus clientes de Keycloak asociados por `map-keys` (WSO2 no crea claves).

### Matriz de permisos (`CHANNELS` y `SCOPES` en `setup/config.mjs`)

| Scope | Operación | banca-persona | banca-empresa | banca-mujer |
|---|---|:-:|:-:|:-:|
| `party:list` | `GET /parties` | ✓ | — | ✓ |
| `party:read` | `GET /parties/{id}` | ✓ | ✓ | — |
| `party-address:read` | `GET /parties/{id}/addresses` | ✓ | — | — |
| `savings-account:read` | ahorro (2 operaciones) | ✓ | ✓ | ✓ |
| `current-account:read` | corriente (2 operaciones) | ✓ | ✓ | ✓ |
| `transaction:list` | `GET /accounts/{n}/transactions` | ✓ | ✓ | — |
| `transaction:read` | `GET /transactions/{id}` | — | ✓ | ✓ |

Para cambiar un permiso, edita `permissions` del canal y ejecuta `docker compose run --rm setup`. El setup ajusta los role scope mappings y el cambio aplica en el siguiente token (≤ 5 min).

Cada página muestra los datos permitidos, la tabla de **Permisos del canal** (prueba las 9 operaciones: 200 o 403) y la **Cadena de tokens** con los claims de cada paso. Keycloak y el gateway se consumen desde el servidor de Next.js (`lib/oauth.ts`, `lib/gateway.ts`), así que el navegador nunca recibe tokens.

Las tres aplicaciones tienen el mismo menú: **General** (la página anterior) y **Consulta** (lista de clientes y detalle por cliente en `/consulta/{id}`, con una card por endpoint). Cada card ejecuta la cadena completa al pulsar *Consultar* y muestra el resultado y el **paso a paso** HTTP. Las cards cuyo scope no emite el reino al canal se muestran **en rojo**: sirven para ver el flujo de una petición sin acceso (el gateway responde 403).

### Pruebas

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 node setup/test-canales.mjs   # cadena de tokens, casos negativos y matriz 200/403
NODE_TLS_REJECT_UNAUTHORIZED=0 node setup/test-gateway.mjs   # aislamiento por reino (otorga todos los scopes a sus clientes)
```

> Un token del reino del canal presentado directamente en el gateway se rechaza con **500** (`900900 Unclassified Authentication Failure`). Es la respuesta de WSO2 a un emisor que no es un Key Manager registrado.
