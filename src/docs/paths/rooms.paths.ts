import { errorRef, jsonBody, successResponse } from '../openapi.helpers';
import { createRoomSchema } from '../../validators/room.schemas';

export const TAG_ROOMS = 'Salas (US-06 y US-07)';
const ownerOperation = {
  tags: [TAG_ROOMS],
  security: [{ bearerAuth: [] }],
  parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
};
const ownerErrors = {
  401: errorRef('Unauthorized'), 403: errorRef('Forbidden'), 404: errorRef('NotFound'),
};

export const roomsPaths = {
  '/api/rooms/{id}/messages': {
    get: {
      tags: [TAG_ROOMS], security: [{ bearerAuth: [] }],
      summary: 'Consultar el historial del chat (US-11)',
      description: 'Devuelve la página más reciente en orden cronológico. Para cargar mensajes anteriores, enviar nextBefore como before. Una sala vacía devuelve messages: [], hasMore: false y nextBefore: null.',
      parameters: [
        ...ownerOperation.parameters,
        { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 50, default: 50 } },
        { in: 'query', name: 'before', description: 'Cursor exclusivo de la misma sala.', schema: { type: 'string' } },
      ],
      responses: {
        200: successResponse('Página de historial', {
          type: 'object', required: ['messages', 'hasMore', 'nextBefore'],
          properties: {
            messages: { type: 'array', items: { type: 'object', properties: {
              id: { type: 'string' }, roomId: { type: 'string' }, text: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              author: { type: 'object', properties: { uid: { type: 'string' }, name: { type: 'string' }, avatar: { type: 'string', nullable: true } } },
            } } },
            hasMore: { type: 'boolean' }, nextBefore: { type: 'string', nullable: true },
          },
        }),
        400: errorRef('BadRequest'), 401: errorRef('Unauthorized'),
        404: { description: 'ROOM_NOT_FOUND. La sala no existe o está en eliminación.' },
        503: errorRef('ServiceUnavailable'),
      },
    },
  },
  '/api/rooms': {
    post: {
      tags: [TAG_ROOMS],
      summary: 'Crear una sala de estudio',
      description: 'Crea una sala con un ID único generado por el servidor. El creador se convierte en el anfitrión (ownerId).',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: {
                  type: 'string',
                  example: 'Cálculo Multivariable',
                  description: 'Nombre de la sala (3 a 60 caracteres).',
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Sala creada exitosamente.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Sala creada exitosamente.' },
                  data: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'A3B4C5D6' },
                      name: { type: 'string', example: 'Cálculo Multivariable' },
                      ownerId: { type: 'string', example: 'uid123' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Datos inválidos (ej. nombre menor a 3 caracteres o mayor a 60).' },
        401: { description: 'No autorizado (falta token o es inválido).' },
      },
    },
    get: {
      tags: [TAG_ROOMS],
      summary: 'Listar mis salas',
      description: 'Devuelve un arreglo con las salas creadas por el usuario autenticado (ownerId = token.uid).',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Lista de salas del usuario.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'A3B4C5D6' },
                        name: { type: 'string', example: 'Cálculo Multivariable' },
                        ownerId: { type: 'string', example: 'uid123' },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'No autorizado.' },
      },
    },
  },
  '/api/rooms/{id}': {
    patch: {
      ...ownerOperation,
      summary: 'Cambiar el nombre de una sala propia',
      requestBody: jsonBody(createRoomSchema, { name: 'Grupo de cálculo' }),
      responses: { ...ownerErrors, 200: { description: 'Sala actualizada en data.' }, 400: errorRef('BadRequest') },
    },
    delete: {
      ...ownerOperation,
      summary: 'Eliminar una sala propia y su chat',
      responses: { ...ownerErrors, 204: { description: 'Sala y mensajes eliminados.' } },
    },
    get: {
      tags: [TAG_ROOMS],
      summary: 'Obtener una sala por ID',
      description: 'Devuelve los detalles de una sala específica.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', example: 'A3B4C5D6' },
          description: 'ID único de la sala.',
        },
      ],
      responses: {
        200: {
          description: 'Datos de la sala.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'A3B4C5D6' },
                      name: { type: 'string', example: 'Cálculo Multivariable' },
                      ownerId: { type: 'string', example: 'uid123' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'No autorizado.' },
        400: errorRef('BadRequest'),
        403: errorRef('Forbidden'),
        404: {
          description: 'ROOM_NOT_FOUND. La sala no existe o se está eliminando.',
          content: { 'application/json': {
            schema: { $ref: '#/components/schemas/StandardErrorResponse' },
            example: { error: { code: 'ROOM_NOT_FOUND', message: 'No encontramos una sala con ese ID. Revisa que esté bien escrito.', fields: null } },
          } },
        },
      },
    },
  },
};
