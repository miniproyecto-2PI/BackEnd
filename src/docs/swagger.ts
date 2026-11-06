import swaggerJSDoc from 'swagger-jsdoc';
import { env } from '../config/env';

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Salón de Estudio Colaborativo - Backend API',
    version: '1.0.0',
    description: `
API REST para el MiniProyecto 2: **Salón de Estudio Colaborativo en Tiempo Real**.
Implementada en **Node.js + TypeScript** siguiendo una arquitectura por capas (Rutas, Lógica y Acceso a Datos con Firestore).

### Sprint 0 (TS-00): Base Técnica End-to-End
- **Lectura en Firestore**: Endpoint que recupera datos del estado del sistema directamente desde Firestore.
- **Manejo de errores**: Respuestas estructuradas con códigos claros en caso de fallas de base de datos o validación.
- **Despliegue**: Preparado para contenerización con Docker y despliegue continuo en Render.
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
  ],
  components: {
    schemas: {
      ApiResponseSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Dato leído exitosamente desde Firestore' },
          data: { $ref: '#/components/schemas/ArchetypeData' },
          timestamp: { type: 'string', format: 'date-time', example: '2026-11-05T17:30:00.000Z' },
        },
      },
      ApiResponseError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'El servicio de Firestore no se encuentra disponible temporalmente.' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'FIRESTORE_ERROR' },
              message: { type: 'string', example: 'Detalle legible del error' },
              details: { type: 'object' },
            },
          },
          timestamp: { type: 'string', format: 'date-time', example: '2026-11-05T17:30:00.000Z' },
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
            example: 'Base técnica operativa comunicada con Firestore para Sprint 0.',
          },
          databaseStatus: { type: 'string', enum: ['connected', 'disconnected'], example: 'connected' },
          environment: { type: 'string', example: 'production' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-11-05T17:30:00.000Z' },
          features: {
            type: 'array',
            items: { type: 'string' },
            example: [
              'Arquitectura por capas',
              'Persistencia con Firestore',
              'Docker & Render ready',
            ],
          },
        },
      },
    },
  },
};

const options: swaggerJSDoc.Options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);

