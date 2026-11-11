import { IUserRepository } from './repositories/interfaces/user.repository.interface';
import { FirestoreUserRepository } from './repositories/user.repository';
import { FirebaseIdentityProvider, IdentityProvider } from './services/identity.provider';
import { FirebaseTokenVerifier, TokenVerifier } from './services/token.verifier';

/**
 * Dependencias externas de la API. En producción usan Firebase; en las pruebas
 * se reemplazan por dobles en memoria pasando `createApp({ ... })`.
 * Ninguna implementación toca Firebase al construirse (inicialización perezosa).
 */
export interface AppDeps {
  tokenVerifier: TokenVerifier;
  identityProvider: IdentityProvider;
  userRepository: IUserRepository;
}

export function buildDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    tokenVerifier: overrides.tokenVerifier ?? new FirebaseTokenVerifier(),
    identityProvider: overrides.identityProvider ?? new FirebaseIdentityProvider(),
    userRepository: overrides.userRepository ?? new FirestoreUserRepository(),
  };
}
