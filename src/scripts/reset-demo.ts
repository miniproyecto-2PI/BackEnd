import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const projectId = 'demo-estudiemos';
const seed = 'sprint-3-ts08';
const rooms = [
  { id: 'DEMA2222', name: 'Sala vacía', owner: 0, count: 0 },
  { id: 'DEMB3333', name: 'Grupo de estudio', owner: 1, count: 3 },
  { id: 'DEMC4444', name: 'Historial extenso', owner: 0, count: 120 },
];

export async function resetDemo() {
  if (process.env.FIREBASE_PROJECT_ID !== projectId ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
      process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085') {
    throw new Error('Configura demo-estudiemos y los emuladores locales indicados en el README.');
  }
  const accounts = ['A', 'B', 'C'].map((letter, i) => {
    const email = process.env['SEED_' + letter + '_EMAIL']?.trim();
    const password = process.env['SEED_' + letter + '_PASSWORD'];
    if (!email || !password || password.length < 8) throw new Error('Revisa las credenciales SEED_' + letter + ' en .env.');
    return { uid: 'ts08-demo-' + letter, name: 'Demo' + letter, avatar: 'avatar-0' + (i + 1), email, password };
  });
  if (new Set(accounts.map(a => a.email.toLowerCase())).size !== 3) throw new Error('Usa tres correos distintos.');
  const app = initializeApp({ projectId }, 'ts08');
  try {
    const db = getFirestore(app);
    const auth = getAuth(app);
    const profiles = accounts.map(a => db.collection('users').doc(a.uid));
    const usernames = accounts.map(a => db.collection('usernames').doc(a.name.toLowerCase()));
    const roomRefs = rooms.map(r => db.collection('rooms').doc(r.id));
    const targets = await db.getAll(...profiles, ...usernames, ...roomRefs);
    if (targets.some(doc => doc.exists && doc.get('seed') !== seed)) throw new Error('Un ID reservado pertenece a datos ajenos a TS-08.');
    const now = Timestamp.now();
    const batch = db.batch();
    for (const [i, a] of accounts.entries()) {
      const identity = { email: a.email, password: a.password, displayName: a.name, emailVerified: true };
      try {
        const existing = await auth.getUser(a.uid);
        if (existing.customClaims?.seed !== seed) throw new Error('UID reservado ocupado por una cuenta sin marca TS-08.');
        await auth.updateUser(a.uid, identity);
      } catch (error) {
        if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
        await auth.createUser({ uid: a.uid, ...identity });
      }
      await auth.setCustomUserClaims(a.uid, { seed });
      const usernameLower = a.name.toLowerCase();
      batch.set(profiles[i], { uid: a.uid, firstName: 'Demo', lastName: a.name, username: a.name, usernameLower,
        email: a.email, avatar: a.avatar, provider: 'password', profileComplete: true, createdAt: now, updatedAt: now, seed });
      batch.set(usernames[i], { uid: a.uid, username: a.name, createdAt: now, seed });
    }
    for (const [index, room] of rooms.entries()) {
      const ref = roomRefs[index];
      const messages = ref.collection('messages');
      // Incluye los mensajes añadidos durante la demo, solo en las tres salas reservadas.
      for (;;) {
        const previous = await messages.limit(400).get();
        if (previous.empty) break;
        const cleanup = db.batch();
        previous.docs.forEach(doc => cleanup.delete(doc.ref));
        await cleanup.commit();
      }
      batch.set(ref, { id: room.id, name: room.name, ownerId: accounts[room.owner].uid, createdAt: now, updatedAt: now, seed });
      for (let n = 1; n <= room.count; n++) {
        const { uid, name, avatar } = accounts[(n - 1) % accounts.length];
        const id = 'demo-' + String(n).padStart(3, '0');
        batch.set(messages.doc(id), { id, roomId: room.id, author: { uid, name, avatar }, text: 'Mensaje de estudio ' + n,
          createdAt: Timestamp.fromMillis(now.toMillis() - (room.count - n) * 1000) });
      }
    }
    await batch.commit();
    console.log('TS-08 lista: DEMA2222 (0), DEMB3333 (3), DEMC4444 (120).');
  } finally { await deleteApp(app); }
}

if (require.main === module) resetDemo().catch(error => {
  console.error(error instanceof Error ? error.message : 'No se pudieron preparar los datos.');
  process.exitCode = 1;
});
