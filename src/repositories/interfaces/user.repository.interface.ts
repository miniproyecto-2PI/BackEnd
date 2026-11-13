import {
  CreateCompleteProfileInput,
  CreateIncompleteProfileInput,
  UserProfile,
} from '../../types/user.types';

/**
 * Acceso a los perfiles (users/{uid}) y a la reserva de nombres de usuario
 * (usernames/{usernameLower}). La unicidad del username se garantiza con
 * transacciones: dos peticiones simultáneas con el mismo username nunca
 * quedan ambas con éxito.
 */
export interface IUserRepository {
  findById(uid: string): Promise<UserProfile | null>;

  /** true si el username (sin distinguir mayúsculas) ya está reservado. */
  isUsernameTaken(username: string): Promise<boolean>;

  /** Crea el perfil completo y reserva el username en una transacción. 409 USERNAME_TAKEN si ya existe. */
  createProfileWithUsername(input: CreateCompleteProfileInput): Promise<UserProfile>;

  /** Crea el perfil incompleto (sin username). Si ya existe un perfil, lo devuelve sin cambios. */
  createIncompleteProfile(input: CreateIncompleteProfileInput): Promise<UserProfile>;

  /**
   * Reserva el username para un perfil incompleto y lo marca completo, en una transacción.
   * 404 si no hay perfil, 400 si ya estaba completo, 409 USERNAME_TAKEN si está ocupado.
   */
  claimUsername(uid: string, username: string): Promise<UserProfile>;

  /** Reemplaza el avatar (id del catálogo o URL de imagen). 404 si no hay perfil. */
  updateAvatar(uid: string, avatar: string): Promise<UserProfile>;

  /** Borra el perfil y libera su username. Idempotente. */
  deleteProfile(uid: string): Promise<void>;
}
