import { components } from './components';
import { systemPaths } from './paths/system.paths';
import { authPaths, TAG_AUTH } from './paths/auth.paths';

/**
 * Especificación OpenAPI 3 de la API (servida en /api/docs y /api/docs.json).
 *
 * Fuente única de verdad: cada dominio agrega sus rutas en src/docs/paths/*.paths.ts
 * y los cuerpos de petición se generan desde los esquemas Zod de src/validators,
 * los mismos que validan las peticiones reales.
 */
export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Salón de Estudio Colaborativo - Backend API',
    version: '1.1.0',
    description: `
API REST del MiniProyecto 2: **Salón de Estudio Colaborativo en Tiempo Real** (Node.js + TypeScript, arquitectura por capas, Firestore).

### Autenticación
Las rutas con candado 🔒 requieren el **ID token de Firebase** en \`Authorization: Bearer <token>\`.
Use el botón **Authorize** para probarlas desde aquí.

### Contrato de errores (TS-05)
Todos los errores responden \`{ "error": { "code", "message", "fields" } }\` con mensajes en español y sin detalles internos.
`,
    contact: { name: 'Equipo de Desarrollo MiniProyecto 2' },
  },
  servers: [{ url: '/', description: 'Servidor actual (relativo)' }],
  tags: [
    {
      name: TAG_AUTH,
      description:
        'Registro e inicio de sesión. El login ocurre en el frontend con Firebase Auth; la API verifica el ID token en cada ruta privada (401 sin token).',
    },
    { name: 'Salud del Sistema (Health)', description: 'Monitoreo del estado de la API y de Firestore' },
    { name: 'Arquetipo Base (TS-00)', description: 'Base técnica: lectura y escritura de un dato en Firestore' },
    { name: 'Contrato de Errores (TS-05)', description: 'Demostración del formato estándar de errores' },
  ],
  components,
  paths: {
    ...authPaths,
    ...systemPaths,
  },
};
