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
  const app = createApp({ userRepository, identityProvider, tokenVerifier, imageStorage });
  return { app, userRepository, identityProvider, tokenVerifier, imageStorage };
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
