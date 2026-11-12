import { IUserRepository } from '../repositories/interfaces/user.repository.interface';
import { IdentityProvider } from './identity.provider';
import { AuthUser, UserProfile } from '../types/user.types';
import { NotFoundError, UsernameTakenError, ValidationError } from '../types/errors.types';
import { RegisterInput } from '../validators/user.schemas';

const GOOGLE_PROVIDER = 'google.com';
const NAME_MAX = 50;

/** Separa el displayName de Google en nombres (primera palabra) y apellidos (resto). */
export function splitGoogleName(displayName: string | null): { firstName: string; lastName: string } {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Estudiante', lastName: '' };
  return {
    firstName: parts[0].slice(0, NAME_MAX),
    lastName: parts.slice(1).join(' ').slice(0, NAME_MAX),
  };
}

export interface MeResult {
  profile: UserProfile;
  /** true si el perfil se creó en esta petición (primer ingreso con Google). */
  created: boolean;
}

export class UserService {
  constructor(
    private readonly users: IUserRepository,
    private readonly identity: IdentityProvider
  ) {}

  /**
   * Registro manual (US-01):
   *  1. Verificación rápida del username (evita crear la cuenta de Auth si ya está ocupado).
   *  2. Crea la cuenta en Firebase Auth (409 EMAIL_IN_USE si el correo existe).
   *  3. Transacción que reserva usernames/{lower} y crea users/{uid}: es la garantía
   *     real de unicidad ante registros simultáneos.
   *  4. Si el paso 3 falla, elimina la cuenta de Auth para no dejar cuentas a medias.
   */
  async register(input: RegisterInput): Promise<UserProfile> {
    if (await this.users.isUsernameTaken(input.username)) {
      throw new UsernameTakenError();
    }

    const { uid } = await this.identity.createUser({
      email: input.email,
      password: input.password,
      displayName: `${input.firstName} ${input.lastName}`,
    });

    try {
      return await this.users.createProfileWithUsername({
        uid,
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        email: input.email,
        avatar: input.avatar,
        provider: 'password',
      });
    } catch (error) {
      try {
        await this.identity.deleteUser(uid);
      } catch (rollbackError) {
        console.error(
          `[Registro] No se pudo revertir la cuenta de Auth ${uid}: ${(rollbackError as Error).message}`
        );
      }
      throw error;
    }
  }

  /**
   * Perfil del usuario de la sesión (US-02, US-03). En el primer ingreso con Google
   * crea el perfil incompleto (sin username) con nombre, foto y correo de Google.
   */
  async getOrCreateMe(auth: AuthUser): Promise<MeResult> {
    const existing = await this.users.findById(auth.uid);
    if (existing) return { profile: existing, created: false };

    if (auth.signInProvider !== GOOGLE_PROVIDER) {
      throw new NotFoundError('No encontramos tu perfil. Vuelve a crear tu cuenta o contacta a soporte.');
    }
    if (!auth.email) {
      throw new ValidationError('Tu cuenta de Google no tiene un correo asociado.');
    }

    const { firstName, lastName } = splitGoogleName(auth.name);
    const profile = await this.users.createIncompleteProfile({
      uid: auth.uid,
      firstName,
      lastName,
      email: auth.email.toLowerCase(),
      avatar: auth.picture,
      provider: 'google',
    });
    return { profile, created: true };
  }

  /** Elegir username para completar el perfil (US-02). Misma unicidad que US-01. */
  async chooseUsername(uid: string, username: string): Promise<UserProfile> {
    return this.users.claimUsername(uid, username);
  }
}
