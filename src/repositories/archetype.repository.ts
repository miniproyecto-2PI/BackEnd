import { IArchetypeRepository } from './interfaces/archetype.repository.interface';
import { ArchetypeData } from '../types/archetype.types';
import { getFirestore } from '../config/firebase';
import { env } from '../config/env';
import { FirestoreError } from '../types/errors.types';

export class ArchetypeRepository implements IArchetypeRepository {
  private readonly defaultDocId = 'sprint-0';

  private get collection() {
    try {
      const db = getFirestore();
      return db.collection(env.FIRESTORE_COLLECTION_NAME);
    } catch (err) {
      throw new FirestoreError(
        `Error al conectar con Firestore: ${(err as Error).message}`,
        { database: (err as Error).message }
      );
    }
  }

  async getArchetypeConfig(docId: string = this.defaultDocId): Promise<ArchetypeData | null> {
    try {
      const docRef = this.collection.doc(docId);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        return null;
      }

      return {
        id: snapshot.id,
        ...(snapshot.data() as Omit<ArchetypeData, 'id'>),
      };
    } catch (error) {
      this.handleFirestoreError(error, `obtener el documento '${docId}'`);
      throw error; // unreachable due to handleFirestoreError, but keeps TS happy
    }
  }

  async upsertArchetypeConfig(
    data: ArchetypeData,
    docId: string = this.defaultDocId
  ): Promise<ArchetypeData> {
    try {
      const docRef = this.collection.doc(docId);
      await docRef.set(data, { merge: true });

      return {
        id: docId,
        ...data,
      };
    } catch (error) {
      this.handleFirestoreError(error, `guardar el documento '${docId}'`);
      throw error;
    }
  }

  async pingFirestore(): Promise<boolean> {
    try {
      // Intenta listar 1 documento de la colección para verificar conectividad
      await this.collection.limit(1).get();
      return true;
    } catch (error) {
      this.handleFirestoreError(error, 'verificar conectividad con la base de datos');
      return false;
    }
  }

  private handleFirestoreError(error: unknown, operationDescription: string): never {
    const err = error as { code?: string | number; message?: string; details?: string };
    const rawMessage = err?.message || String(error);

    let friendlyMessage = `No fue posible ${operationDescription} en Firestore.`;

    if (rawMessage.includes('UNAVAILABLE') || rawMessage.includes('503') || err.code === 14) {
      friendlyMessage =
        `El servicio de Firestore no se encuentra disponible temporalmente o la red no responde al ${operationDescription}.`;
    } else if (
      rawMessage.includes('PERMISSION_DENIED') ||
      rawMessage.includes('7') ||
      rawMessage.includes('Missing or insufficient permissions')
    ) {
      friendlyMessage =
        `Permisos insuficientes en Firebase/Firestore al ${operationDescription}. Verifique las reglas de seguridad o las credenciales de la cuenta de servicio.`;
    } else if (rawMessage.includes('PROJECT_NOT_FOUND') || rawMessage.includes('5')) {
      friendlyMessage =
        `El ID del proyecto de Firebase no fue encontrado o es inválido al ${operationDescription}.`;
    }

    throw new FirestoreError(friendlyMessage, {
      originalError: rawMessage,
      operation: operationDescription,
    });
  }
}
