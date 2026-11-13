import { IUserRepository } from '../../src/repositories/interfaces/user.repository.interface';
import { CreateIdentityInput, IdentityProvider } from '../../src/services/identity.provider';
import { TokenVerifier } from '../../src/services/token.verifier';
import { ImageStorage, UploadedImage } from '../../src/services/image.storage';
import {
  AuthUser,
  CreateCompleteProfileInput,
  CreateIncompleteProfileInput,
  UserProfile,
} from '../../src/types/user.types';
import {
  EmailInUseError,
  ServiceUnavailableError,
  FirestoreError,
  NotFoundError,
  UnauthenticatedError,
  UsernameTakenError,
  ValidationError,
} from '../../src/types/errors.types';
import { createApp } from '../../src/app';
import { AuthGateway, AuthSession, SignInResult } from '../../src/services/auth.gateway';
import { GoogleOAuthClient } from '../../src/services/google.oauth';

/** Cede el turno al event loop, como haría una llamada real a Firestore. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

/**
 * Repositorio en memoria con la MISMA semántica que la transacción de Firestore:
 * la verificación y la reserva del username ocurren sin interrupción (no hay
 * `await` entre ambas), así que dos peticiones simultáneas no pueden ganar las dos.
 */
export class InMemoryUserRepository implements IUserRepository {
  readonly users = new Map<string, UserProfile>();
  readonly usernames = new Map<string, string>(); // usernameLower -> uid
  /** Si es true, la próxima escritura de perfil falla como si Firestore no respondiera. */
  failNextProfileWrite = false;

  async findById(uid: string): Promise<UserProfile | null> {
    await tick();
    return this.users.get(uid) ?? null;
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    await tick();
    return this.usernames.has(username.toLowerCase());
  }

  async createProfileWithUsername(input: CreateCompleteProfileInput): Promise<UserProfile> {
    await tick();
    if (this.failNextProfileWrite) {
      this.failNextProfileWrite = false;
      throw new FirestoreError();
    }
    const lower = input.username.toLowerCase();
    if (this.usernames.has(lower)) throw new UsernameTakenError();
    if (this.users.has(input.uid)) throw new ValidationError('Esta cuenta ya tiene un perfil registrado.');

    const now = new Date().toISOString();
    const profile: UserProfile = {
      ...input,
      usernameLower: lower,
      profileComplete: true,
      createdAt: now,
      updatedAt: now,
    };
    this.usernames.set(lower, input.uid);
    this.users.set(input.uid, profile);
    return { ...profile };
  }

  async createIncompleteProfile(input: CreateIncompleteProfileInput): Promise<UserProfile> {
    await tick();
    const existing = this.users.get(input.uid);
    if (existing) return { ...existing };

    const now = new Date().toISOString();
    const profile: UserProfile = {
      ...input,
      username: null,
      usernameLower: null,
      profileComplete: false,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(input.uid, profile);
    return { ...profile };
  }

  async claimUsername(uid: string, username: string): Promise<UserProfile> {
    await tick();
    const profile = this.users.get(uid);
    if (!profile) throw new NotFoundError('No encontramos tu perfil. Inicia sesión de nuevo.');
    if (profile.profileComplete) {
      throw new ValidationError('Ya elegiste tu nombre de usuario.', {
        username: 'Ya tienes un nombre de usuario. Puedes cambiarlo desde tu perfil.',
      });
    }
    const lower = username.toLowerCase();
    if (this.usernames.has(lower)) throw new UsernameTakenError();

    this.usernames.set(lower, uid);
    Object.assign(profile, {
      username,
      usernameLower: lower,
      profileComplete: true,
      updatedAt: new Date().toISOString(),
    });
    return { ...profile };
  }

  async updateAvatar(uid: string, avatar: string): Promise<UserProfile> {
    await tick();
    const profile = this.users.get(uid);
    if (!profile) throw new NotFoundError('No encontramos tu perfil. Inicia sesión de nuevo.');
    Object.assign(profile, { avatar, updatedAt: new Date().toISOString() });
    return { ...profile };
  }

  async deleteProfile(uid: string): Promise<void> {
    await tick();
    const profile = this.users.get(uid);
    if (!profile) return;
    if (profile.usernameLower && this.usernames.get(profile.usernameLower) === uid) {
      this.usernames.delete(profile.usernameLower);
    }
    this.users.delete(uid);
  }
}

/** Firebase Auth en memoria: registra las cuentas creadas y las eliminadas (rollback). */
export class FakeIdentityProvider implements IdentityProvider {
  readonly accounts = new Map<string, CreateIdentityInput>(); // uid -> datos
  readonly deletedUids: string[] = [];
  private counter = 0;

  async createUser(input: CreateIdentityInput): Promise<{ uid: string }> {
    await tick();
    const exists = [...this.accounts.values()].some((a) => a.email === input.email);
    if (exists) throw new EmailInUseError('Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?');
    const uid = `uid-${++this.counter}`;
    this.accounts.set(uid, input);
    return { uid };
  }

  async deleteUser(uid: string): Promise<void> {
    await tick();
    this.accounts.delete(uid);
    this.deletedUids.push(uid);
  }

  readonly revokedUids: string[] = [];

  async revokeSessions(uid: string): Promise<void> {
    await tick();
    this.revokedUids.push(uid);
  }
}

/**
 * REST API de Firebase Auth en memoria. Inicia sesión contra las cuentas del
 * FakeIdentityProvider (las que crea POST /api/auth/register) y contra cuentas de
 * Google registradas con `addGoogleAccount`.
 */
export class FakeAuthGateway implements AuthGateway {
  private readonly refreshTokens = new Map<string, string>(); // refreshToken -> uid
  private readonly googleAccounts = new Map<string, Omit<AuthUser, 'signInProvider'>>(); // googleIdToken -> user
  private counter = 0;
  /** Si tiene valor, la próxima llamada falla con este error. */
  failNext: Error | null = null;

  constructor(private readonly identity: FakeIdentityProvider) {}

  addGoogleAccount(googleIdToken: string, user: Partial<AuthUser> & { uid: string }): this {
    this.googleAccounts.set(googleIdToken, { email: null, emailVerified: true, name: null, picture: null, ...user });
    return this;
  }

  private newSession(uid: string): AuthSession {
    const n = ++this.counter;
    const refreshToken = `refresh-${uid}-${n}`;
    this.refreshTokens.set(refreshToken, uid);
    return { idToken: `id-${uid}-${n}`, refreshToken, expiresIn: 3600 };
  }

  private takeFailure(): void {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
  }

  async signInWithPassword(email: string, password: string): Promise<SignInResult> {
    await tick();
    this.takeFailure();
    const entry = [...this.identity.accounts.entries()].find(([, a]) => a.email === email);
    if (!entry || entry[1].password !== password) {
      throw new UnauthenticatedError('Correo o contraseña incorrectos.');
    }
    const [uid, account] = entry;
    return {
      session: this.newSession(uid),
      user: {
        uid,
        email: account.email,
        emailVerified: false,
        name: account.displayName,
        picture: null,
        signInProvider: 'password',
      },
    };
  }

  async signInWithGoogleIdToken(googleIdToken: string): Promise<SignInResult> {
    await tick();
    this.takeFailure();
    const user = this.googleAccounts.get(googleIdToken);
    if (!user) throw new UnauthenticatedError('No pudimos verificar tu cuenta de Google. Intenta de nuevo.');
    return { session: this.newSession(user.uid), user: { ...user, signInProvider: 'google.com' } };
  }

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    await tick();
    this.takeFailure();
    const uid = this.refreshTokens.get(refreshToken);
    if (!uid) throw new UnauthenticatedError('Tu sesión expiró. Inicia sesión de nuevo.');
    this.refreshTokens.delete(refreshToken);
    return this.newSession(uid);
  }
}

/** Google OAuth en memoria: cada `code` se cambia por un id_token de Google. */
export class FakeGoogleOAuthClient implements GoogleOAuthClient {
  readonly redirectUri = 'http://localhost:3000/api/auth/google/callback';
  readonly codes = new Map<string, string>(); // code -> googleIdToken
  configured = true;

  isConfigured(): boolean {
    return this.configured;
  }

  buildAuthorizationUrl(state: string): string {
    return `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCode(code: string): Promise<string> {
    await tick();
    const idToken = this.codes.get(code);
    if (!idToken) throw new UnauthenticatedError('El inicio de sesión con Google expiró. Intenta de nuevo.');
    this.codes.delete(code);
    return idToken;
  }
}

/** Cloudinary en memoria: guarda los bytes subidos por uid. */
export class FakeImageStorage implements ImageStorage {
  readonly images = new Map<string, Buffer>();
  /** Si es true, la subida falla como si Cloudinary no respondiera. */
  failUploads = false;
  private version = 0;

  async uploadAvatar(uid: string, image: Buffer): Promise<UploadedImage> {
    await tick();
    if (this.failUploads) throw new ServiceUnavailableError('No pudimos guardar tu imagen en este momento. Intenta de nuevo en unos minutos.');
    this.images.set(uid, image);
    const publicId = `estudiemos/avatars/${uid}`;
    return { url: `https://res.cloudinary.com/demo/image/upload/v${++this.version}/${publicId}.webp`, publicId };
  }

  async deleteAvatar(uid: string): Promise<void> {
    await tick();
    this.images.delete(uid);
  }
}

export const EXPIRED_TOKEN = 'token-vencido';

/** Verificador de tokens: cada token registrado se mapea a un usuario. */
export class FakeTokenVerifier implements TokenVerifier {
  private readonly tokens = new Map<string, AuthUser>();

  register(token: string, user: Partial<AuthUser> & { uid: string }): this {
    this.tokens.set(token, {
      email: null,
      emailVerified: false,
      name: null,
      picture: null,
      signInProvider: 'password',
      ...user,
    });
    return this;
  }

  async verifyIdToken(idToken: string): Promise<AuthUser> {
    if (idToken === EXPIRED_TOKEN) throw new UnauthenticatedError('Tu sesión expiró. Inicia sesión de nuevo.');
    const user = this.tokens.get(idToken);
    if (!user) throw new UnauthenticatedError('Tu sesión no es válida. Inicia sesión de nuevo.');
    return user;
  }
}

/** App lista para Supertest con todas las dependencias en memoria. */
export function buildTestApp() {
  const userRepository = new InMemoryUserRepository();
  const identityProvider = new FakeIdentityProvider();
  const tokenVerifier = new FakeTokenVerifier();
  const imageStorage = new FakeImageStorage();
  const authGateway = new FakeAuthGateway(identityProvider);
  const googleOAuth = new FakeGoogleOAuthClient();
  const app = createApp({ userRepository, identityProvider, tokenVerifier, imageStorage, authGateway, googleOAuth });
  return { app, userRepository, identityProvider, tokenVerifier, imageStorage, authGateway, googleOAuth };
}

/** Cuerpo válido de registro (US-01). */
export const validRegistration = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Ana María',
  lastName: 'Pérez Gómez',
  username: 'Ana_01',
  avatar: 'avatar-03',
  email: 'ana.perez@correounivalle.edu.co',
  password: 'Estudio2026',
  ...overrides,
});
