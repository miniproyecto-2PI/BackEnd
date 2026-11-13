import { AuthGateway, AuthSession } from './auth.gateway';
import { GoogleOAuthClient } from './google.oauth';
import { IdentityProvider } from './identity.provider';
import { LoginTicketStore } from './login.tickets';
import { UserService } from './user.service';
import { UserProfile } from '../types/user.types';
import { ServiceUnavailableError, UnauthenticatedError } from '../types/errors.types';

/** Lo que recibe el frontend al iniciar sesión: tokens + perfil (un solo viaje). */
export interface LoginResult {
  session: AuthSession;
  profile: UserProfile;
}

/**
 * Inicio y cierre de sesión hechos por la API (US-02, US-03). El frontend no usa el
 * SDK de Firebase: recibe el ID token de aquí y lo envía como Bearer en cada petición.
 */
export class AuthService {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly google: GoogleOAuthClient,
    private readonly tickets: LoginTicketStore<LoginResult>,
    private readonly identity: IdentityProvider,
    private readonly userService: UserService
  ) {}

  /** POST /api/auth/login — correo y contraseña (US-03). */
  async login(email: string, password: string): Promise<LoginResult> {
    const { session, user } = await this.gateway.signInWithPassword(email, password);
    const { profile } = await this.userService.getOrCreateMe(user);
    return { session, profile };
  }

  /** POST /api/auth/refresh — ID token nuevo antes de que venza el actual (1 h). */
  refresh(refreshToken: string): Promise<AuthSession> {
    return this.gateway.refreshSession(refreshToken);
  }

  /** POST /api/auth/logout — invalida los refresh tokens del usuario. */
  logout(uid: string): Promise<void> {
    return this.identity.revokeSessions(uid);
  }

  isGoogleConfigured(): boolean {
    return this.google.isConfigured();
  }

  /** URL de la pantalla de Google a la que se redirige el navegador. */
  googleAuthorizationUrl(state: string): string {
    if (!this.google.isConfigured()) throw new ServiceUnavailableError();
    return this.google.buildAuthorizationUrl(state);
  }

  /**
   * Callback de Google (US-02): código OAuth → id_token de Google → sesión de Firebase →
   * perfil (se crea incompleto en el primer ingreso). Devuelve un ticket de un solo uso.
   */
  async completeGoogleLogin(code: string): Promise<string> {
    const googleIdToken = await this.google.exchangeCode(code);
    const { session, user } = await this.gateway.signInWithGoogleIdToken(googleIdToken, this.google.redirectUri);
    const { profile } = await this.userService.getOrCreateMe(user);
    return this.tickets.create({ session, profile });
  }

  /** POST /api/auth/google/exchange — canjea el ticket del callback por la sesión. */
  async exchangeGoogleTicket(ticket: string): Promise<LoginResult> {
    const result = await this.tickets.consume(ticket);
    if (!result) {
      throw new UnauthenticatedError('El inicio de sesión con Google expiró. Intenta de nuevo.');
    }
    return result;
  }
}
