import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp, validRegistration } from './helpers/fakes';
import { OAUTH_STATE_COOKIE, safeRedirectPath } from '../src/controllers/auth.controller';
import { ServiceUnavailableError } from '../src/types/errors.types';

const LOGIN = '/api/auth/login';
const credentials = { email: 'ana.perez@correounivalle.edu.co', password: 'Estudio2026' };

async function registeredApp() {
  const ctx = buildTestApp();
  await request(ctx.app).post('/api/auth/register').send(validRegistration()).expect(201);
  return ctx;
}

/** US-03: el login ocurre en la API; el frontend no usa el SDK de Firebase. */
describe('POST /api/auth/login (US-03)', () => {
  it('devuelve la sesión y el perfil con credenciales correctas (200)', async () => {
    const { app } = await registeredApp();

    const res = await request(app).post(LOGIN).send(credentials);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: '¡Hola de nuevo, Ana María!',
      data: {
        session: { idToken: expect.any(String), refreshToken: expect.any(String), expiresIn: 3600 },
        profile: { username: 'Ana_01', email: credentials.email, profileComplete: true },
      },
    });
    expect(JSON.stringify(res.body)).not.toContain(credentials.password);
  });

  it('normaliza el correo (mayúsculas y espacios) antes de iniciar sesión', async () => {
    const { app } = await registeredApp();
    const res = await request(app).post(LOGIN).send({ ...credentials, email: '  ANA.Perez@Correounivalle.edu.co ' });
    expect(res.status).toBe(200);
  });

  it.each([
    ['contraseña incorrecta', { ...credentials, password: 'OtraClave1' }],
    ['correo sin cuenta', { ...credentials, email: 'nadie@correounivalle.edu.co' }],
  ])('responde 401 con un mensaje genérico (%s)', async (_label, body) => {
    const { app } = await registeredApp();
    const res = await request(app).post(LOGIN).send(body);
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'UNAUTHENTICATED', message: 'Correo o contraseña incorrectos.', fields: null });
  });

  it('valida los campos (400) sin exigir las reglas de creación de contraseña', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post(LOGIN).send({ email: 'no-es-correo', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({
      email: 'Escribe un correo válido, por ejemplo nombre@correounivalle.edu.co.',
      password: 'Escribe tu contraseña.',
    });
  });

  it('bloquea con 429 tras 10 intentos fallidos del mismo correo, sin afectar a otros correos', async () => {
    const { app } = await registeredApp();
    const wrong = { ...credentials, password: 'Incorrecta1' };
    for (let i = 0; i < 10; i++) await request(app).post(LOGIN).send(wrong).expect(401);

    const blocked = await request(app).post(LOGIN).send(credentials);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');

    const other = await request(app).post(LOGIN).send({ email: 'otra@correounivalle.edu.co', password: 'x' });
    expect(other.status).toBe(401);
  });

  it('responde 503 si Firebase Authentication no está disponible', async () => {
    const { app, authGateway } = await registeredApp();
    authGateway.failNext = new ServiceUnavailableError();
    const res = await request(app).post(LOGIN).send(credentials);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('POST /api/auth/refresh y /api/auth/logout', () => {
  it('cambia el refreshToken por una sesión nueva y no permite reutilizar el anterior', async () => {
    const { app } = await registeredApp();
    const login = await request(app).post(LOGIN).send(credentials).expect(200);
    const { refreshToken, idToken } = login.body.data.session;

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ idToken: expect.any(String), refreshToken: expect.any(String), expiresIn: 3600 });
    expect(res.body.data.idToken).not.toBe(idToken);

    const reused = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(reused.status).toBe(401);
  });

  it('responde 400 si falta el refreshToken', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('refreshToken');
  });

  it('logout exige sesión (401) y revoca las sesiones del uid del token', async () => {
    const { app, tokenVerifier, identityProvider } = buildTestApp();
    await request(app).post('/api/auth/logout').expect(401);

    tokenVerifier.register('token-ana', { uid: 'uid-ana' });
    const res = await request(app).post('/api/auth/logout').set('Authorization', 'Bearer token-ana');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: null });
    expect(identityProvider.revokedUids).toEqual(['uid-ana']);
  });
});

/** Extrae `estudiemos_oauth_state=<valor>` de Set-Cookie. */
function stateCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`));
  if (!cookie) throw new Error('No se envió la cookie de state');
  return cookie.split(';')[0];
}

async function startGoogle(app: Parameters<typeof request>[0], redirect = '/salas') {
  const res = await request(app).get('/api/auth/google').query({ redirect });
  const location = new URL(res.headers.location);
  return { res, state: location.searchParams.get('state') ?? '', cookie: stateCookie(res) };
}

describe('Ingreso con Google por redirección OAuth (US-02)', () => {
  it('redirige a Google con un state guardado en una cookie httpOnly', async () => {
    const { app } = buildTestApp();
    const { res, state } = await startGoogle(app);

    expect(res.status).toBe(303);
    expect(res.headers.location).toMatch(/^https:\/\/accounts\.google\.com\//);
    expect(state.length).toBeGreaterThan(20);
    const raw = ([] as string[]).concat(res.headers['set-cookie']).join(';');
    expect(raw).toContain('HttpOnly');
    expect(raw).toContain('SameSite=Lax');
  });

  it('flujo completo: callback → ?code= al frontend → canje → sesión y perfil incompleto', async () => {
    const { app, googleOAuth, authGateway, userRepository } = buildTestApp();
    googleOAuth.codes.set('codigo-google', 'google-id-token');
    authGateway.addGoogleAccount('google-id-token', {
      uid: 'uid-google',
      email: 'Ana.Perez@gmail.com',
      name: 'Ana Pérez',
      picture: 'https://lh3.googleusercontent.com/a/foto',
    });

    const { state, cookie } = await startGoogle(app, '/salas/abc');
    const callback = await request(app)
      .get('/api/auth/google/callback')
      .query({ code: 'codigo-google', state })
      .set('Cookie', cookie);

    expect(callback.status).toBe(303);
    const target = new URL(callback.headers.location);
    expect(`${target.origin}${target.pathname}`).toBe('http://localhost:5173/auth/google/callback');
    expect(target.searchParams.get('redirect')).toBe('/salas/abc');
    expect(target.searchParams.has('error')).toBe(false);
    expect(callback.headers.location).not.toContain('id-uid-google'); // los tokens no viajan en la URL
    const ticket = target.searchParams.get('code');

    const exchange = await request(app).post('/api/auth/google/exchange').send({ code: ticket });
    expect(exchange.status).toBe(200);
    expect(exchange.body.data).toMatchObject({
      session: { idToken: expect.any(String), refreshToken: expect.any(String) },
      profile: { uid: 'uid-google', firstName: 'Ana', provider: 'google', profileComplete: false, username: null },
    });
    expect(userRepository.users.has('uid-google')).toBe(true);

    // El código es de un solo uso
    const again = await request(app).post('/api/auth/google/exchange').send({ code: ticket });
    expect(again.status).toBe(401);
  });

  it('rechaza el callback si el state no coincide con la cookie (anti-CSRF)', async () => {
    const { app, googleOAuth } = buildTestApp();
    googleOAuth.codes.set('codigo-google', 'google-id-token');
    const { cookie } = await startGoogle(app);

    const res = await request(app)
      .get('/api/auth/google/callback')
      .query({ code: 'codigo-google', state: 'state-de-otro' })
      .set('Cookie', cookie);

    expect(new URL(res.headers.location).searchParams.get('error')).toBe('UNAUTHENTICATED');
    expect(googleOAuth.codes.has('codigo-google')).toBe(true); // ni siquiera se usó el código
  });

  it('rechaza el callback sin cookie de state', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/auth/google/callback').query({ code: 'x', state: 'y' });
    expect(new URL(res.headers.location).searchParams.get('error')).toBe('UNAUTHENTICATED');
  });

  it('informa GOOGLE_CANCELLED cuando la persona cancela en Google', async () => {
    const { app } = buildTestApp();
    const { state, cookie } = await startGoogle(app);
    const res = await request(app)
      .get('/api/auth/google/callback')
      .query({ error: 'access_denied', state })
      .set('Cookie', cookie);
    expect(new URL(res.headers.location).searchParams.get('error')).toBe('GOOGLE_CANCELLED');
  });

  it('redirige con ?error=SERVICE_UNAVAILABLE si Google no está configurado', async () => {
    const { app, googleOAuth } = buildTestApp();
    googleOAuth.configured = false;
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(303);
    expect(new URL(res.headers.location).searchParams.get('error')).toBe('SERVICE_UNAVAILABLE');
  });

  it('el canje responde 401 con un código inexistente y 400 sin código', async () => {
    const { app } = buildTestApp();
    await request(app).post('/api/auth/google/exchange').send({ code: 'inventado' }).expect(401);
    await request(app).post('/api/auth/google/exchange').send({}).expect(400);
  });
});

describe('safeRedirectPath (evita redirecciones abiertas)', () => {
  it.each(['/salas', '/salas/abc?tab=chat', '/'])('acepta la ruta interna %s', (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each(['https://malicioso.com', '//malicioso.com', '/\\malicioso.com', 'salas', '', '/a\nb', 42])(
    'rechaza %s',
    (value) => {
      expect(safeRedirectPath(value)).toBeNull();
    }
  );
});
