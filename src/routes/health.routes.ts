import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

// Documentación OpenAPI: src/docs/paths/system.paths.ts
const router = Router();
const healthController = new HealthController();

router.get('/', healthController.checkHealth);

export default router;
