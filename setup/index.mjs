// Job de configuración: primero Keycloak (reinos y clientes), luego WSO2 (Key Managers, APIs y productos)
import { setupKeycloak } from './keycloak.mjs';
import { setupWso2 } from './wso2.mjs';

try {
  console.log('--- Keycloak');
  await setupKeycloak();
  console.log('--- WSO2 API Manager');
  await setupWso2();
  console.log('Configuración completada');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
