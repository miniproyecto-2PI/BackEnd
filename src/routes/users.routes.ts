import { RequestHandler, Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { UserService } from '../services/user.service';
import { validateBody } from '../middlewares/validate';
import { uploadAvatar } from '../middlewares/uploadAvatar';
import { chooseUsernameSchema } from '../validators/user.schemas';

// Documentación OpenAPI: src/docs/paths/users.paths.ts
export function createUsersRouter(
  userService: UserService,
  authenticate: RequestHandler,
  requireCompleteProfile: RequestHandler
): Router {
  const router = Router();
  const controller = new UserController(userService);

  // Todas las rutas de /api/users requieren sesión (401 sin token).
  // /me y /me/username no llevan requireCompleteProfile: el frontend las usa justamente
  // para saber si falta el username y para completarlo.
  router.use(authenticate);

  router.get('/me', controller.getMe);
  router.post('/me/username', validateBody(chooseUsernameSchema), controller.chooseUsername);

  // Imagen de perfil propia (multipart, campo "avatar"): requiere perfil completo (403 si no)
  router.post('/me/avatar', requireCompleteProfile, uploadAvatar, controller.updateAvatar);

  return router;
}
