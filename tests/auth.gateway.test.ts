import { describe, expect, it, vi } from 'vitest';
import { FirebaseAuthGateway } from '../src/services/auth.gateway';
import { InMemoryLoginTicketStore } from '../src/services/login.tickets';
import { AppError } from '../src/types/errors.types';

/** fetch falso que responde siempre `body` con `status` y registra las llamadas. */
function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  );
}

const firebaseError = (message: string) => ({ error: { code: 400, message } });

async function caught(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  throw new Error('Se esperaba un error');
}

/** Traducción de la REST API de Firebase Auth al contrato TS-05 (sin red). */
describe('FirebaseAuthGateway', () => {
  it('signInWithPassword envía el correo con la API key y arma sesión y usuario', async () => {
    const fetchFn = fakeFetch(200, {
      localId: 'uid-1',
      email: 'ana@correounivalle.edu.co',
      displayName: 'Ana Pérez',
      idToken: 'id-token',
      refreshToken: 'refresh-token',
      expiresIn: '3600',
    });
    const gateway = new FirebaseAuthGateway('clave-web', undefined, fetchFn as unknown as typeof fetch);

    const result = await gateway.signInWithPassword('ana@correounivalle.edu.co', 'Estudio2026');

    expect(result).toEqual({
      session: { idToken: 'id-token', refreshToken: 'refresh-token', expiresIn: 3600 },
      user: {
        uid: 'uid-1',
        email: 'ana@correounivalle.edu.co',
        emailVerified: false,
        name: 'Ana Pérez',
        picture: null,
        signInProvider: 'password',
      },
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=clave-web'
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'ana@correounivalle.edu.co',
      password: 'Estudio2026',
      returnSecureToken: true,
    });
  });

  it.each([
    ['INVALID_LOGIN_CREDENTIALS', 401, 'UNAUTHENTICATED'],
    ['EMAIL_NOT_FOUND', 401, 'UNAUTHENTICATED'],
    ['INVALID_PASSWORD', 401, 'UNAUTHENTICATED'],
    ['USER_DISABLED', 403, 'FORBIDDEN'],
    ['TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled', 429, 'TOO_MANY_REQUESTS'],
    ['CONFIGURATION_NOT_FOUND', 503, 'SERVICE_UNAVAILABLE'],
    ['OPERATION_NOT_ALLOWED', 503, 'SERVICE_UNAVAILABLE'],
    ['API key not valid. Please pass a valid API key.', 503, 'SERVICE_UNAVAILABLE'],
  ])('traduce %s a %i %s', async (message, status, code) => {
    const gateway = new FirebaseAuthGateway('clave', undefined, fakeFetch(400, firebaseError(message)) as unknown as typeof fetch);
    const error = await caught(gateway.signInWithPassword('a@b.co', 'x'));
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(status);
    expect(error.code).toBe(code);
  });

  it('responde 503 sin FIREBASE_WEB_API_KEY y no llama a Firebase', async () => {
    const fetchFn = fakeFetch(200, {});
    const gateway = new FirebaseAuthGateway(undefined, undefined, fetchFn as unknown as typeof fetch);
    const error = await caught(gateway.signInWithPassword('a@b.co', 'x'));
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('responde 503 si Firebase no responde (red caída)', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const gateway = new FirebaseAuthGateway('clave', undefined, fetchFn as unknown as typeof fetch);
    const error = await caught(gateway.signInWithPassword('a@b.co', 'x'));
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('refreshSession usa el endpoint de Secure Token con formulario', async () => {
    const fetchFn = fakeFetch(200, { id_token: 'nuevo', refresh_token: 'r2', expires_in: '3600' });
    const gateway = new FirebaseAuthGateway('clave', undefined, fetchFn as unknown as typeof fetch);

    await expect(gateway.refreshSession('r1')).resolves.toEqual({ idToken: 'nuevo', refreshToken: 'r2', expiresIn: 3600 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('https://securetoken.googleapis.com/v1/token?key=clave');
    expect(String(init?.body)).toBe('grant_type=refresh_token&refresh_token=r1');
  });

  it('refreshSession traduce TOKEN_EXPIRED a 401', async () => {
    const gateway = new FirebaseAuthGateway('clave', undefined, fakeFetch(400, firebaseError('TOKEN_EXPIRED')) as unknown as typeof fetch);
    const error = await caught(gateway.refreshSession('r1'));
    expect(error.statusCode).toBe(401);
  });

  it('signInWithGoogleIdToken responde 409 EMAIL_IN_USE si Firebase pide confirmación', async () => {
    const gateway = new FirebaseAuthGateway(
      'clave',
      undefined,
      fakeFetch(200, { needConfirmation: true, email: 'ana@gmail.com' }) as unknown as typeof fetch
    );
    const error = await caught(gateway.signInWithGoogleIdToken('google-id', 'http://localhost/cb'));
    expect(error.code).toBe('EMAIL_IN_USE');
  });

  it('signInWithGoogleIdToken envía el id_token de Google y marca el proveedor google.com', async () => {
    const fetchFn = fakeFetch(200, {
      localId: 'uid-g',
      email: 'ana@gmail.com',
      displayName: 'Ana Pérez',
      photoUrl: 'https://lh3.googleusercontent.com/a/foto',
      idToken: 'id',
      refreshToken: 'r',
      expiresIn: '3600',
    });
    const gateway = new FirebaseAuthGateway('clave', undefined, fetchFn as unknown as typeof fetch);

    const { user } = await gateway.signInWithGoogleIdToken('google-id', 'http://localhost/cb');

    expect(user).toMatchObject({ uid: 'uid-g', signInProvider: 'google.com', picture: 'https://lh3.googleusercontent.com/a/foto' });
    const body = JSON.parse(String(fetchFn.mock.calls[0][1]?.body));
    expect(body.postBody).toBe('id_token=google-id&providerId=google.com');
    expect(body.requestUri).toBe('http://localhost/cb');
  });

  it('usa el emulador de Auth cuando FIREBASE_AUTH_EMULATOR_HOST está definido', async () => {
    const fetchFn = fakeFetch(200, { localId: 'u', idToken: 'i', refreshToken: 'r', expiresIn: '3600' });
    const gateway = new FirebaseAuthGateway(undefined, 'localhost:9099', fetchFn as unknown as typeof fetch);
    await gateway.signInWithPassword('a@b.co', 'x');
    expect(String(fetchFn.mock.calls[0][0])).toMatch(
      /^http:\/\/localhost:9099\/identitytoolkit\.googleapis\.com\/v1\/accounts:signInWithPassword\?key=/
    );
  });
});

describe('InMemoryLoginTicketStore', () => {
  it('entrega el contenido una sola vez', async () => {
    const store = new InMemoryLoginTicketStore<string>();
    const ticket = await store.create('sesion');
    await expect(store.consume(ticket)).resolves.toBe('sesion');
    await expect(store.consume(ticket)).resolves.toBeNull();
  });

  it('no entrega tickets vencidos', async () => {
    let now = 0;
    const store = new InMemoryLoginTicketStore<string>(60_000, () => now);
    const ticket = await store.create('sesion');
    now = 60_001;
    await expect(store.consume(ticket)).resolves.toBeNull();
  });
});
