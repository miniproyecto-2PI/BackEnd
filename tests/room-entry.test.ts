import { describe, expect, it, vi } from 'vitest';
import { RoomRepository } from '../src/repositories/room.repository';
import { RoomService } from '../src/services/room.service';

describe('US-08 · consulta previa al ingreso', () => {
  it('recorta el ID, devuelve la sala existente y distingue el 404', async () => {
    const room = { id: 'ABCDEFGH', name: 'Grupo', ownerId: 'owner', createdAt: '2026-01-01' };
    const repo = new RoomRepository();
    const read = vi.spyOn(repo, 'findById').mockResolvedValueOnce(room).mockResolvedValue(null);
    const service = new RoomService(repo);
    expect(await service.getRoom('  ABCDEFGH ')).toEqual(room);
    expect(read).toHaveBeenCalledWith(room.id);
    await expect(service.getRoom('ZZZZZZZZ')).rejects.toMatchObject({ statusCode: 404, code: 'ROOM_NOT_FOUND' });
  });

  it.each(['   ', 'AB/CD234', '123'])('rechaza el ID inválido %j antes de consultar Firestore', async id => {
    const repo = new RoomRepository();
    const read = vi.spyOn(repo, 'findById');
    await expect(new RoomService(repo).getRoom(id)).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(read).not.toHaveBeenCalled();
  });
});
