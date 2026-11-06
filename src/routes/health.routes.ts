import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

const router = Router();
const healthController = new HealthController();

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - Salud del Sistema (Health)
 *     summary: Verifica el estado del servicio y la conectividad con Firestore
 *     description: Retorna el estado general de la API, tiempo de actividad (uptime) y prueba de conectividad con la base de datos.
 *     responses:
 *       200:
 *         description: Servicio en funcionamiento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 status: { type: string, example: "UP" }
 *                 service: { type: string, example: "backend-api" }
 *                 uptimeSeconds: { type: number, example: 42 }
 *                 database:
 *                   type: object
 *                   properties:
 *                     status: { type: string, example: "healthy" }
 *                     latencyMs: { type: number, example: 120 }
 *                     type: { type: string, example: "Google Cloud Firestore" }
 */
router.get('/', healthController.checkHealth);

export default router;

