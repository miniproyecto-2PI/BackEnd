import { Router } from 'express';
import { AppDeps } from '../container';
import { createAuthenticate } from '../middlewares/authenticate';
import { createRequireCompleteProfile } from '../middlewares/requireCompleteProfile';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';
import healthRoutes from './health.routes';
import errorDemoRoutes from './errorDemo.routes';
import { createArchetypeRouter } from './archetype.routes';
import { createAuthRouter } from './auth.routes';
import { createUsersRouter } from './users.routes';

/** Router de /api. Recibe las dependencias para poder inyectar dobles en las pruebas. */
export function createApiRouter(deps: AppDeps): Router {
  const router = Router();
  const authenticate = createAuthenticate(deps.tokenVerifier);
  const requireCompleteProfile = createRequireCompleteProfile(deps.userRepository);
  const userService = new UserService(deps.userRepository, deps.identityProvider, deps.imageStorage);
  const authService = new AuthService(
    deps.authGateway,
    deps.googleOAuth,
    deps.loginTickets,
    deps.identityProvider,
    userService
  );

  router.use('/health', healthRoutes);
  router.use('/archetype', createArchetypeRouter(authenticate));
  router.use('/errors', errorDemoRoutes);
  router.use(
    '/auth',
    createAuthRouter(userService, authService, authenticate, {
      frontendCallbackUrl: env.FRONTEND_OAUTH_CALLBACK_URL,
      secureCookies: env.NODE_ENV === 'production',
    })
  );
  router.use('/users', createUsersRouter(userService, authenticate, requireCompleteProfile));

  return router;
}
