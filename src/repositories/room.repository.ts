import { DocumentReference, DocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { getFirestore } from '../config/firebase';
import { customAlphabet } from 'nanoid';
import { ForbiddenError, NotFoundError, RoomNotFoundError, ValidationError } from '../types/errors.types';
import { toFirestoreError } from '../utils/firestoreErrors';

const ROOMS_COLLECTION = 'rooms';
// ID sin letras ambiguas (O, 0, I, 1, L)
const generateRoomId = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 8);

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export class RoomRepository {
  private get db() { return getFirestore(); }
  private rooms() { return this.db.collection(ROOMS_COLLECTION); }

  async create(ownerId: string, name: string): Promise<Room & { updatedAt: string }> {
    const roomId = generateRoomId();
    const roomRef = this.rooms().doc(roomId);
    const now = Timestamp.now();

    const roomData = {
      id: roomId,
      name,
      ownerId,
      createdAt: now,
      updatedAt: now,
    };

    await roomRef.create(roomData);
    const timestamp = now.toDate().toISOString();
    return { ...roomData, createdAt: timestamp, updatedAt: timestamp };
  }

  async findByOwnerId(ownerId: string): Promise<Room[]> {
    const snapshot = await this.rooms().where('ownerId', '==', ownerId).get();
    return snapshot.docs.map(doc => {
      const d = doc.data();
      return { id: doc.id, name: d.name, ownerId: d.ownerId, createdAt: d.createdAt.toDate().toISOString() };
    });
  }

  async findById(roomId: string): Promise<Room | null> {
    const snap = await this.rooms().doc(roomId).get();
    if (!snap.exists || snap.get('deleting') === true) return null;
    const d = snap.data()!;
    return { id: snap.id, name: d.name, ownerId: d.ownerId, createdAt: d.createdAt.toDate().toISOString() };
  }

  private roomRef(id: string) {
    if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(id)) {
      throw new NotFoundError('Sala no encontrada.');
    }
    return this.rooms().doc(id);
  }

  async messageHistory(id: string, limit: number, before?: string) {
    try {
      const room = this.rooms().doc(id);
      const messages = room.collection('messages');
      return await this.db.runTransaction(async tx => {
        const snapshot = await tx.get(room);
        if (!snapshot.exists || snapshot.get('deleting')) throw new RoomNotFoundError();
        // Firestore desempata por ID de documento. El snapshot conserva la precisión del Timestamp.
        let query = messages.orderBy('createdAt', 'desc').limit(limit + 1);
        if (before) {
          const cursor = await tx.get(messages.doc(before));
          if (!cursor.exists || !cursor.get('createdAt')) {
            throw new ValidationError('El cursor no corresponde a un mensaje de esta sala.');
          }
          query = query.startAfter(cursor);
        }
        const result = await tx.get(query);
        const hasMore = result.size > limit;
        const page = result.docs.slice(0, limit).reverse().map(doc => {
          const data = doc.data();
          return { id: doc.id, roomId: id, author: data.author, text: data.text, createdAt: data.createdAt.toDate().toISOString() };
        });
        return { messages: page, hasMore, nextBefore: hasMore ? page[0].id : null };
      }, { readOnly: true });
    } catch (error) { throw toFirestoreError(error, 'consultar el historial de la sala'); }
  }

  private requireOwner(snapshot: DocumentSnapshot, uid: string) {
    const data = snapshot.data();
    if (!data) throw new NotFoundError('Sala no encontrada.');
    if (data.ownerId !== uid) throw new ForbiddenError('Solo el anfitrión puede gestionar la sala.');
    return data;
  }

  async rename(id: string, uid: string, name: string): Promise<Room> {
    const ref = this.roomRef(id);
    return this.db.runTransaction(async tx => {
      const data = this.requireOwner(await tx.get(ref), uid);
      if (data.deleting) throw new NotFoundError('La sala se está eliminando.');
      tx.update(ref, { name, updatedAt: Timestamp.now() });
      return { id, ownerId: uid, name, createdAt: data.createdAt.toDate().toISOString() };
    });
  }

  async remove(id: string, uid: string): Promise<void> {
    await this.removeWithMessages(this.roomRef(id), uid);
  }

  private async removeWithMessages(ref: DocumentReference, uid: string): Promise<void> {
    const pageSize = 400;
    // Cada lote conserva el dueño hasta que el chat esté vacío, incluso al reintentar.
    let finished = false;
    while (!finished) {
      finished = await this.db.runTransaction(async tx => {
        const data = this.requireOwner(await tx.get(ref), uid);
        const messages = await tx.get(ref.collection('messages').limit(pageSize));
        messages.docs.forEach(message => tx.delete(message.ref));
        if (messages.size < pageSize) {
          tx.delete(ref);
          return true;
        }
        if (!data.deleting) tx.update(ref, { deleting: true });
        return false;
      });
    }
  }

  /** Borra todas las salas que pertenecen a un usuario. Usado en US-05 al eliminar cuenta. */
  async deleteByOwnerId(ownerId: string): Promise<void> {
    const snapshot = await this.rooms().where('ownerId', '==', ownerId).get();
    for (const room of snapshot.docs) {
      try {
        await this.removeWithMessages(room.ref, ownerId);
      } catch (error) {
        // La sala pudo eliminarse en paralelo después de listar las salas del usuario.
        if (!(error instanceof NotFoundError)) throw error;
      }
    }
  }
}
