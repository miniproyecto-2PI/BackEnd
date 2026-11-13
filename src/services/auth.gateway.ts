import { env } from '../config/env';
import { AuthUser } from '../types/user.types';
import {
  AppError,
  EmailInUseError,
  ForbiddenError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthenticatedError,
} from '../types/errors.types';

/** Tokens de una sesión de Firebase Authentication emitidos por el servidor. */
export interface AuthSession {
  /** ID token (JWT, 1 h). El frontend lo envía como `Authorization: Bearer <idToken>`. */
  idToken: string;
  /** Token de larga duración para pedir un ID token nuevo (POST /api/auth/refresh). */
  refreshToken: string;
  /** Segundos de vida del idToken (Firebase: 3600). */
  expiresIn: number;
}

export interface SignInResult {
  session: AuthSession;
  /** Datos del usuario de la sesión, con la misma forma que deja `authenticate` en req.auth. */
  user: AuthUser;
}

/**
 * Inicio de sesión contra Firebase Authentication hecho por el SERVIDOR (el frontend
 * no usa el SDK de Firebase). Se inyecta en AuthService para poder testear sin red.
 */
export interface AuthGateway {
  signInWithPassword(email: string, password: string): Promise<SignInResult>;
  /** Cambia el id_token de Google (obtenido en el callback OAuth) por una sesión de Firebase. */
  signInWithGoogleIdToken(googleIdToken: string, requestUri: string): Promise<SignInResult>;
  refreshSession(refreshToken: string): Promise<AuthSession>;
}

type FetchFn = typeof fetch;

const GOOGLE_PROVIDER = 'google.com';
const BAD_CREDENTIALS = 'Correo o contraseña incorrectos.';
const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.';

/** Error devuelto por la REST API de Firebase: `{ error: { message: 'CODIGO : detalle' } }`. */
class FirebaseRestError extends Error {
  constructor(readonly firebaseCode: string, readonly status: number) {
    super(firebaseCode);
  }
}

/** Errores de Firebase que se traducen a errores del contrato TS-05. */
const COMMON_ERRORS: Record<string, () => AppError> = {
  USER_DISABLED: () => new ForbiddenError('Esta cuenta está deshabilitada. Escríbenos si crees que es un error.'),
  TOO_MANY_ATTEMPTS_TRY_LATER: () =>
    new TooManyRequestsError('Hiciste demasiados intentos. Espera unos minutos e intenta de nuevo.'),
};

const PASSWORD_ERRORS: Record<string, () => AppError> = {
  ...COMMON_ERRORS,
  EMAIL_NOT_FOUND: () => new UnauthenticatedError(BAD_CREDENTIALS),
  INVALID_PASSWORD: () => new UnauthenticatedError(BAD_CREDENTIALS),
  INVALID_LOGIN_CREDENTIALS: () => new UnauthenticatedError(BAD_CREDENTIALS),
  INVALID_EMAIL: () => new UnauthenticatedError(BAD_CREDENTIALS),
};

const REFRESH_ERRORS: Record<string, () => AppError> = {
  ...COMMON_ERRORS,
  TOKEN_EXPIRED: () => new UnauthenticatedError(SESSION_EXPIRED),
  INVALID_REFRESH_TOKEN: () => new UnauthenticatedError(SESSION_EXPIRED),
  MISSING_REFRESH_TOKEN: () => new UnauthenticatedError(SESSION_EXPIRED),
  USER_NOT_FOUND: () => new UnauthenticatedError(SESSION_EXPIRED),
};

const GOOGLE_ERRORS: Record<string, () => AppError> = {
  ...COMMON_ERRORS,
  INVALID_IDP_RESPONSE: () =>
    new UnauthenticatedError('No pudimos verificar tu cuenta de Google. Intenta de nuevo.'),
  FEDERATED_USER_ID_ALREADY_LINKED: () => googleEmailInUse(),
  EMAIL_EXISTS: () => googleEmailInUse(),
};

function googleEmailInUse(): AppError {
  return new EmailInUseError(
    'Este correo ya tiene una cuenta con contraseña. Inicia sesión con tu correo y contraseña.'
  );
}

/**
 * Implementación con la REST API de Firebase Authentication (Identity Toolkit + Secure Token).
 * Requiere FIREBASE_WEB_API_KEY. Con FIREBASE_AUTH_EMULATOR_HOST usa el emulador local.
 */
export class FirebaseAuthGateway implements AuthGateway {
  constructor(
    private readonly apiKey: string | undefined = env.FIREBASE.webApiKey,
    private readonly emulatorHost: string | undefined = env.FIREBASE.authEmulatorHost,
    private readonly fetchFn: FetchFn = (...args) => fetch(...args)
  ) {}

  async signInWithPassword(email: string, password: string): Promise<SignInResult> {
    const body = await this.call(
      `${this.identityToolkitBase()}/accounts:signInWithPassword`,
      { email, password, returnSecureToken: true },
      PASSWORD_ERRORS,
      'iniciar sesión con correo'
    );
    return {
      session: toSession(body.idToken, body.refreshToken, body.expiresIn),
      user: {
        uid: String(body.localId),
        email: strOrNull(body.email),
        emailVerified: Boolean(body.emailVerified),
        name: strOrNull(body.displayName),
        picture: strOrNull(body.profilePicture),
        signInProvider: 'password',
      },
    };
  }

  async signInWithGoogleIdToken(googleIdToken: string, requestUri: string): Promise<SignInResult> {
    const body = await this.call(
      `${this.identityToolkitBase()}/accounts:signInWithIdp`,
      {
        postBody: new URLSearchParams({ id_token: googleIdToken, providerId: GOOGLE_PROVIDER }).toString(),
        requestUri,
        returnSecureToken: true,
        returnIdpCredential: true,
      },
      GOOGLE_ERRORS,
      'iniciar sesión con Google'
    );

    // El correo ya pertenece a una cuenta de correo/contraseña y Firebase no la vinculó solo
    if (body.needConfirmation || !body.idToken) throw googleEmailInUse();

    return {
      session: toSession(body.idToken, body.refreshToken, body.expiresIn),
      user: {
        uid: String(body.localId),
        email: strOrNull(body.email),
        emailVerified: Boolean(body.emailVerified),
        name: strOrNull(body.displayName) ?? strOrNull(body.fullName),
        picture: strOrNull(body.photoUrl),
        signInProvider: GOOGLE_PROVIDER,
      },
    };
  }

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    const body = await this.call(
      `${this.secureTokenBase()}/token`,
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
      REFRESH_ERRORS,
      'renovar la sesión'
    );
    return toSession(body.id_token, body.refresh_token, body.expires_in);
  }

  private identityToolkitBase(): string {
    return this.emulatorHost
      ? `http://${this.emulatorHost}/identitytoolkit.googleapis.com/v1`
      : 'https://identitytoolkit.googleapis.com/v1';
  }

  private secureTokenBase(): string {
    return this.emulatorHost
      ? `http://${this.emulatorHost}/securetoken.googleapis.com/v1`
      : 'https://securetoken.googleapis.com/v1';
  }

  /** POST a la REST API de Firebase; traduce sus errores con `errors` (el resto → 503). */
  private async call(
    url: string,
    payload: Record<string, unknown> | URLSearchParams,
    errors: Record<string, () => AppError>,
    action: string
  ): Promise<Record<string, unknown>> {
    const key = this.apiKey ?? (this.emulatorHost ? 'emulator-api-key' : undefined);
    if (!key) {
      console.error('[Auth] Falta FIREBASE_WEB_API_KEY: no se puede iniciar sesión.');
      throw new ServiceUnavailableError();
    }

    try {
      const isForm = payload instanceof URLSearchParams;
      const res = await this.fetchFn(`${url}?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json' },
        body: isForm ? payload.toString() : JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new FirebaseRestError(firebaseErrorCode(body), res.status);
      return body;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof FirebaseRestError) {
        const mapped = errors[error.firebaseCode];
        if (mapped) throw mapped();
        // CONFIGURATION_NOT_FOUND (Auth sin habilitar), OPERATION_NOT_ALLOWED (proveedor
        // desactivado), API key inválida, etc.: es configuración del servidor, no del usuario.
        console.error(`[Auth] Firebase rechazó ${action} (${error.status} ${error.firebaseCode}).`);
        throw new ServiceUnavailableError();
      }
      console.error(`[Auth] No se pudo contactar a Firebase para ${action}: ${(error as Error).message}`);
      throw new ServiceUnavailableError();
    }
  }
}

/** 'TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account...' → 'TOO_MANY_ATTEMPTS_TRY_LATER' */
function firebaseErrorCode(body: Record<string, unknown>): string {
  const error = body.error as { message?: unknown } | string | undefined;
  const raw = typeof error === 'string' ? error : typeof error?.message === 'string' ? error.message : '';
  return raw.split(/[\s:]/)[0].toUpperCase() || 'UNKNOWN';
}

function toSession(idToken: unknown, refreshToken: unknown, expiresIn: unknown): AuthSession {
  if (typeof idToken !== 'string' || typeof refreshToken !== 'string') {
    console.error('[Auth] Firebase respondió sin tokens de sesión.');
    throw new ServiceUnavailableError();
  }
  const seconds = Number(expiresIn);
  return { idToken, refreshToken, expiresIn: Number.isFinite(seconds) && seconds > 0 ? seconds : 3600 };
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
