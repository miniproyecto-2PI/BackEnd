import { getFirebaseAuth } from '../config/firebase';
import { AuthUser } from '../types/user.types';
import { AppError, ServiceUnavailableError, UnauthenticatedError } from '../types/errors.types';

/** Verifica un ID token y devuelve el usuario autenticado. Se inyecta para poder testear. */
export interface TokenVerifier {
  verifyIdToken(idToken: string): Promise<AuthUser>;
}

const EXPIRED_CODES = new Set(['auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled']);

/** Implementación con Firebase Admin SDK (verifica firma, emisor, audiencia y vencimiento). */
export class FirebaseTokenVerifier implements TokenVerifier {
  async verifyIdToken(idToken: string): Promise<AuthUser> {
    let auth;
    try {
      auth = getFirebaseAuth();
    } catch (error) {
      console.error(`[Auth] Firebase Auth no está configurado: ${(error as Error).message}`);
      throw new ServiceUnavailableError();
    }

    try {
      const decoded = await auth.verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        emailVerified: decoded.email_verified ?? false,
        name: typeof decoded.name === 'string' ? decoded.name : null,
        picture: decoded.picture ?? null,
        signInProvider: decoded.firebase?.sign_in_provider ?? null,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      const code = (error as { code?: string }).code ?? '';

      if (EXPIRED_CODES.has(code)) {
        throw new UnauthenticatedError('Tu sesión expiró. Inicia sesión de nuevo.');
      }
      if (code === 'app/network-error') {
        console.error('[Auth] No se pudieron obtener las llaves públicas de Firebase.');
        throw new ServiceUnavailableError();
      }
      throw new UnauthenticatedError('Tu sesión no es válida. Inicia sesión de nuevo.');
    }
  }
}
