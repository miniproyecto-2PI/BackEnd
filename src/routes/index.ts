import { Router } from 'express';
import { AppDeps } from '../container';
import { createAuthenticate } from '../middlewares/authenticate';
import { UserService } from '../services/user.service';
import healthRoutes from './health.routes';
import errorDemoRoutes from './errorDemo.routes';
import { createArchetypeRouter } from './archetype.routes';
import { createAuthRouter } from './auth.routes';
import { createUsersRouter } from './users.routes';

/** Router de /api. Recibe las dependencias para poder inyectar dobles en las pruebas. */
export function createApiRouter(deps: AppDeps): Router {
  const router = Router();
  const authenticate = createAuthenticate(deps.tokenVerifier);
  const userService = new UserService(deps.userRepository, deps.identityProvider);

  router.use('/health', healthRoutes);
  router.use('/archetype', createArchetypeRouter(authenticate));
  router.use('/errors', errorDemoRoutes);
  router.use('/auth', createAuthRouter(userService));
  router.use('/users', createUsersRouter(userService, authenticate));

  return router;
}
