/**
 * Componentes reutilizables de la especificación OpenAPI:
 * esquemas, respuestas de error estándar (TS-05) y esquema de seguridad.
 */

const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'PROFILE_INCOMPLETE',
  'NOT_FOUND',
  'ROOM_NOT_FOUND',
  'USERNAME_TAKEN',
  'EMAIL_IN_USE',
  'DATABASE_ERROR',
  'SERVICE_UNAVAILABLE',
  'INTERNAL',
];

const errorExample = (code: string, message: string, fields: Record<string, string> | null = null) => ({
  'application/json': {
    schema: { $ref: '#/components/schemas/StandardErrorResponse' },
    example: { error: { code, message, fields } },
  },
});

export const components = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'Firebase ID token (JWT)',
      description:
        'ID token emitido por Firebase Authentication en el frontend (`await user.getIdToken()`). ' +
        'Se envía como `Authorization: Bearer <token>`. Sin token o con token inválido/vencido la API responde 401 UNAUTHENTICATED.',
    },
  },

  schemas: {
    StandardErrorResponse: {
      type: 'object',
      required: ['error'],
      description: 'Formato único de error (TS-05). Mensajes en español y sin detalles internos.',
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string', enum: ERROR_CODES, example: 'VALIDATION_ERROR' },
            message: {
              type: 'string',
              example: 'Los datos enviados son inválidos. Revise los campos señalados.',
            },
            fields: {
              type: 'object',
              nullable: true,
              description: 'Mensaje por campo cuando el error se asocia a campos concretos.',
              additionalProperties: { type: 'string' },
              example: { email: 'El formato de correo no es válido.' },
            },
          },
        },
      },
    },

    SuccessEnvelope: {
      type: 'object',
      description: 'Envoltorio estándar de las respuestas exitosas.',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Operación realizada correctamente' },
        data: { description: 'Contenido de la respuesta (ver cada endpoint).' },
        timestamp: { type: 'string', format: 'date-time', example: '2026-11-10T15:00:00.000Z' },
      },
    },

    ArchetypeData: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'sprint-0' },
        projectName: { type: 'string', example: 'Salón de Estudio Colaborativo en Tiempo Real' },
        sprint: { type: 'string', example: 'Sprint 0: Fundamentación UX y Base Técnica End-to-End' },
        version: { type: 'string', example: '1.0.0' },
        description: {
          type: 'string',
          example: 'Base técnica operativa y comunicada con Firestore para el Sprint 0 (TS-00).',
        },
        databaseStatus: { type: 'string', enum: ['connected', 'disconnected'], example: 'connected' },
        environment: { type: 'string', example: 'production' },
        updatedAt: { type: 'string', format: 'date-time', example: '2026-11-06T10:00:00.000Z' },
        features: {
          type: 'array',
          items: { type: 'string' },
          example: ['Arquitectura por capas', 'Lectura y persistencia con Firebase Firestore'],
        },
      },
    },

    HealthResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        status: { type: 'string', example: 'UP' },
        service: { type: 'string', example: 'backend-api' },
        environment: { type: 'string', example: 'production' },
        uptimeSeconds: { type: 'number', example: 120 },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy'], example: 'healthy' },
            latencyMs: { type: 'number', example: 45 },
            type: { type: 'string', example: 'Google Cloud Firestore' },
          },
        },
        version: { type: 'string', example: '1.0.0' },
      },
    },
  },

  responses: {
    BadRequest: {
      description: 'Datos inválidos (400 VALIDATION_ERROR)',
      content: errorExample('VALIDATION_ERROR', 'Los datos enviados son inválidos. Revise los campos señalados.', {
        username: 'El nombre de usuario debe tener entre 3 y 20 caracteres.',
      }),
    },
    Unauthorized: {
      description: 'Sin sesión o token inválido/vencido (401 UNAUTHENTICATED)',
      content: errorExample('UNAUTHENTICATED', 'Debe iniciar sesión para acceder a este recurso.'),
    },
    Forbidden: {
      description: 'Sin permisos (403 FORBIDDEN) o perfil incompleto (403 PROFILE_INCOMPLETE)',
      content: errorExample(
        'PROFILE_INCOMPLETE',
        'Debe completar su perfil y elegir un nombre de usuario antes de continuar.'
      ),
    },
    NotFound: {
      description: 'Recurso no encontrado (404 NOT_FOUND)',
      content: errorExample('NOT_FOUND', 'El recurso solicitado no fue encontrado.'),
    },
    Conflict: {
      description: 'Dato ya en uso (409 USERNAME_TAKEN o EMAIL_IN_USE)',
      content: errorExample(
        'USERNAME_TAKEN',
        'El nombre de usuario ya se encuentra registrado por otro estudiante.',
        { username: 'Este nombre de usuario no está disponible.' }
      ),
    },
    ServiceUnavailable: {
      description:
        'Base de datos (503 DATABASE_ERROR) o Firebase Authentication (503 SERVICE_UNAVAILABLE) no disponibles',
      content: errorExample('DATABASE_ERROR', 'El servicio de base de datos no está disponible temporalmente.'),
    },
    InternalError: {
      description: 'Error inesperado (500 INTERNAL)',
      content: errorExample(
        'INTERNAL',
        'Ha ocurrido un error inesperado en el servidor. Por favor intente más tarde.'
      ),
    },
  },
};
