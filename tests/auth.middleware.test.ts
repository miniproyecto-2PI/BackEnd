import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp, EXPIRED_TOKEN } from './helpers/fakes';
import { ServiceUnavailableError } from '../src/types/errors.types';
import { createApp } from '../src/app';
import { InMemoryUserRepository, FakeIdentityProvider } from './helpers/fakes';

/** TS-01 / US-03: la API responde 401 a las peticiones privadas sin sesión válida. */
describe('Middleware authenticate (401 UNAUTHENTICATED)', () => {
  const { app, tokenVerifier } = buildTestApp();
  tokenVerifier.register('token-valido', {
    uid: 'u-google',
    email: 'juan@gmail.com',
    name: 'Juan Rincón',
    signInProvider: 'google.com',
  });

  const expectUnauthenticated = (res: request.Response) => {
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: expect.any(String), fields: null },
    });
  };

  it('rechaza la petición sin encabezado Authorization', async () => {
    expectUnauthenticated(await request(app).get('/api/users/me'));
  });

  it.each([
    ['otro esquema', 'Basic dXNlcjpwYXNz'],
    ['Bearer sin token', 'Bearer'],
    ['Bearer con espacios extra', 'Bearer a b'],
  ])('rechaza un encabezado mal formado (%s)', async (_label, header) => {
    expectUnauthenticated(await request(app).get('/api/users/me').set('Authorization', header));
  });

  it('rechaza un token alterado o desconocido', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', 'Bearer token-alterado');
    expectUnauthenticated(res);
    expect(res.body.error.message).toBe('Tu sesión no es válida. Inicia sesión de nuevo.');
  });

  it('rechaza un token vencido con un mensaje claro', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${EXPIRED_TOKEN}`);
    expectUnauthenticated(res);
    expect(res.body.error.message).toBe('Tu sesión expiró. Inicia sesión de nuevo.');
  });

  it('protege también la escritura de la base técnica (POST /api/archetype/seed)', async () => {
    expectUnauthenticated(await request(app).post('/api/archetype/seed').send({}));
  });

  it('acepta un token válido', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', 'Bearer token-valido');
    expect(res.status).toBe(200);
    expect(res.body.data.uid).toBe('u-google');
  });

  it('responde 503 SERVICE_UNAVAILABLE si Firebase Auth no está disponible', async () => {
    const appWithoutAuth = createApp({
      userRepository: new InMemoryUserRepository(),
      identityProvider: new FakeIdentityProvider(),
      tokenVerifier: {
        verifyIdToken: async () => {
          throw new ServiceUnavailableError();
        },
      },
    });
    const res = await request(appWithoutAuth).get('/api/users/me').set('Authorization', 'Bearer x');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
