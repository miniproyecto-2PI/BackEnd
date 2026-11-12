import { AuthUser, UserProfile } from './user.types';

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado (lo asigna el middleware authenticate). */
      auth?: AuthUser;
      /** Perfil completo (lo asigna el middleware requireCompleteProfile). */
      profile?: UserProfile;
    }
  }
}

export {};
