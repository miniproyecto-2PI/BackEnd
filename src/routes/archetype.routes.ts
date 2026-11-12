import { Router } from 'express';
import { ArchetypeController } from '../controllers/archetype.controller';

// Documentación OpenAPI: src/docs/paths/system.paths.ts
const router = Router();
const archetypeController = new ArchetypeController();

router.get('/data', archetypeController.getArchetypeData);
router.post('/seed', archetypeController.seedArchetypeData);

export default router;
