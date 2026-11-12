import { IUserRepository } from '../repositories/interfaces/user.repository.interface';
import { IdentityProvider } from './identity.provider';
import { UserProfile } from '../types/user.types';
import { UsernameTakenError } from '../types/errors.types';
import { RegisterInput } from '../validators/user.schemas';

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
}
