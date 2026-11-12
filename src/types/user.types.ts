/** Proveedor con el que se creó la cuenta. */
export type AuthProvider = 'password' | 'google';

/** Datos del usuario autenticado extraídos del ID token de Firebase (req.auth). */
export interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  /** firebase.sign_in_provider del token: 'password', 'google.com', 'custom', ... */
  signInProvider: string | null;
}

/** Perfil del estudiante en Firestore (users/{uid}), tal como lo responde la API. */
export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  /** null mientras un usuario de Google no haya elegido username (profileComplete = false). */
  username: string | null;
  usernameLower: string | null;
  email: string;
  /** Id de avatar del catálogo (cuentas manuales) o URL de la foto de Google. */
  avatar: string | null;
  provider: AuthProvider;
  profileComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Datos para crear un perfil completo con reserva de username (registro manual). */
export interface CreateCompleteProfileInput {
  uid: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  avatar: string;
  provider: AuthProvider;
}

/** Datos para crear el perfil incompleto del primer ingreso con Google. */
export interface CreateIncompleteProfileInput {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string | null;
  provider: AuthProvider;
}
