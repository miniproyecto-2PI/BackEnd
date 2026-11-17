import { components } from './components';
import { systemPaths } from './paths/system.paths';
import { authPaths, TAG_AUTH } from './paths/auth.paths';
import { usersPaths, TAG_USERS } from './paths/users.paths';
// NUEVO: Importar rutas de salas y su etiqueta
import { roomsPaths, TAG_ROOMS } from './paths/rooms.paths';

/**
 * Especificación OpenAPI 3 de la API (servida en /api/docs y /api/docs.json).
 */
export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Salón de Estudio Colaborativo - Backend API',
    version: '1.2.0', // Actualizado para el Sprint 2
    description: `
API REST del MiniProyecto 2: **Salón de Estudio Colaborativo en Tiempo Real** (Node.js + TypeScript, arquitectura por capas, Firestore).

### Autenticación
El frontend **no usa el SDK de Firebase**: inicia sesión con \`POST /api/auth/login\` (o Google por redirección en \`GET /api/auth/google\`) y recibe \`data.session.idToken\`.
Las rutas con candado 🔒 requieren ese token en \`Authorization: Bearer <token>\`. Use el botón **Authorize** para probarlas desde aquí.

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
        'Registro, inicio y cierre de sesión hechos por la API (correo/contraseña y Google por redirección OAuth 2.0). La API verifica el ID token en cada ruta privada (401 sin token).',
    },
    {
      name: TAG_USERS,
      description: 'Perfil del usuario autenticado, edición (US-04), eliminación de cuenta (US-05) y finalización del registro con Google.',
    },
    {
      name: TAG_ROOMS, // NUEVO
      description: 'Creación y visualización de salas de estudio propias (US-06).',
    },
    { name: 'Salud del Sistema (Health)', description: 'Monitoreo del estado de la API y de Firestore' },
    { name: 'Arquetipo Base (TS-00)', description: 'Base técnica: lectura y escritura de un dato en Firestore' },
    { name: 'Contrato de Errores (TS-05)', description: 'Demostración del formato estándar de errores' },
  ],
  components,
  paths: {
    ...authPaths,
    ...usersPaths,
    ...roomsPaths, // NUEVO
    ...systemPaths,
  },
};