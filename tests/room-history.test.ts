import request from 'supertest';
import { expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { getFirestore } from '../src/config/firebase';
import { RoomRepository } from '../src/repositories/room.repository';
import { buildTestApp } from './helpers/fakes';

it('exige sesión y valida el límite y el cursor antes de consultar Firestore', async () => {
  const { app, tokenVerifier } = buildTestApp();
  tokenVerifier.register('guest', { uid: 'guest' });
  const path = '/api/rooms/ABCDEFGH/messages';
  await request(app).get(path).expect(401);
  for (const query of ['limit=0', 'limit=51', 'limit=2.5', 'before=', 'before=a%2Fb']) {
    await request(app).get(path + '?' + query).set('Authorization', 'Bearer guest').expect(400);
  }
});

it.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('retorna 120 mensajes en páginas estables, incluso con fechas repetidas y nuevos envíos', async () => {
  const { app, tokenVerifier } = buildTestApp();
  tokenVerifier.register('guest', { uid: 'guest' });
  const { id } = await new RoomRepository().create('owner', 'Historial');
  const db = getFirestore();
  const room = db.collection('rooms').doc(id);
  const history = (query = '') => request(app).get('/api/rooms/' + id + '/messages' + query).set('Authorization', 'Bearer guest');
  const ids = Array.from({ length: 120 }, (_, i) => 'm' + String(i).padStart(3, '0'));
  const author = { uid: 'owner', name: 'Ana', avatar: null };
  try {
    expect((await history().expect(200)).body.data).toEqual({ messages: [], nextBefore: null, hasMore: false });
    const batch = db.batch();
    for (const key of ids) batch.set(room.collection('messages').doc(key), { author, text: key, createdAt: Timestamp.fromMillis(1000) });
    await batch.commit();
    const first = (await history().expect(200)).body.data;
    expect(first.messages.map((m: { id: string }) => m.id)).toEqual(ids.slice(70));
    expect(first.nextBefore).toBe('m070');
    await room.collection('messages').doc('live').set({ author, text: 'Nuevo', createdAt: Timestamp.now() });
    const second = (await history('?before=' + first.nextBefore).expect(200)).body.data;
    expect(second.messages.map((m: { id: string }) => m.id)).toEqual(ids.slice(20, 70));
    const third = (await history('?before=' + second.nextBefore).expect(200)).body.data;
    expect(third.messages.map((m: { id: string }) => m.id)).toEqual(ids.slice(0, 20));
    expect(third).toMatchObject({ nextBefore: null, hasMore: false });
    const latest = (await history('?limit=1').expect(200)).body.data;
    expect(latest.messages).toMatchObject([{ id: 'live', roomId: id, author }]);
    await history('?before=ausente').expect(400);
    await room.delete();
    expect((await history().expect(404)).body.error.code).toBe('ROOM_NOT_FOUND');
  } finally {
    await db.recursiveDelete(room);
  }
}, 30000);
