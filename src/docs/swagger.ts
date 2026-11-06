import { env } from '../config/env';

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Salón de Estudio Colaborativo - Backend API',
    version: '1.0.0',
    description: `
API REST para el MiniProyecto 2: **Salón de Estudio Colaborativo en Tiempo Real**.
Implementada en **Node.js + TypeScript** bajo una arquitectura por capas (Rutas, Lógica y Acceso a Datos con Firestore).

### Estándares del Proyecto:
- **TS-00 (Sprint 0)**: Base técnica con lectura directa a Firestore y despliegue en Render con Docker.
- **TS-05**: Contrato API y manejo estándar de respuestas de error (\`{ error: { code, message, fields } }\`) en español sin detalles internos.
    `,
    contact: {
      name: 'Equipo de Desarrollo MiniProyecto 2',
    },
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: 'Servidor Local de Desarrollo',
    },
    {
      url: 'https://backend-miniproyecto2.onrender.com',
      description: 'Servidor de Producción (Render)',
    },
  ],
  tags: [
    {
      name: 'Arquetipo Base (TS-00)',
      description: 'Endpoints para validar la base técnica y la lectura de datos desde Firestore',
    },
    {
      name: 'Salud del Sistema (Health)',
      description: 'Monitoreo de estado de la API y conectividad',
    },
    {
      name: 'Contrato de Errores (TS-05)',
      description: 'Demostración del estándar de errores (400, 401, 403, 404, 409, 500)',
    },
  ],
  components: {
    schemas: {
      StandardErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                description: 'Código de error estándar (enum)',
                enum: [
                  'VALIDATION_ERROR',
                  'UNAUTHENTICATED',
                  'FORBIDDEN',
                  'PROFILE_INCOMPLETE',
                  'NOT_FOUND',
                  'ROOM_NOT_FOUND',
                  'USERNAME_TAKEN',
                  'EMAIL_IN_USE',
                  'DATABASE_ERROR',
                  'INTERNAL',
                ],
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                description: 'Mensaje descriptivo en español sin jerga técnica para el usuario',
                example: 'Los datos enviados son inválidos. Revise los campos señalados.',
              },
              fields: {
                type: 'object',
                nullable: true,
                description: 'Mapa de campos específicos con error (si aplica)',
                additionalProperties: {
                  type: 'string',
                },
                example: {
                  email: 'El formato de correo no es válido.',
                },
              },
            },
          },
        },
      },
      ArchetypeData: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'sprint-0' },
          projectName: {
            type: 'string',
            example: 'Salón de Estudio Colaborativo en Tiempo Real',
          },
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
            example: [
              'Arquitectura por capas',
              'Lectura y persistencia con Firebase Firestore',
              'Contenedorización con Docker y Docker Compose',
              'Manejo de errores estándar TS-05',
            ],
          },
        },
      },
      ApiResponseSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Dato leído exitosamente desde Firestore' },
          data: { $ref: '#/components/schemas/ArchetypeData' },
          timestamp: { type: 'string', format: 'date-time', example: '2026-11-06T10:00:00.000Z' },
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
              status: { type: 'string', example: 'healthy' },
              latencyMs: { type: 'number', example: 45 },
              type: { type: 'string', example: 'Google Cloud Firestore' },
            },
          },
          version: { type: 'string', example: '1.0.0' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Salud del Sistema (Health)'],
        summary: 'Verifica el estado del servicio y la conectividad con Firestore',
        description: 'Retorna el estado de la API, uptime y latencia de conexión con Google Cloud Firestore.',
        responses: {
          '200': {
            description: 'Servicio en funcionamiento',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/api/archetype/data': {
      get: {
        tags: ['Arquetipo Base (TS-00)'],
        summary: 'Lee el documento de configuración base desde Firestore',
        description:
          'Endpoint principal del Sprint 0 (TS-00). Consulta la colección en Firestore y responde los datos al frontend. Si la BD falla, responde con el formato estándar TS-05.',
        responses: {
          '200': {
            description: 'Dato leído exitosamente desde Firestore',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponseSuccess' },
              },
            },
          },
          '503': {
            description: 'Error de comunicación con Firestore (DATABASE_ERROR)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' },
                example: {
                  error: {
                    code: 'DATABASE_ERROR',
                    message: 'El servicio de base de datos no está disponible temporalmente.',
                    fields: null,
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/archetype/seed': {
      post: {
        tags: ['Arquetipo Base (TS-00)'],
        summary: 'Inicializa o actualiza el documento de prueba en Firestore',
        description:
          'Permite resembrar o modificar los datos en Firestore para comprobar en vivo que el frontend refleja el cambio al recargar.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  projectName: { type: 'string', example: 'Salón de Estudio Colaborativo' },
                  description: { type: 'string', example: 'Texto actualizado para prueba de persistencia' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Documento creado o actualizado en Firestore',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponseSuccess' },
              },
            },
          },
          '400': {
            description: 'Datos inválidos (VALIDATION_ERROR)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' },
              },
            },
          },
          '503': {
            description: 'Error de base de datos (DATABASE_ERROR)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/errors/demo-400': {
      get: {
        tags: ['Contrato de Errores (TS-05)'],
        summary: 'Demostración de error 400 VALIDATION_ERROR',
        description: 'Endpoint de prueba que simula un fallo de validación de campos según el estándar TS-05.',
        responses: {
          '400': {
            description: 'Error de validación uniforme',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' },
                example: {
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Los datos enviados son inválidos. Revise los campos señalados.',
                    fields: {
                      email: 'El formato de correo no es válido.',
                      username: 'El nombre de usuario no puede contener espacios.',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/errors/demo-401': {
      get: {
        tags: ['Contrato de Errores (TS-05)'],
        summary: 'Demostración de error 401 UNAUTHENTICATED',
        description: 'Endpoint de prueba que simula un acceso sin token de autenticación.',
        responses: {
          '401': {
            description: 'Error de autenticación uniforme',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' },
                example: {
                  error: {
                    code: 'UNAUTHENTICATED',
                    message: 'Debe iniciar sesión para acceder a este recurso.',
                    fields: null,
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/errors/demo-404': {
      get: {
        tags: ['Contrato de Errores (TS-05)'],
        summary: 'Demostración de error 404 NOT_FOUND',
        description: 'Endpoint de prueba que simula la búsqueda de un recurso inexistente.',
        responses: {
          '404': {
            description: 'Error de recurso no encontrado uniforme',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' },
                example: {
                  error: {
                    code: 'NOT_FOUND',
                    message: 'El recurso solicitado no fue encontrado.',
                    fields: null,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
