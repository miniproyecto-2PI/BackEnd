import { IUserRepository } from './repositories/interfaces/user.repository.interface';
import { FirestoreUserRepository } from './repositories/user.repository';
import { FirebaseIdentityProvider, IdentityProvider } from './services/identity.provider';
import { FirebaseTokenVerifier, TokenVerifier } from './services/token.verifier';
import { CloudinaryImageStorage, ImageStorage } from './services/image.storage';
import { AuthGateway, FirebaseAuthGateway } from './services/auth.gateway';
import { GoogleOAuthClient, HttpGoogleOAuthClient } from './services/google.oauth';
import { InMemoryLoginTicketStore, LoginTicketStore } from './services/login.tickets';
import { LoginResult } from './services/auth.service';

/**
 * Dependencias externas de la API. En producción usan Firebase; en las pruebas
 * se reemplazan por dobles en memoria pasando `createApp({ ... })`.
 * Ninguna implementación toca Firebase al construirse (inicialización perezosa).
 */
export interface AppDeps {
  tokenVerifier: TokenVerifier;
  identityProvider: IdentityProvider;
  userRepository: IUserRepository;
  imageStorage: ImageStorage;
  /** Inicio de sesión con la REST API de Firebase Auth (el frontend no usa el SDK). */
  authGateway: AuthGateway;
  googleOAuth: GoogleOAuthClient;
  loginTickets: LoginTicketStore<LoginResult>;
}

export function buildDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    tokenVerifier: overrides.tokenVerifier ?? new FirebaseTokenVerifier(),
    identityProvider: overrides.identityProvider ?? new FirebaseIdentityProvider(),
    userRepository: overrides.userRepository ?? new FirestoreUserRepository(),
    imageStorage: overrides.imageStorage ?? new CloudinaryImageStorage(),
    authGateway: overrides.authGateway ?? new FirebaseAuthGateway(),
    googleOAuth: overrides.googleOAuth ?? new HttpGoogleOAuthClient(),
    loginTickets: overrides.loginTickets ?? new InMemoryLoginTicketStore<LoginResult>(),
  };
}
