import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { getFirestore } from '../src/config/firebase';
import { RoomRepository } from '../src/repositories/room.repository';

it.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('al borrar las salas de una cuenta elimina sus chats y conserva los de otros dueños', async () => {
  const rooms = new RoomRepository();
  const owner = randomUUID();
  const ids = await Promise.all([owner, owner, randomUUID()].map(uid => rooms.create(uid, 'Grupo')));
  const db = getFirestore();
  const refs = ids.map(room => db.collection('rooms').doc(room.id));
  try {
    await Promise.all(refs.map(ref => ref.collection('messages').doc('m1').set({ text: 'Hola' })));
    await rooms.deleteByOwnerId(owner);
    for (const [index, ref] of refs.entries()) {
      expect((await ref.get()).exists).toBe(index === 2);
      expect((await ref.collection('messages').doc('m1').get()).exists).toBe(index === 2);
    }
  } finally {
    await Promise.all(refs.map(ref => db.recursiveDelete(ref)));
  }
}, 30000);
