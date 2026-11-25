import { RoomRepository } from '../repositories/room.repository';
import { CreateRoomInput } from '../validators/room.schemas';
import { RoomNotFoundError, ValidationError } from '../types/errors.types';

export class RoomService {
  constructor(private readonly rooms: RoomRepository) {}

  async createRoom(ownerId: string, input: CreateRoomInput) {
    return this.rooms.create(ownerId, input.name);
  }

  async listMyRooms(ownerId: string) {
    return this.rooms.findByOwnerId(ownerId);
  }

  renameRoom(id: string, uid: string, input: CreateRoomInput) {
    return this.rooms.rename(id, uid, input.name);
  }

  deleteRoom(id: string, uid: string) {
    return this.rooms.remove(id, uid);
  }

  private validatedId(roomId: string) {
    const id = roomId.trim();
    if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(id)) {
      throw new ValidationError('Revisa el ID de la sala.', { id: 'Escribe el ID de 8 caracteres de la sala.' });
    }
    return id;
  }

  async history(roomId: string, limit: unknown, before: unknown) {
    const id = this.validatedId(roomId);
    if (limit !== undefined && (typeof limit !== 'string' || !/^(?:[1-9]|[1-4][0-9]|50)$/.test(limit))) {
      throw new ValidationError('Límite inválido.', { limit: 'Usa un entero entre 1 y 50.' });
    }
    if (before !== undefined && (typeof before !== 'string' || !before || before.includes('/') ||
        before === '.' || before === '..' || Buffer.byteLength(before) > 1500)) {
      throw new ValidationError('Cursor inválido.', { before: 'Usa el nextBefore de la página anterior.' });
    }
    return this.rooms.messageHistory(id, limit === undefined ? 50 : Number(limit), before);
  }

  async getRoom(roomId: string) {
    const room = await this.rooms.findById(this.validatedId(roomId));
    if (!room) throw new RoomNotFoundError('No encontramos una sala con ese ID. Revisa que esté bien escrito.');
    return room;
  }
}
