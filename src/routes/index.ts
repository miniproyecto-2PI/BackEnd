import { Router } from 'express';
import healthRoutes from './health.routes';
import archetypeRoutes from './archetype.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/archetype', archetypeRoutes);

export default router;

