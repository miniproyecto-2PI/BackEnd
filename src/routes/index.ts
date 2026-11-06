import { Router } from 'express';
import healthRoutes from './health.routes';
import archetypeRoutes from './archetype.routes';
import errorDemoRoutes from './errorDemo.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/archetype', archetypeRoutes);
router.use('/errors', errorDemoRoutes);

export default router;
