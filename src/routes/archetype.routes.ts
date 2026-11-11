import { RequestHandler, Router } from 'express';
import { ArchetypeController } from '../controllers/archetype.controller';
import { validateBody } from '../middlewares/validate';
import { seedArchetypeSchema } from '../validators/archetype.schemas';

// Documentación OpenAPI: src/docs/paths/system.paths.ts
export function createArchetypeRouter(authenticate: RequestHandler): Router {
  const router = Router();
  const controller = new ArchetypeController();

  // Público: lo consume la pantalla /base-tecnica del frontend (TS-00)
  router.get('/data', controller.getArchetypeData);

  // Escritura protegida: requiere sesión
  router.post('/seed', authenticate, validateBody(seedArchetypeSchema), controller.seedArchetypeData);

  return router;
}
