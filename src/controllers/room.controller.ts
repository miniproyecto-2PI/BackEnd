import { NextFunction, Request, Response } from 'express';
import { RoomService } from '../services/room.service';
import { CreateRoomInput } from '../validators/room.schemas';
import { sendSuccess } from '../utils/response';
import { UnauthenticatedError } from '../types/errors.types';

export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  history = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const page = await this.roomService.history(req.params.id, req.query.limit, req.query.before);
      sendSuccess(res, 200, page, 'Historial obtenido.');
    } catch (error) { next(error); }
  };

  createRoom = async (req: Request<unknown, unknown, CreateRoomInput>, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new UnauthenticatedError();
      const room = await this.roomService.createRoom(req.auth.uid, req.body);
      sendSuccess(res, 201, room, 'Sala creada exitosamente.');
    } catch (error) { next(error); }
  };

  listRooms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new UnauthenticatedError();
      const rooms = await this.roomService.listMyRooms(req.auth.uid);
      sendSuccess(res, 200, rooms, 'Salas obtenidas correctamente.');
    } catch (error) { next(error); }
  };

  getRoom = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const room = await this.roomService.getRoom(req.params.id);
      sendSuccess(res, 200, room, 'Sala obtenida correctamente.');
    } catch (error) { next(error); }
  };

  renameRoom = async (req: Request<{ id: string }, unknown, CreateRoomInput>, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw new UnauthenticatedError();
      const room = await this.roomService.renameRoom(req.params.id, req.auth.uid, req.body);
      sendSuccess(res, 200, room, 'Sala actualizada.');
    } catch (error) { next(error); }
  };

  deleteRoom = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw new UnauthenticatedError();
      await this.roomService.deleteRoom(req.params.id, req.auth.uid);
      res.sendStatus(204);
    } catch (error) { next(error); }
  };
}
