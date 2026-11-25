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

  async getRoom(roomId: string) {
    const id = roomId.trim();
    if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(id)) {
      throw new ValidationError('Revisa el ID de la sala.', { id: 'Escribe el ID de 8 caracteres de la sala.' });
    }
    const room = await this.rooms.findById(id);
    if (!room) throw new RoomNotFoundError('No encontramos una sala con ese ID. Revisa que esté bien escrito.');
    return room;
  }
}
