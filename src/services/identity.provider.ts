import { getFirebaseAuth } from '../config/firebase';
import {
  AppError,
  EmailInUseError,
  ServiceUnavailableError,
  ValidationError,
} from '../types/errors.types';

export interface CreateIdentityInput {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Operaciones sobre cuentas de Firebase Authentication que hace el servidor.
 * Se inyecta en los servicios para poder testear sin Firebase.
 */
export interface IdentityProvider {
  createUser(input: CreateIdentityInput): Promise<{ uid: string }>;
  /** Elimina la cuenta. No falla si ya no existe (operación idempotente). */
  deleteUser(uid: string): Promise<void>;
  /** Invalida los refresh tokens del usuario (cerrar sesión en todos los dispositivos). */
  revokeSessions(uid: string): Promise<void>;
}

function authOrUnavailable() {
  try {
    return getFirebaseAuth();
  } catch (error) {
    console.error(`[Auth] Firebase Auth no está configurado: ${(error as Error).message}`);
    throw new ServiceUnavailableError();
  }
}

export class FirebaseIdentityProvider implements IdentityProvider {
  async createUser(input: CreateIdentityInput): Promise<{ uid: string }> {
    const auth = authOrUnavailable();
    try {
      const user = await auth.createUser({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
      });
      return { uid: user.uid };
    } catch (error) {
      if (error instanceof AppError) throw error;
      const code = (error as { code?: string }).code ?? '';

      switch (code) {
        case 'auth/email-already-exists':
          throw new EmailInUseError('Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?');
        case 'auth/invalid-email':
          throw new ValidationError(undefined, { email: 'Escribe un correo válido, por ejemplo nombre@correounivalle.edu.co.' });
        case 'auth/invalid-password':
          throw new ValidationError(undefined, {
            password: 'La contraseña debe tener al menos 8 caracteres, una letra y un número.',
          });
        default:
          console.error(`[Auth] Error al crear la cuenta (${code || 'sin código'}): ${(error as Error).message}`);
          throw new ServiceUnavailableError('No pudimos crear tu cuenta en este momento. Intenta de nuevo.');
      }
    }
  }

  async deleteUser(uid: string): Promise<void> {
    const auth = authOrUnavailable();
    try {
      await auth.deleteUser(uid);
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') return;
      console.error(`[Auth] Error al eliminar la cuenta ${uid}: ${(error as Error).message}`);
      throw new ServiceUnavailableError();
    }
  }

  async revokeSessions(uid: string): Promise<void> {
    const auth = authOrUnavailable();
    try {
      await auth.revokeRefreshTokens(uid);
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') return;
      console.error(`[Auth] Error al cerrar la sesión de ${uid}: ${(error as Error).message}`);
      throw new ServiceUnavailableError();
    }
  }
}
