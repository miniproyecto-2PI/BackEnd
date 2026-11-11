import { IArchetypeRepository } from './interfaces/archetype.repository.interface';
import { ArchetypeData } from '../types/archetype.types';
import { getFirestore } from '../config/firebase';
import { env } from '../config/env';
import { toFirestoreError } from '../utils/firestoreErrors';

export class ArchetypeRepository implements IArchetypeRepository {
  private readonly defaultDocId = 'sprint-0';

  private get collection() {
    try {
      return getFirestore().collection(env.FIRESTORE_COLLECTION_NAME);
    } catch (err) {
      throw toFirestoreError(err, 'conectar con la base de datos');
    }
  }

  async getArchetypeConfig(docId: string = this.defaultDocId): Promise<ArchetypeData | null> {
    try {
      const snapshot = await this.collection.doc(docId).get();
      if (!snapshot.exists) return null;

      return {
        id: snapshot.id,
        ...(snapshot.data() as Omit<ArchetypeData, 'id'>),
      };
    } catch (error) {
      throw toFirestoreError(error, `obtener el documento '${docId}'`);
    }
  }

  async upsertArchetypeConfig(
    data: ArchetypeData,
    docId: string = this.defaultDocId
  ): Promise<ArchetypeData> {
    try {
      await this.collection.doc(docId).set(data, { merge: true });
      return { id: docId, ...data };
    } catch (error) {
      throw toFirestoreError(error, `guardar el documento '${docId}'`);
    }
  }

  async pingFirestore(): Promise<boolean> {
    try {
      // Lee como máximo 1 documento para verificar conectividad
      await this.collection.limit(1).get();
      return true;
    } catch (error) {
      throw toFirestoreError(error, 'verificar conectividad con la base de datos');
    }
  }
}
