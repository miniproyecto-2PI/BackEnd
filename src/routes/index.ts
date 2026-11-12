import { Router } from 'express';
import { AppDeps } from '../container';
import { createAuthenticate } from '../middlewares/authenticate';
import healthRoutes from './health.routes';
import errorDemoRoutes from './errorDemo.routes';
import { createArchetypeRouter } from './archetype.routes';

/** Router de /api. Recibe las dependencias para poder inyectar dobles en las pruebas. */
export function createApiRouter(deps: AppDeps): Router {
  const router = Router();
  const authenticate = createAuthenticate(deps.tokenVerifier);

  router.use('/health', healthRoutes);
  router.use('/archetype', createArchetypeRouter(authenticate));
  router.use('/errors', errorDemoRoutes);

  return router;
}
