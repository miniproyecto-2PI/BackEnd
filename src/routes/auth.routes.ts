import { RequestHandler, Router } from 'express';
import { AuthController, AuthControllerOptions } from '../controllers/auth.controller';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { validateBody } from '../middlewares/validate';
import { createAuthRateLimit, createLoginRateLimit } from '../middlewares/rateLimit';
import { registerSchema } from '../validators/user.schemas';
import { googleExchangeSchema, loginSchema, refreshSchema } from '../validators/auth.schemas';

// Documentación OpenAPI: src/docs/paths/auth.paths.ts
// Todo el inicio de sesión ocurre aquí: el frontend NO usa el SDK de Firebase.
export function createAuthRouter(
  userService: UserService,
  authService: AuthService,
  authenticate: RequestHandler,
  options: AuthControllerOptions
): Router {
  const router = Router();
  const controller = new AuthController(userService, authService, options);
  // Se crean por router: cada instancia de la app (y cada prueba) tiene sus contadores
  const loginLimit = createLoginRateLimit();
  const authLimit = createAuthRateLimit();

  router.post('/register', validateBody(registerSchema), controller.register);
  router.post('/login', loginLimit, validateBody(loginSchema), controller.login);
  router.post('/refresh', authLimit, validateBody(refreshSchema), controller.refresh);
  router.post('/logout', authenticate, controller.logout);

  // Google por redirección OAuth 2.0 (navegación del navegador, no fetch)
  router.get('/google', authLimit, controller.googleStart);
  router.get('/google/callback', authLimit, controller.googleCallback);
  router.post('/google/exchange', authLimit, validateBody(googleExchangeSchema), controller.googleExchange);

  return router;
}
