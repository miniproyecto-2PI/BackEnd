import { RequestHandler, Router } from 'express';
import { RoomController } from '../controllers/room.controller';
import { RoomService } from '../services/room.service';
import { validateBody } from '../middlewares/validate';
import { createRoomSchema } from '../validators/room.schemas';

export function createRoomsRouter(roomService: RoomService, authenticate: RequestHandler, requireCompleteProfile: RequestHandler): Router {
  const router = Router();
  const controller = new RoomController(roomService);

  router.use(authenticate);
  router.use(requireCompleteProfile); // Requiere perfil completo para gestionar salas

  router.post('/', validateBody(createRoomSchema), controller.createRoom);
  router.get('/', controller.listRooms);
  router.get('/:id', controller.getRoom);

  return router;
}