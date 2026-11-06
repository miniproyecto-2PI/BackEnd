import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './docs/swagger';
import apiRoutes from './routes';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { errorHandler } from './middlewares/errorHandler';

export function createApp(): Application {
  const app = express();

  // 1. Cabeceras de seguridad
  app.use(
    helmet({
      contentSecurityPolicy: false, // Permite cargar Swagger UI sin bloqueos CSP
    })
  );

  // 2. Configuración de CORS
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

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
      sprint: 'Sprint 0: Base Técnica End-to-End (TS-00)',
      standards: 'TS-05: Contrato API y Errores Estándar',
      documentation: '/api/docs',
      health: '/api/health',
      archetypeEndpoint: '/api/archetype/data',
      timestamp: new Date().toISOString(),
    });
  });

  // 7. Montaje de rutas de la API bajo el prefijo /api
  app.use('/api', apiRoutes);

  // 8. Manejo de rutas 404 (no encontradas)
  app.use(notFoundHandler);

  // 9. Manejador de errores global con estándar TS-05
  app.use(errorHandler);

  return app;
}
