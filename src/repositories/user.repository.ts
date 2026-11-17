import { UpdateProfileInput } from '../validators/user.schemas';
import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { getFirestore } from '../config/firebase';
import { IUserRepository } from './interfaces/user.repository.interface';
import {
  CreateCompleteProfileInput,
  CreateIncompleteProfileInput,
  UserProfile,
} from '../types/user.types';
import { NotFoundError, UsernameTakenError, ValidationError } from '../types/errors.types';
import { toFirestoreError } from '../utils/firestoreErrors';

export const USERS_COLLECTION = 'users';
export const USERNAMES_COLLECTION = 'usernames';

export const normalizeUsername = (username: string): string => username.trim().toLowerCase();

const toIso = (value: unknown): string =>
  value instanceof Timestamp ? value.toDate().toISOString() : String(value ?? '');

function toProfile(snapshot: DocumentSnapshot<DocumentData>): UserProfile {
  const d = snapshot.data() ?? {};
  return {
    uid: snapshot.id,
    firstName: d.firstName ?? '',
    lastName: d.lastName ?? '',
    username: d.username ?? null,
    usernameLower: d.usernameLower ?? null,
    email: d.email ?? '',
    avatar: d.avatar ?? null,
    provider: d.provider ?? 'password',
    profileComplete: Boolean(d.profileComplete),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

export class FirestoreUserRepository implements IUserRepository {

   async updateProfile(uid: string, input: UpdateProfileInput, isGoogleAccount: boolean): Promise<UserProfile> {
    const userRef = this.users().doc(uid);

    try {
      await this.db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) throw new NotFoundError('Perfil no encontrado');
        
        const currentData = userSnap.data()!;
        const updates: any = { updatedAt: Timestamp.now() };

        // 1. Nombres y Avatar
        if (input.firstName) updates.firstName = input.firstName;
        if (input.lastName) updates.lastName = input.lastName;
        if (input.avatar) updates.avatar = input.avatar;

        // 2. Correo (Solo si NO es de Google)
        if (input.email && !isGoogleAccount && input.email !== currentData.email) {
          // Nota: El cambio en Firebase Auth se hace en el Service, aquí solo actualizamos Firestore
          updates.email = input.email;
        }

        // 3. Username (Transacción de liberación y reserva)
        if (input.username && input.username !== currentData.username) {
          const newLower = normalizeUsername(input.username);
          const newUsernameRef = this.usernames().doc(newLower);
          
          const newUsernameSnap = await tx.get(newUsernameRef);
          if (newUsernameSnap.exists) throw new UsernameTakenError();

          // Liberar el viejo
          if (currentData.usernameLower) {
            const oldUsernameRef = this.usernames().doc(currentData.usernameLower);
            const oldUsernameSnap = await tx.get(oldUsernameRef);
            if (oldUsernameSnap.exists && oldUsernameSnap.get('uid') === uid) {
              tx.delete(oldUsernameRef);
            }
          }

          // Reservar el nuevo
          tx.create(newUsernameRef, { uid, username: input.username, createdAt: Timestamp.now() });
          updates.username = input.username;
          updates.usernameLower = newLower;
        }

        tx.update(userRef, updates);
      });

      return toProfile(await userRef.get());
    } catch (error) {
      throw toFirestoreError(error, 'actualizar el perfil');
    }
  }

  private get db() {
    try {
      return getFirestore();
    } catch (error) {
      throw toFirestoreError(error, 'conectar con la base de datos');
    }
  }

  private users() {
    return this.db.collection(USERS_COLLECTION);
  }

  private usernames() {
    return this.db.collection(USERNAMES_COLLECTION);
  }

  async findById(uid: string): Promise<UserProfile | null> {
    try {
      const snapshot = await this.users().doc(uid).get();
      return snapshot.exists ? toProfile(snapshot) : null;
    } catch (error) {
      throw toFirestoreError(error, 'consultar el perfil');
    }
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    try {
      const snapshot = await this.usernames().doc(normalizeUsername(username)).get();
      return snapshot.exists;
    } catch (error) {
      throw toFirestoreError(error, 'verificar el nombre de usuario');
    }
  }

  async createProfileWithUsername(input: CreateCompleteProfileInput): Promise<UserProfile> {
    const usernameLower = normalizeUsername(input.username);
    const userRef = this.users().doc(input.uid);
    const usernameRef = this.usernames().doc(usernameLower);

    try {
      await this.db.runTransaction(async (tx) => {
        const [usernameSnap, userSnap] = await tx.getAll(usernameRef, userRef);
        if (usernameSnap.exists) throw new UsernameTakenError();
        if (userSnap.exists) throw new ValidationError('Esta cuenta ya tiene un perfil registrado.');

        const now = Timestamp.now();
        tx.create(usernameRef, { uid: input.uid, username: input.username, createdAt: now });
        tx.create(userRef, {
          firstName: input.firstName,
          lastName: input.lastName,
          username: input.username,
          usernameLower,
          email: input.email,
          avatar: input.avatar,
          provider: input.provider,
          profileComplete: true,
          createdAt: now,
          updatedAt: now,
        });
      });

      return toProfile(await userRef.get());
    } catch (error) {
      throw toFirestoreError(error, 'crear el perfil');
    }
  }

  async createIncompleteProfile(input: CreateIncompleteProfileInput): Promise<UserProfile> {
    const userRef = this.users().doc(input.uid);
    try {
      await this.db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (snap.exists) return; // otro request ya lo creó: idempotente

        const now = Timestamp.now();
        tx.create(userRef, {
          firstName: input.firstName,
          lastName: input.lastName,
          username: null,
          usernameLower: null,
          email: input.email,
          avatar: input.avatar,
          provider: input.provider,
          profileComplete: false,
          createdAt: now,
          updatedAt: now,
        });
      });

      return toProfile(await userRef.get());
    } catch (error) {
      throw toFirestoreError(error, 'crear el perfil');
    }
  }

  async claimUsername(uid: string, username: string): Promise<UserProfile> {
    const usernameLower = normalizeUsername(username);
    const userRef = this.users().doc(uid);
    const usernameRef = this.usernames().doc(usernameLower);

    try {
      await this.db.runTransaction(async (tx) => {
        const [userSnap, usernameSnap] = await tx.getAll(userRef, usernameRef);
        if (!userSnap.exists) throw new NotFoundError('No encontramos tu perfil. Inicia sesión de nuevo.');
        if (userSnap.get('profileComplete') === true) {
          throw new ValidationError('Ya elegiste tu nombre de usuario.', {
            username: 'Ya tienes un nombre de usuario. Puedes cambiarlo desde tu perfil.',
          });
        }
        if (usernameSnap.exists) throw new UsernameTakenError();

        const now = Timestamp.now();
        tx.create(usernameRef, { uid, username, createdAt: now });
        tx.update(userRef, { username, usernameLower, profileComplete: true, updatedAt: now });
      });

      return toProfile(await userRef.get());
    } catch (error) {
      throw toFirestoreError(error, 'guardar el nombre de usuario');
    }
  }

  async updateAvatar(uid: string, avatar: string): Promise<UserProfile> {
    const userRef = this.users().doc(uid);
    try {
      await this.db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) throw new NotFoundError('No encontramos tu perfil. Inicia sesión de nuevo.');
        tx.update(userRef, { avatar, updatedAt: Timestamp.now() });
      });
      return toProfile(await userRef.get());
    } catch (error) {
      throw toFirestoreError(error, 'actualizar la imagen de perfil');
    }
  }

  async deleteProfile(uid: string): Promise<void> {
    const userRef = this.users().doc(uid);
    try {
      await this.db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) return;

        const usernameLower = userSnap.get('usernameLower') as string | null;
        if (usernameLower) {
          const usernameRef = this.usernames().doc(usernameLower);
          const usernameSnap = await tx.get(usernameRef);
          if (usernameSnap.exists && usernameSnap.get('uid') === uid) tx.delete(usernameRef);
        }
        tx.delete(userRef);
      });
    } catch (error) {
      throw toFirestoreError(error, 'eliminar el perfil');
    }
  }
}
