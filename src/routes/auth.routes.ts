import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { UserService } from '../services/user.service';
import { validateBody } from '../middlewares/validate';
import { registerSchema } from '../validators/user.schemas';

// Documentación OpenAPI: src/docs/paths/auth.paths.ts
export function createAuthRouter(userService: UserService): Router {
  const router = Router();
  const controller = new AuthController(userService);

  // Público: crea la cuenta (Firebase Auth) y el perfil (Firestore). Luego el frontend
  // inicia sesión con signInWithEmailAndPassword.
  router.post('/register', validateBody(registerSchema), controller.register);

  return router;
}
