import { Router } from 'express';
import { ArchetypeController } from '../controllers/archetype.controller';

const router = Router();
const archetypeController = new ArchetypeController();

/**
 * @openapi
 * /api/archetype/data:
 *   get:
 *     tags:
 *       - Arquetipo Base (TS-00)
 *     summary: Lee el documento de configuración base desde Firestore
 *     description: Endpoint principal de la base técnica del Sprint 0. Consulta la colección de configuración en Firestore y retorna los datos para ser consumidos y renderizados por el Frontend. Si la base de datos no responde, retorna un error descriptivo con código 503.
 *     responses:
 *       200:
 *         description: Dato leído exitosamente desde Firestore
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponseSuccess'
 *       503:
 *         description: Error de comunicación con Firestore
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponseError'
 */
router.get('/data', archetypeController.getArchetypeData);

/**
 * @openapi
 * /api/archetype/seed:
 *   post:
 *     tags:
 *       - Arquetipo Base (TS-00)
 *     summary: Inicializa o actualiza el documento de prueba en Firestore
 *     description: Permite resembrar o modificar los datos del arquetipo en Firestore para verificar en vivo que el frontend refleja los cambios al recargar.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectName: { type: string, example: "Salón de Estudio Colaborativo" }
 *               sprint: { type: string, example: "Sprint 0: Base Técnica" }
 *               description: { type: string, example: "Mensaje modificado para prueba de persistencia" }
 *     responses:
 *       201:
 *         description: Documento creado o actualizado correctamente en Firestore
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponseSuccess'
 *       503:
 *         description: Error de comunicación con Firestore
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponseError'
 */
router.post('/seed', archetypeController.seedArchetypeData);

export default router;

