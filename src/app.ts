import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { createCorsDelegate, parseAllowedOrigins } from './config/cors';
import { swaggerSpec } from './docs/swagger';
import { createApiRouter } from './routes';
import { AppDeps, buildDeps } from './container';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { errorHandler } from './middlewares/errorHandler';

/**
 * Crea la aplicación Express. `overrides` permite inyectar dobles de prueba
 * (verificador de tokens, proveedor de identidad, repositorio de usuarios).
 */
export function createApp(overrides: Partial<AppDeps> = {}): Application {
  const app = express();
  const deps = buildDeps(overrides);

  // 1. Cabeceras de seguridad
  app.use(
    helmet({
      contentSecurityPolicy: false, // Permite cargar Swagger UI sin bloqueos CSP
    })
  );

  // Render (y Docker con proxy) termina TLS antes de Express: confiar en el primer proxy
  // para que req.protocol refleje https y la comparación de mismo origen funcione.
  app.set('trust proxy', 1);

  // 2. Configuración de CORS restringida a los orígenes de CORS_ORIGIN (ver config/cors.ts)
  app.use(cors(createCorsDelegate(parseAllowedOrigins(env.CORS_ORIGIN))));

  // 3. Parseo de cuerpo HTTP
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 4. Logging de solicitudes HTTP
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // 5. Documentación Swagger UI en /api/docs
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Salón de Estudio - API Docs (Swagger)',
    })
  );

  // Redirecciones amigables para /api-docs y /docs
  app.get('/api-docs', (_req: Request, res: Response) => {
    res.redirect('/api/docs');
  });
  app.get('/docs', (_req: Request, res: Response) => {
    res.redirect('/api/docs');
  });

  // Esquema OpenAPI en JSON
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // 6. Ruta raíz informativa
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      name: 'Salón de Estudio Colaborativo - Backend API',
      status: 'active',
      sprint: 'Sprint 1: Registro, inicio de sesión y perfiles (US-01, US-02, US-03, TS-01, TS-07)',
      standards: 'TS-05: Contrato API y Errores Estándar',
      documentation: '/api/docs',
      health: '/api/health',
      endpoints: {
        register: 'POST /api/auth/register',
        me: 'GET /api/users/me',
        username: 'POST /api/users/me/username',
        avatar: 'POST /api/users/me/avatar',
      },
      archetypeEndpoint: '/api/archetype/data',
      timestamp: new Date().toISOString(),
    });
  });

  // 7. Montaje de rutas de la API bajo el prefijo /api
  app.use('/api', createApiRouter(deps));

  // 8. Manejo de rutas 404 (no encontradas)
  app.use(notFoundHandler);

  // 9. Manejador de errores global con estándar TS-05
  app.use(errorHandler);

  return app;
}
