import { Timestamp } from 'firebase-admin/firestore';
import { getFirestore } from '../config/firebase';
import { customAlphabet } from 'nanoid';
import { NotFoundError } from '../types/errors.types';

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

  async create(ownerId: string, name: string): Promise<Room> {
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
    return { ...roomData, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() } as any;
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
    if (!snap.exists) return null;
    const d = snap.data()!;
    return { id: snap.id, name: d.name, ownerId: d.ownerId, createdAt: d.createdAt.toDate().toISOString() };
  }
}