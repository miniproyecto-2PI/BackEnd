import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { getFirestore } from '../src/config/firebase';
import { buildTestApp } from './helpers/fakes';

// Ejecutar contra el emulador para verificar los datos antes y después de cada petición.
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('US-07 con Firestore emulado', () => {
  it('protege ambas rutas, valida el nombre y elimina el chat completo en varios lotes', async () => {
    const { app, tokenVerifier, userRepository } = buildTestApp();
    for (const uid of ['owner', 'guest']) {
      tokenVerifier.register(uid, { uid });
      await userRepository.createProfileWithUsername({
        uid, username: uid, firstName: 'Ana', lastName: 'Pérez', email: uid + '@example.com',
        provider: 'password', avatar: 'avatar-01',
      });
    }
    const api = request(app);
    const owner = { Authorization: 'Bearer owner' };
    const guest = { Authorization: 'Bearer guest' };
    const created = await api.post('/api/rooms').set(owner).send({ name: 'Inicial' }).expect(201);
    const id = created.body.data.id;
    const path = '/api/rooms/' + id;
    const db = getFirestore();
    const room = db.collection('rooms').doc(id);
    try {
      const batch = db.batch();
      for (let i = 0; i < 405; i++) batch.set(room.collection('messages').doc(String(i)), { text: 'Hola' });
      await batch.commit();
      await api.delete(path).expect(401);
      for (const response of [
        await api.patch(path).set(guest).send({ name: 'Ajena' }),
        await api.delete(path).set(guest),
      ]) {
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
      await api.patch(path).set(owner).send({ name: '   ' }).expect(400);
      expect((await room.get()).get('name')).toBe('Inicial');
      expect((await room.collection('messages').get()).size).toBe(405);
      await api.patch(path).set(owner).send({ name: '  Nuevo  ' }).expect(200);
      expect((await room.get()).get('name')).toBe('Nuevo');
      await api.delete(path).set(owner).expect(204);
      expect((await room.get()).exists).toBe(false);
      expect((await room.collection('messages').get()).empty).toBe(true);
      await api.patch(path).set(owner).send({ name: 'Nuevo' }).expect(404);
      await api.delete(path).set(owner).expect(404);
    } finally {
      await db.recursiveDelete(room);
    }
  }, 30000);
});
