import { RoomRepository } from '../repositories/room.repository';
import { CreateRoomInput } from '../validators/room.schemas';
import { NotFoundError } from '../types/errors.types';

export class RoomService {
  constructor(private readonly rooms: RoomRepository) {}

  async createRoom(ownerId: string, input: CreateRoomInput) {
    return this.rooms.create(ownerId, input.name);
  }

  async listMyRooms(ownerId: string) {
    return this.rooms.findByOwnerId(ownerId);
  }

  async getRoom(roomId: string) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundError('Sala no encontrada.');
    return room;
  }
}