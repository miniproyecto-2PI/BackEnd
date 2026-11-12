import { errorRef, jsonBody, successResponse } from '../openapi.helpers';
import { seedArchetypeSchema } from '../../validators/archetype.schemas';

const TAG_HEALTH = 'Salud del Sistema (Health)';
const TAG_ARCHETYPE = 'Arquetipo Base (TS-00)';
const TAG_ERRORS = 'Contrato de Errores (TS-05)';

const archetypeRef = { $ref: '#/components/schemas/ArchetypeData' };

export const systemPaths = {
  '/api/health': {
    get: {
      tags: [TAG_HEALTH],
      summary: 'Estado del servicio y conectividad con Firestore',
      description: 'Uptime de la API y latencia de conexión con Firestore. Lo usa Render como health check.',
      responses: {
        '200': {
          description: 'Servicio en funcionamiento',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
        },
      },
    },
  },

  '/api/archetype/data': {
    get: {
      tags: [TAG_ARCHETYPE],
      summary: 'Lee el documento base desde Firestore',
      description:
        'Endpoint de la base técnica (TS-00): consulta Firestore y responde el dato que el frontend renderiza en /base-tecnica. Si el documento no existe, lo crea.',
      responses: {
        '200': successResponse('Dato leído exitosamente desde Firestore', archetypeRef),
        '503': errorRef('ServiceUnavailable'),
      },
    },
  },

  '/api/archetype/seed': {
    post: {
      tags: [TAG_ARCHETYPE],
      summary: 'Crea o actualiza el documento base en Firestore',
      description:
        'Permite modificar el dato de la base técnica para comprobar que el frontend refleja el cambio al recargar.',
      requestBody: jsonBody(
        seedArchetypeSchema,
        { description: 'Texto actualizado para prueba de persistencia' },
        false
      ),
      responses: {
        '201': successResponse('Dato de prueba creado/actualizado correctamente en Firestore', archetypeRef),
        '400': errorRef('BadRequest'),
        '503': errorRef('ServiceUnavailable'),
      },
    },
  },

  '/api/errors/demo-400': {
    get: {
      tags: [TAG_ERRORS],
      summary: 'Demostración de 400 VALIDATION_ERROR',
      responses: { '400': errorRef('BadRequest') },
    },
  },
  '/api/errors/demo-401': {
    get: {
      tags: [TAG_ERRORS],
      summary: 'Demostración de 401 UNAUTHENTICATED',
      responses: { '401': errorRef('Unauthorized') },
    },
  },
  '/api/errors/demo-404': {
    get: {
      tags: [TAG_ERRORS],
      summary: 'Demostración de 404 NOT_FOUND',
      responses: { '404': errorRef('NotFound') },
    },
  },
};
